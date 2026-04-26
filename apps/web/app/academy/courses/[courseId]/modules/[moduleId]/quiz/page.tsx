'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, HelpCircle, Loader2, XCircle } from 'lucide-react';

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  order: number;
  explanation: string | null;
  attempt: {
    questionId: string;
    selectedOption: number | null;
    isCorrect: boolean;
  } | null;
};

type QuizPayload = {
  module: { id: string; title: string; order: number };
  course: { id: string; title: string };
  questions: QuizQuestion[];
};

export default function AcademyModuleQuizPage({ params }: { params: { courseId: string; moduleId: string } }) {
  const [data, setData] = useState<QuizPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchQuiz = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/academy/modules/${params.moduleId}/quiz`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Gagal memuat quiz modul (HTTP ${res.status})`);
        const json = await res.json();
        if (!cancelled) setData(json.data ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat quiz.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchQuiz();
    return () => {
      cancelled = true;
    };
  }, [params.moduleId]);

  const answeredCount = useMemo(() => data?.questions.filter((question) => question.attempt).length ?? 0, [data]);
  const correctCount = useMemo(
    () => data?.questions.filter((question) => question.attempt?.isCorrect).length ?? 0,
    [data],
  );

  const submitAnswer = async (questionId: string) => {
    if (!data) return;
    const selectedOption = selectedOptions[questionId];
    if (selectedOption === undefined) return;

    setSubmittingId(questionId);
    setError(null);
    try {
      const res = await fetch(`/api/academy/quiz/${questionId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedOption, timeSpent: 60 }),
      });
      if (!res.ok) throw new Error(`Gagal mengirim jawaban (HTTP ${res.status})`);
      const json = await res.json();

      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          questions: current.questions.map((question) =>
            question.id === questionId
              ? {
                ...question,
                attempt: {
                  questionId,
                  selectedOption: json.data.selectedOption,
                  isCorrect: json.data.isCorrect,
                },
                explanation: json.data.explanation ?? question.explanation,
              }
              : question,
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim jawaban quiz.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return <div className="h-80 animate-pulse rounded-3xl bg-white" />;
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Quiz tidak bisa dimuat.</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Data quiz tidak ditemukan.</p>
      </div>
    );
  }

  const scorePercentage = data.questions.length > 0 ? Math.round((correctCount / data.questions.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/academy/courses/${params.courseId}`} className="inline-flex items-center gap-2 font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke course
        </Link>
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-teal-900 to-emerald-800 p-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">Quiz Akhir Modul</p>
        <h1 className="mt-3 text-3xl font-bold">{data.module.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">
          Jawab semua soal untuk mengukur pemahamanmu terhadap materi pada modul ini. Hasil akan tampil langsung setelah setiap jawaban dikirim.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-100">Total Soal</p>
            <p className="mt-2 text-2xl font-bold">{data.questions.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-100">Sudah Dijawab</p>
            <p className="mt-2 text-2xl font-bold">{answeredCount}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-100">Skor Saat Ini</p>
            <p className="mt-2 text-2xl font-bold">{scorePercentage}%</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="space-y-4">
        {data.questions.map((question) => {
          const hasAttempt = Boolean(question.attempt);
          const currentSelection = selectedOptions[question.id];

          return (
            <article key={question.id} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">Soal {question.order}</p>
                  <h2 className="mt-2 text-lg font-semibold leading-7 text-gray-900">{question.question}</h2>
                </div>
                {hasAttempt ? (
                  question.attempt?.isCorrect ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Benar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700">
                      <XCircle className="h-4 w-4" /> Perlu review
                    </span>
                  )
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                {question.options.map((option, index) => {
                  const selected = hasAttempt ? question.attempt?.selectedOption === index : currentSelection === index;
                  return (
                    <label
                      key={`${question.id}-${index}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${selected ? 'border-sky-300 bg-sky-50' : 'border-gray-200 hover:bg-gray-50'} ${hasAttempt ? 'cursor-default' : ''}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={selected}
                        disabled={hasAttempt}
                        onChange={() => setSelectedOptions((current) => ({ ...current, [question.id]: index }))}
                        className="mt-1"
                      />
                      <span className="text-sm leading-6 text-gray-700">{option}</span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!hasAttempt ? (
                  <button
                    type="button"
                    disabled={currentSelection === undefined || submittingId === question.id}
                    onClick={() => void submitAnswer(question.id)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingId === question.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />}
                    Kirim Jawaban
                  </button>
                ) : null}

                {hasAttempt && question.explanation ? (
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${question.attempt?.isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                    <span className="font-semibold">Penjelasan:</span> {question.explanation}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {answeredCount === data.questions.length ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Ringkasan Hasil Quiz</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Kamu menjawab benar {correctCount} dari {data.questions.length} soal dengan skor {scorePercentage}%.
            {scorePercentage >= 80
              ? ' Hasil ini sudah melewati ambang kelulusan 80%.'
              : ' Nilai minimum kelulusan adalah 80%, jadi sebaiknya review lesson pada modul ini lalu ulangi quiz.'}
          </p>
          <div className="mt-5">
            <Link
              href={`/academy/courses/${params.courseId}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Kembali ke halaman course
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
