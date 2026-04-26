/* eslint-disable no-console */
const { config } = require('dotenv');
const postgres = require('postgres');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const TARGET_CLERK_USER_ID = 'user_3CctW2LZHDTeulgARCBqaww7Xql';
const TARGET_EMAIL = 'lioo.io1521@gmail.com';

const baseDocumentSeeds = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    filename: 'Nota-Dinas-Renstra-Q1-2026.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 842_144,
    status: 'reviewed',
    typoCount: 5,
    ambiguousCount: 3,
    createdAt: '2026-01-06T08:12:00+07:00',
    analyzedAt: '2026-01-06T08:18:00+07:00',
    actualAutomationMinutes: 5,
    summary:
      'AI membantu merapikan istilah program kerja, konsistensi penulisan singkatan, dan frasa yang berpotensi multi-tafsir sebelum nota dinas diajukan ke pimpinan.',
    findings: [
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Halaman 1, paragraf 2',
        originalText: 'stratgei',
        suggestedText: 'strategi',
        explanation: 'Typo pada kata kunci yang memengaruhi profesionalitas dokumen.',
        confidence: 0.98,
      },
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Halaman 2, poin 3',
        originalText: 'segera ditindaklanjuti',
        suggestedText: 'ditindaklanjuti paling lambat 20 Januari 2026',
        explanation: 'Perlu tenggat yang lebih spesifik agar instruksi tidak multitafsir.',
        confidence: 0.91,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    filename: 'Draft-Surat-Undangan-Rapat-Kinerja.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 624_221,
    status: 'reviewed',
    typoCount: 4,
    ambiguousCount: 2,
    createdAt: '2026-01-09T13:42:00+07:00',
    analyzedAt: '2026-01-09T13:47:00+07:00',
    actualAutomationMinutes: 4,
    summary:
      'AI mengoreksi kesalahan penanggalan, sapaan resmi, dan kalimat agenda rapat agar lebih ringkas serta sesuai format surat undangan pimpinan.',
    findings: [
      {
        kind: 'typo',
        severity: 'high',
        locationHint: 'Header surat',
        originalText: 'Januarri',
        suggestedText: 'Januari',
        explanation: 'Kesalahan bulan pada surat resmi perlu dibetulkan sebelum distribusi.',
        confidence: 0.99,
      },
      {
        kind: 'ambiguous',
        severity: 'low',
        locationHint: 'Agenda rapat',
        originalText: 'pembahasan isu strategis',
        suggestedText: 'pembahasan evaluasi kinerja triwulan IV 2025 dan target triwulan I 2026',
        explanation: 'Agenda diperjelas agar peserta menyiapkan bahan yang tepat.',
        confidence: 0.88,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    filename: 'Konsep-Memo-Perjalanan-Dinas-Februari.pdf',
    fileType: 'application/pdf',
    fileSize: 1_242_311,
    status: 'reviewed',
    typoCount: 6,
    ambiguousCount: 4,
    createdAt: '2026-01-15T09:05:00+07:00',
    analyzedAt: '2026-01-15T09:12:00+07:00',
    actualAutomationMinutes: 5,
    summary:
      'AI menandai ketidakkonsistenan nama kota, jadwal keberangkatan, dan detail lampiran biaya perjalanan dinas.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Lampiran biaya',
        originalText: 'akomodasi disesuaikan',
        suggestedText: 'akomodasi maksimal sesuai SBM perjalanan dinas regional Jawa Barat',
        explanation: 'Rincian biaya harus tegas untuk mencegah interpretasi berbeda.',
        confidence: 0.92,
      },
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Paragraf 3',
        originalText: 'berangakat',
        suggestedText: 'berangkat',
        explanation: 'Typo pada jadwal perjalanan.',
        confidence: 0.97,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    filename: 'Laporan-Monitoring-Media-Januari-2026.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 1_118_000,
    status: 'reviewed',
    typoCount: 7,
    ambiguousCount: 3,
    createdAt: '2026-01-22T16:10:00+07:00',
    analyzedAt: '2026-01-22T16:17:00+07:00',
    actualAutomationMinutes: 6,
    summary:
      'AI membantu menyamakan istilah isu media, memperjelas rekomendasi tindak lanjut, dan merapikan ejaan nama program.',
    findings: [
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Tabel ringkasan isu',
        originalText: 'reputasii',
        suggestedText: 'reputasi',
        explanation: 'Kesalahan ejaan pada label kategori isu.',
        confidence: 0.98,
      },
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Rekomendasi nomor 2',
        originalText: 'koordinasi lanjutan segera dilakukan',
        suggestedText: 'koordinasi lanjutan dilakukan oleh Tim Komunikasi paling lambat 25 Januari 2026',
        explanation: 'Perlu PIC dan tenggat yang jelas.',
        confidence: 0.9,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    filename: 'Draft-Sambutan-Forum-Kolaborasi-Digital.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 557_920,
    status: 'reviewed',
    typoCount: 3,
    ambiguousCount: 2,
    createdAt: '2026-01-28T10:28:00+07:00',
    analyzedAt: '2026-01-28T10:33:00+07:00',
    actualAutomationMinutes: 4,
    summary:
      'AI menyisir gaya bahasa sambutan agar lebih formal, padat, dan konsisten dengan tema kolaborasi digital lintas unit.',
    findings: [
      {
        kind: 'typo',
        severity: 'low',
        locationHint: 'Pembuka',
        originalText: 'hadirin sekalia',
        suggestedText: 'hadirin sekalian',
        explanation: 'Typo ringan pada salam pembuka.',
        confidence: 0.96,
      },
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Penutup',
        originalText: 'mari bergerak bersama',
        suggestedText: 'mari bergerak bersama melalui agenda percepatan digitalisasi layanan internal sepanjang 2026',
        explanation: 'Ajakan dibuat lebih spesifik agar selaras dengan konteks forum.',
        confidence: 0.87,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    filename: 'Telaah-Staf-Penguatan-Layanan-Publik-Feb-2026.pdf',
    fileType: 'application/pdf',
    fileSize: 1_485_900,
    status: 'reviewed',
    typoCount: 8,
    ambiguousCount: 5,
    createdAt: '2026-02-03T09:14:00+07:00',
    analyzedAt: '2026-02-03T09:22:00+07:00',
    actualAutomationMinutes: 6,
    summary:
      'AI memperjelas rekomendasi prioritas layanan, menandai istilah yang tumpang tindih, dan mengoreksi ejaan istilah birokrasi.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Bab rekomendasi',
        originalText: 'prioritas tinggi',
        suggestedText: 'prioritas tinggi untuk digitalisasi alur persetujuan layanan front office pada Februari-Maret 2026',
        explanation: 'Frasa prioritas tinggi perlu ruang lingkup pelaksanaan yang jelas.',
        confidence: 0.93,
      },
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Bab latar belakang',
        originalText: 'koordinassi',
        suggestedText: 'koordinasi',
        explanation: 'Typo pada istilah inti dokumen.',
        confidence: 0.99,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000007',
    filename: 'Draft-Perjanjian-Kerja-Sama-Event-Maret-2026.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 1_032_221,
    status: 'reviewed',
    typoCount: 6,
    ambiguousCount: 4,
    createdAt: '2026-02-07T14:04:00+07:00',
    analyzedAt: '2026-02-07T14:10:00+07:00',
    actualAutomationMinutes: 5,
    summary:
      'AI mengidentifikasi klausul yang multitafsir, ketidakkonsistenan nama pihak, serta typo pada pasal kewajiban para pihak.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Pasal 4',
        originalText: 'dukungan sesuai kebutuhan kegiatan',
        suggestedText: 'dukungan venue, publikasi, dan dokumentasi sesuai daftar lampiran kerja sama',
        explanation: 'Objek dukungan harus terdefinisi rinci dalam dokumen kerja sama.',
        confidence: 0.95,
      },
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Pasal 2',
        originalText: 'pehak kedua',
        suggestedText: 'pihak kedua',
        explanation: 'Typo pada istilah legal formal.',
        confidence: 0.98,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000008',
    filename: 'Bahan-Executive-Brief-Investor-Visit.pdf',
    fileType: 'application/pdf',
    fileSize: 2_024_118,
    status: 'reviewed',
    typoCount: 4,
    ambiguousCount: 6,
    createdAt: '2026-02-12T11:38:00+07:00',
    analyzedAt: '2026-02-12T11:45:00+07:00',
    actualAutomationMinutes: 5,
    summary:
      'AI membantu mempertajam executive brief dengan penjelasan capaian, jadwal kunjungan, dan daftar isu yang harus diantisipasi pimpinan.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Bagian talking points',
        originalText: 'beberapa investasi strategis',
        suggestedText: 'investasi strategis pada pengembangan pusat data, energi hijau, dan ekosistem logistik',
        explanation: 'Talking points perlu rinci agar pimpinan siap menjawab pertanyaan inti.',
        confidence: 0.94,
      },
      {
        kind: 'typo',
        severity: 'low',
        locationHint: 'Jadwal kunjungan',
        originalText: 'Pukul 09.0',
        suggestedText: 'Pukul 09.00',
        explanation: 'Format waktu belum konsisten.',
        confidence: 0.97,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000009',
    filename: 'Materi-Paparan-Quick-Wins-Transformasi.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 909_440,
    status: 'reviewed',
    typoCount: 5,
    ambiguousCount: 5,
    createdAt: '2026-02-19T08:57:00+07:00',
    analyzedAt: '2026-02-19T09:03:00+07:00',
    actualAutomationMinutes: 4,
    summary:
      'AI merapikan terminologi quick wins, memperjelas indikator keberhasilan, dan mengoreksi sejumlah inkonsistensi format slide paparan.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Slide target',
        originalText: 'peningkatan layanan signifikan',
        suggestedText: 'peningkatan SLA layanan administratif sebesar minimal 25% pada akhir Maret 2026',
        explanation: 'Target kinerja perlu kuantifikasi.',
        confidence: 0.91,
      },
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Slide pembuka',
        originalText: 'trasnformasi',
        suggestedText: 'transformasi',
        explanation: 'Typo pada judul utama presentasi.',
        confidence: 0.99,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000010',
    filename: 'Rekapitulasi-Tindak-Lanjut-Audiensi-Internal.xlsx.pdf',
    fileType: 'application/pdf',
    fileSize: 1_318_772,
    status: 'reviewed',
    typoCount: 3,
    ambiguousCount: 4,
    createdAt: '2026-02-25T15:31:00+07:00',
    analyzedAt: '2026-02-25T15:35:00+07:00',
    actualAutomationMinutes: 4,
    summary:
      'AI membantu memeriksa ringkasan hasil audiensi internal, terutama konsistensi status tindak lanjut, PIC, dan terminologi unit kerja.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Kolom status',
        originalText: 'monitoring',
        suggestedText: 'monitoring mingguan oleh Sekretariat Program hingga 31 Maret 2026',
        explanation: 'Status perlu menjelaskan ritme tindak lanjut.',
        confidence: 0.89,
      },
      {
        kind: 'typo',
        severity: 'low',
        locationHint: 'Kolom unit',
        originalText: 'Operasioal',
        suggestedText: 'Operasional',
        explanation: 'Typo nama unit kerja.',
        confidence: 0.98,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000011',
    filename: 'Draft-FAQ-Layanan-Pimpinan-Maret.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 710_552,
    status: 'reviewed',
    typoCount: 4,
    ambiguousCount: 3,
    createdAt: '2026-03-03T09:26:00+07:00',
    analyzedAt: '2026-03-03T09:31:00+07:00',
    actualAutomationMinutes: 4,
    summary:
      'AI menata ulang jawaban FAQ agar lebih lugas, konsisten, dan sesuai kebutuhan komunikasi layanan pimpinan.',
    findings: [
      {
        kind: 'typo',
        severity: 'low',
        locationHint: 'FAQ nomor 2',
        originalText: 'permohonon',
        suggestedText: 'permohonan',
        explanation: 'Typo umum pada teks layanan.',
        confidence: 0.97,
      },
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'FAQ nomor 5',
        originalText: 'akan diproses sesuai ketentuan',
        suggestedText: 'akan diproses maksimal 2 hari kerja sesuai SOP layanan pimpinan',
        explanation: 'Jawaban dibuat lebih operasional bagi pengguna.',
        confidence: 0.9,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000012',
    filename: 'Ringkasan-Kunjungan-Kerja-Kabupaten-Maret.pdf',
    fileType: 'application/pdf',
    fileSize: 1_771_090,
    status: 'reviewed',
    typoCount: 7,
    ambiguousCount: 4,
    createdAt: '2026-03-10T18:02:00+07:00',
    analyzedAt: '2026-03-10T18:10:00+07:00',
    actualAutomationMinutes: 6,
    summary:
      'AI mengoreksi ringkasan kunjungan kerja, terutama detail lokasi, hasil temuan lapangan, dan komitmen tindak lanjut lintas perangkat daerah.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Bagian komitmen',
        originalText: 'perbaikan dilakukan secepatnya',
        suggestedText: 'perbaikan dilakukan oleh tim teknis daerah paling lambat 31 Maret 2026',
        explanation: 'Komitmen lapangan perlu memiliki tenggat dan penanggung jawab.',
        confidence: 0.92,
      },
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Ringkasan lokasi',
        originalText: 'Cireon',
        suggestedText: 'Cirebon',
        explanation: 'Typo nama daerah pada laporan resmi.',
        confidence: 0.99,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000013',
    filename: 'Konsep-Surat-Tindak-Lanjut-Investasi-Q1.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 688_930,
    status: 'reviewed',
    typoCount: 5,
    ambiguousCount: 4,
    createdAt: '2026-03-14T10:48:00+07:00',
    analyzedAt: '2026-03-14T10:54:00+07:00',
    actualAutomationMinutes: 5,
    summary:
      'AI memeriksa konsistensi referensi rapat, nomor dokumen, dan kejelasan instruksi tindak lanjut investasi prioritas.',
    findings: [
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Nomor lampiran',
        originalText: '03/INV/20226',
        suggestedText: '03/INV/2026',
        explanation: 'Nomor tahun pada lampiran salah ketik.',
        confidence: 0.98,
      },
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Paragraf penutup',
        originalText: 'dimohon langkah yang diperlukan',
        suggestedText: 'dimohon langkah koordinasi teknis dan penyampaian rencana aksi paling lambat 20 Maret 2026',
        explanation: 'Instruksi dibuat lebih jelas dan terukur.',
        confidence: 0.9,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000014',
    filename: 'Bahan-Briefing-Rapat-Pimpinan-Akhir-Q1.pdf',
    fileType: 'application/pdf',
    fileSize: 2_225_144,
    status: 'reviewed',
    typoCount: 6,
    ambiguousCount: 6,
    createdAt: '2026-03-21T07:54:00+07:00',
    analyzedAt: '2026-03-21T08:02:00+07:00',
    actualAutomationMinutes: 6,
    summary:
      'AI memperjelas highlight capaian triwulan I, isu strategis untuk dibawa ke rapat pimpinan, serta rekomendasi akselerasi triwulan II.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Slide rekomendasi',
        originalText: 'perlu akselerasi lintas unit',
        suggestedText: 'perlu akselerasi lintas unit pada digitalisasi agenda, pengendalian CTA, dan review dokumen prioritas mulai April 2026',
        explanation: 'Rekomendasi dibuat konkret agar mudah diputuskan pimpinan.',
        confidence: 0.94,
      },
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Slide capaian',
        originalText: 'optmialisasi',
        suggestedText: 'optimalisasi',
        explanation: 'Typo pada poin capaian utama.',
        confidence: 0.98,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000015',
    filename: 'Draft-Surat-Apresiasi-Mitra-Kolaborasi.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 541_300,
    status: 'reviewed',
    typoCount: 3,
    ambiguousCount: 2,
    createdAt: '2026-03-27T16:22:00+07:00',
    analyzedAt: '2026-03-27T16:26:00+07:00',
    actualAutomationMinutes: 3,
    summary:
      'AI merapikan diksi formal surat apresiasi dan memastikan nama lembaga mitra serta program kolaborasi konsisten di seluruh naskah.',
    findings: [
      {
        kind: 'typo',
        severity: 'low',
        locationHint: 'Paragraf 1',
        originalText: 'kerjasama',
        suggestedText: 'kerja sama',
        explanation: 'Perbaikan bentuk baku sesuai kaidah bahasa Indonesia.',
        confidence: 0.96,
      },
      {
        kind: 'ambiguous',
        severity: 'low',
        locationHint: 'Penutup',
        originalText: 'kolaborasi selanjutnya',
        suggestedText: 'kolaborasi pengembangan program literasi digital tahap berikutnya',
        explanation: 'Kalimat penutup dibuat lebih spesifik.',
        confidence: 0.86,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000016',
    filename: 'Laporan-Ringkas-Monitoring-April-Week-2.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 799_210,
    status: 'reviewed',
    typoCount: 4,
    ambiguousCount: 3,
    createdAt: '2026-04-08T09:18:00+07:00',
    analyzedAt: '2026-04-08T09:23:00+07:00',
    actualAutomationMinutes: 4,
    summary:
      'AI tetap dipakai pada April untuk menjaga kualitas laporan monitoring mingguan dan mempercepat finalisasi bahan pimpinan.',
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Bagian rekomendasi',
        originalText: 'perlu dikawal',
        suggestedText: 'perlu dikawal oleh Sekretariat Monitoring melalui review mingguan setiap Jumat',
        explanation: 'Arahan tindak lanjut diperjelas.',
        confidence: 0.89,
      },
    ],
  },
  {
    id: '11111111-1111-4111-8111-000000000017',
    filename: 'Konsep-Nota-Dinas-Percepatan-April.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 655_420,
    status: 'reviewed',
    typoCount: 5,
    ambiguousCount: 4,
    createdAt: '2026-04-17T14:09:00+07:00',
    analyzedAt: '2026-04-17T14:15:00+07:00',
    actualAutomationMinutes: 5,
    summary:
      'AI terus digunakan untuk menyisir nota dinas percepatan program April agar ritme kerja setelah Q1 tetap efisien.',
    findings: [
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Paragraf utama',
        originalText: 'implentasi',
        suggestedText: 'implementasi',
        explanation: 'Typo pada istilah program.',
        confidence: 0.98,
      },
    ],
  },
];

const baseMeetingSeeds = [
  {
    id: '22222222-2222-4222-8222-000000000001',
    title: 'Rapat Koordinasi Kickoff Program Kerja 2026',
    meetingDate: '2026-01-07',
    filename: 'Notula-Kickoff-Program-Kerja-2026.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 748_000,
    participantsCount: 12,
    participantsEmails: ['sekretariat@instansi.go.id', 'program@instansi.go.id', 'planning@instansi.go.id'],
    status: 'distributed',
    typoCount: 4,
    ambiguousCount: 3,
    ctaCount: 4,
    createdAt: '2026-01-07T15:20:00+07:00',
    analyzedAt: '2026-01-07T15:28:00+07:00',
    correctedAt: '2026-01-07T15:40:00+07:00',
    distributedAt: '2026-01-07T16:05:00+07:00',
    actualAutomationMinutes: 10,
    findings: [
      {
        kind: 'typo',
        severity: 'medium',
        locationHint: 'Poin keputusan 2',
        originalText: 'penganggaran',
        suggestedText: 'penganggaran',
        explanation: 'Penyesuaian minor pada penulisan keputusan rapat.',
      },
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Tindak lanjut',
        originalText: 'siapkan matriks monitoring',
        suggestedText: 'siapkan matriks monitoring Q1 paling lambat 10 Januari 2026',
        explanation: 'Tindak lanjut perlu tenggat jelas.',
      },
    ],
    approvedIndices: [0, 1],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000001',
        title: 'Matriks monitoring Q1 2026',
        action: 'Susun matriks monitoring program prioritas dan distribusikan ke seluruh unit pendukung.',
        picName: 'Rina Kurnia',
        unit: 'Sekretariat Program',
        deadline: '2026-01-10',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000002',
        title: 'Sinkronisasi agenda pimpinan',
        action: 'Sinkronkan agenda rapat pimpinan triwulan I ke kalender bersama sekretariat.',
        picName: 'Aldi Saputra',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-01-11',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000003',
        title: 'Ringkasan target per unit',
        action: 'Konsolidasikan target unit kerja dan siapkan ringkasan satu halaman untuk pimpinan.',
        picName: 'Mira Lestari',
        unit: 'Perencanaan',
        deadline: '2026-01-12',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000004',
        title: 'Template evaluasi mingguan',
        action: 'Buat template evaluasi mingguan yang dipakai seluruh koordinator program.',
        picName: 'Dimas Rahman',
        unit: 'PMO',
        deadline: '2026-01-14',
        priority: 'medium',
        status: 'in-progress',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000002',
    title: 'Rapat Evaluasi Komunikasi Publik Januari',
    meetingDate: '2026-01-20',
    filename: 'Notula-Evaluasi-Komunikasi-Publik.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 822_300,
    participantsCount: 9,
    participantsEmails: ['humas@instansi.go.id', 'media@instansi.go.id'],
    status: 'distributed',
    typoCount: 5,
    ambiguousCount: 2,
    ctaCount: 3,
    createdAt: '2026-01-20T17:05:00+07:00',
    analyzedAt: '2026-01-20T17:12:00+07:00',
    correctedAt: '2026-01-20T17:20:00+07:00',
    distributedAt: '2026-01-20T17:45:00+07:00',
    actualAutomationMinutes: 9,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Poin media handling',
        originalText: 'perkuat respons cepat',
        suggestedText: 'perkuat respons cepat maksimal 30 menit untuk isu prioritas tinggi',
        explanation: 'SLA respons perlu dibuat eksplisit.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000005',
        title: 'Playbook respons isu media',
        action: 'Finalkan playbook respons isu media prioritas dan validasi dengan pimpinan.',
        picName: 'Nadia Permata',
        unit: 'Humas',
        deadline: '2026-01-23',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000006',
        title: 'Daftar juru bicara cadangan',
        action: 'Susun daftar juru bicara cadangan per isu strategis untuk semester I.',
        picName: 'Roni Setiawan',
        unit: 'Komunikasi Publik',
        deadline: '2026-01-26',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000007',
        title: 'Monitoring harian media',
        action: 'Implementasikan monitoring harian media dengan format dashboard singkat.',
        picName: 'Salsa Nur',
        unit: 'Media Monitoring',
        deadline: '2026-01-22',
        priority: 'medium',
        status: 'in-progress',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000003',
    title: 'Rapat Sinkronisasi Agenda Pimpinan Februari',
    meetingDate: '2026-02-02',
    filename: 'Notula-Sinkronisasi-Agenda-Februari.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 695_200,
    participantsCount: 8,
    participantsEmails: ['agenda@instansi.go.id', 'protokol@instansi.go.id'],
    status: 'distributed',
    typoCount: 3,
    ambiguousCount: 3,
    ctaCount: 4,
    createdAt: '2026-02-02T10:30:00+07:00',
    analyzedAt: '2026-02-02T10:36:00+07:00',
    correctedAt: '2026-02-02T10:44:00+07:00',
    distributedAt: '2026-02-02T11:05:00+07:00',
    actualAutomationMinutes: 8,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Agenda kunjungan',
        originalText: 'opsi cadangan disiapkan',
        suggestedText: 'opsi cadangan lokasi dan rundown disiapkan H-2 sebelum kegiatan',
        explanation: 'Langkah mitigasi harus lebih jelas.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000008',
        title: 'Rundown kunjungan investor',
        action: 'Siapkan rundown detail kunjungan investor termasuk jalur protokoler.',
        picName: 'Tia Maharani',
        unit: 'Protokol',
        deadline: '2026-02-05',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000009',
        title: 'Agenda cadangan pimpinan',
        action: 'Susun agenda cadangan untuk dua slot yang masih tentative pada minggu kedua Februari.',
        picName: 'Aji Nugroho',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-02-04',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000010',
        title: 'Daftar tamu prioritas',
        action: 'Finalkan daftar tamu prioritas dan kebutuhan hospitality untuk setiap agenda.',
        picName: 'Sinta Ayu',
        unit: 'Protokol',
        deadline: '2026-02-06',
        priority: 'medium',
        status: 'in-progress',
      },
      {
        id: '33333333-3333-4333-8333-000000000011',
        title: 'Briefing singkat pimpinan',
        action: 'Buat briefing singkat 1 halaman untuk agenda eksternal prioritas.',
        picName: 'Rika Amalia',
        unit: 'Sekretariat Program',
        deadline: '2026-02-07',
        priority: 'high',
        status: 'completed',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000004',
    title: 'Rapat Tindak Lanjut Kunjungan Investor',
    meetingDate: '2026-02-11',
    filename: 'Notula-Tindak-Lanjut-Kunjungan-Investor.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 934_440,
    participantsCount: 11,
    participantsEmails: ['investasi@instansi.go.id', 'legal@instansi.go.id', 'biro@instansi.go.id'],
    status: 'approved',
    typoCount: 6,
    ambiguousCount: 4,
    ctaCount: 5,
    createdAt: '2026-02-11T16:18:00+07:00',
    analyzedAt: '2026-02-11T16:28:00+07:00',
    correctedAt: '2026-02-11T16:45:00+07:00',
    distributedAt: null,
    actualAutomationMinutes: 11,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Keputusan 1',
        originalText: 'tim investasi menyusun tindak lanjut',
        suggestedText: 'tim investasi menyusun daftar tindak lanjut dan penanggung jawab per komitmen investor',
        explanation: 'Keputusan perlu rincian output dan PIC.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000012',
        title: 'Daftar komitmen investor',
        action: 'Susun daftar komitmen investor beserta status tindak lanjut internal.',
        picName: 'Hendra Wirawan',
        unit: 'Investasi',
        deadline: '2026-02-14',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000013',
        title: 'Review legal draft kerja sama',
        action: 'Koordinasikan review legal draft kerja sama untuk dua investor prioritas.',
        picName: 'Meyta Sari',
        unit: 'Legal',
        deadline: '2026-02-18',
        priority: 'high',
        status: 'in-progress',
      },
      {
        id: '33333333-3333-4333-8333-000000000014',
        title: 'Peta eskalasi isu',
        action: 'Buat peta eskalasi isu yang membutuhkan keputusan pimpinan pada akhir Februari.',
        picName: 'Fauzan Akbar',
        unit: 'PMO',
        deadline: '2026-02-20',
        priority: 'medium',
        status: 'pending',
      },
      {
        id: '33333333-3333-4333-8333-000000000015',
        title: 'Progress update mingguan',
        action: 'Kirim progress update mingguan ke sekretaris pimpinan setiap Jumat sore.',
        picName: 'Yuni Kartika',
        unit: 'Sekretariat Investasi',
        deadline: '2026-02-13',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000016',
        title: 'Bahan briefing lanjutan',
        action: 'Siapkan bahan briefing lanjutan untuk rapat follow-up bersama pimpinan.',
        picName: 'Dian Puspita',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-02-17',
        priority: 'medium',
        status: 'in-progress',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000005',
    title: 'Rapat Monitoring Program Prioritas Minggu II Februari',
    meetingDate: '2026-02-18',
    filename: 'Notula-Monitoring-Program-Prioritas-Feb-II.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 881_330,
    participantsCount: 10,
    participantsEmails: ['monitoring@instansi.go.id', 'program@instansi.go.id'],
    status: 'distributed',
    typoCount: 5,
    ambiguousCount: 5,
    ctaCount: 4,
    createdAt: '2026-02-18T18:12:00+07:00',
    analyzedAt: '2026-02-18T18:20:00+07:00',
    correctedAt: '2026-02-18T18:32:00+07:00',
    distributedAt: '2026-02-18T18:50:00+07:00',
    actualAutomationMinutes: 10,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Poin monitoring',
        originalText: 'perlu pendalaman',
        suggestedText: 'perlu pendalaman akar masalah keterlambatan pengadaan oleh unit terkait',
        explanation: 'Kesimpulan monitoring perlu lebih operasional.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000017',
        title: 'Analisis akar masalah pengadaan',
        action: 'Susun analisis akar masalah pengadaan dan opsi mitigasinya.',
        picName: 'Farah Nabila',
        unit: 'Pengadaan',
        deadline: '2026-02-21',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000018',
        title: 'Dashboard keterlambatan program',
        action: 'Bangun dashboard sederhana untuk memonitor milestone program yang meleset.',
        picName: 'Iqbal Ramadhan',
        unit: 'PMO',
        deadline: '2026-02-24',
        priority: 'medium',
        status: 'in-progress',
      },
      {
        id: '33333333-3333-4333-8333-000000000019',
        title: 'Rekomendasi percepatan',
        action: 'Siapkan rekomendasi percepatan untuk tiga program prioritas tertinggi.',
        picName: 'Nisa Maharani',
        unit: 'Perencanaan',
        deadline: '2026-02-23',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000020',
        title: 'Brief pimpinan pekanan',
        action: 'Kirim brief mingguan yang menyoroti deviasi target dan isu eskalasi.',
        picName: 'Yoga Pratama',
        unit: 'Sekretariat Program',
        deadline: '2026-02-20',
        priority: 'medium',
        status: 'completed',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000006',
    title: 'Rapat Persiapan Forum Kolaborasi Digital',
    meetingDate: '2026-03-04',
    filename: 'Notula-Persiapan-Forum-Kolaborasi-Digital.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 790_240,
    participantsCount: 14,
    participantsEmails: ['event@instansi.go.id', 'digital@instansi.go.id', 'humas@instansi.go.id'],
    status: 'distributed',
    typoCount: 4,
    ambiguousCount: 3,
    ctaCount: 5,
    createdAt: '2026-03-04T11:45:00+07:00',
    analyzedAt: '2026-03-04T11:52:00+07:00',
    correctedAt: '2026-03-04T12:05:00+07:00',
    distributedAt: '2026-03-04T12:25:00+07:00',
    actualAutomationMinutes: 9,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Agenda forum',
        originalText: 'pembicara utama dikonfirmasi',
        suggestedText: 'pembicara utama dikonfirmasi oleh tim event maksimal H-7 sebelum acara',
        explanation: 'Instruksi follow-up dibuat lebih terukur.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000021',
        title: 'Konfirmasi keynote speaker',
        action: 'Finalkan konfirmasi keynote speaker dan kebutuhan protokoler acara.',
        picName: 'Alya Putri',
        unit: 'Event Management',
        deadline: '2026-03-08',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000022',
        title: 'Materi publikasi forum',
        action: 'Siapkan materi publikasi forum untuk kanal internal dan eksternal.',
        picName: 'Raka Mahesa',
        unit: 'Humas',
        deadline: '2026-03-09',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000023',
        title: 'Rundown teknis acara',
        action: 'Susun rundown teknis lengkap termasuk simulasi perpindahan sesi.',
        picName: 'Nindi Safitri',
        unit: 'Event Management',
        deadline: '2026-03-10',
        priority: 'high',
        status: 'in-progress',
      },
      {
        id: '33333333-3333-4333-8333-000000000024',
        title: 'Daftar peserta undangan',
        action: 'Validasi daftar peserta undangan prioritas dan kebutuhan VIP seating.',
        picName: 'Bagas Wibowo',
        unit: 'Protokol',
        deadline: '2026-03-11',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000025',
        title: 'Brief pimpinan forum',
        action: 'Siapkan brief pimpinan satu halaman untuk pembukaan forum.',
        picName: 'Sarah Luthfi',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-03-12',
        priority: 'high',
        status: 'completed',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000007',
    title: 'Rapat Evaluasi Tengah Triwulan I',
    meetingDate: '2026-03-13',
    filename: 'Notula-Evaluasi-Tengah-Triwulan-I.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 968_550,
    participantsCount: 13,
    participantsEmails: ['sekretariat@instansi.go.id', 'pmo@instansi.go.id', 'monitoring@instansi.go.id'],
    status: 'approved',
    typoCount: 6,
    ambiguousCount: 5,
    ctaCount: 6,
    createdAt: '2026-03-13T17:15:00+07:00',
    analyzedAt: '2026-03-13T17:24:00+07:00',
    correctedAt: '2026-03-13T17:36:00+07:00',
    distributedAt: null,
    actualAutomationMinutes: 12,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'high',
        locationHint: 'Kesimpulan rapat',
        originalText: 'fokus pembenahan area kritis',
        suggestedText: 'fokus pembenahan area kritis pada disiplin tindak lanjut, kelengkapan dokumen, dan kualitas briefing pimpinan',
        explanation: 'Kesimpulan dibuat lebih spesifik agar mudah dieksekusi.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000026',
        title: 'Audit cepat CTA outstanding',
        action: 'Lakukan audit cepat terhadap CTA outstanding dan kirimkan daftarnya ke PMO.',
        picName: 'Mia Andini',
        unit: 'PMO',
        deadline: '2026-03-16',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000027',
        title: 'Review kualitas briefing pimpinan',
        action: 'Evaluasi format briefing pimpinan dan rekomendasikan standar minimum baru.',
        picName: 'Rizky Adi',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-03-18',
        priority: 'high',
        status: 'in-progress',
      },
      {
        id: '33333333-3333-4333-8333-000000000028',
        title: 'Daftar backlog dokumen prioritas',
        action: 'Susun daftar backlog dokumen prioritas yang perlu diselesaikan sebelum akhir Maret.',
        picName: 'Wulan Prameswari',
        unit: 'Sekretariat Program',
        deadline: '2026-03-17',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000029',
        title: 'Rencana percepatan mingguan',
        action: 'Siapkan rencana percepatan mingguan untuk area dengan deviasi tertinggi.',
        picName: 'Moch. Arif',
        unit: 'Perencanaan',
        deadline: '2026-03-19',
        priority: 'medium',
        status: 'pending',
      },
      {
        id: '33333333-3333-4333-8333-000000000030',
        title: 'Brief evaluasi pimpinan',
        action: 'Kirim brief evaluasi singkat ke pimpinan setiap Senin pagi selama sisa triwulan.',
        picName: 'Lina Septiani',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-03-16',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000031',
        title: 'Checklist kelengkapan dokumen',
        action: 'Perbarui checklist kelengkapan dokumen yang dipakai sebelum briefing.',
        picName: 'Bayu Aditama',
        unit: 'Administrasi',
        deadline: '2026-03-20',
        priority: 'medium',
        status: 'in-progress',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000008',
    title: 'Rapat Finalisasi Briefing Akhir Triwulan I',
    meetingDate: '2026-03-24',
    filename: 'Notula-Finalisasi-Briefing-Akhir-Q1.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 1_044_320,
    participantsCount: 7,
    participantsEmails: ['sekretariat@instansi.go.id', 'briefing@instansi.go.id'],
    status: 'distributed',
    typoCount: 4,
    ambiguousCount: 4,
    ctaCount: 4,
    createdAt: '2026-03-24T19:02:00+07:00',
    analyzedAt: '2026-03-24T19:10:00+07:00',
    correctedAt: '2026-03-24T19:22:00+07:00',
    distributedAt: '2026-03-24T19:40:00+07:00',
    actualAutomationMinutes: 9,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Poin arahan pimpinan',
        originalText: 'ditegaskan kembali',
        suggestedText: 'ditegaskan kembali dalam briefing akhir triwulan yang akan dibagikan pada 25 Maret 2026',
        explanation: 'Acuan waktu perlu ditegaskan.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000032',
        title: 'Final deck briefing Q1',
        action: 'Finalkan deck briefing akhir Q1 dengan sorotan capaian dan risiko.',
        picName: 'Anita Putri',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-03-25',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000033',
        title: 'Lampiran data dukung',
        action: 'Lengkapi lampiran data dukung untuk semua indikator prioritas.',
        picName: 'Rifki Hidayat',
        unit: 'Data & Monitoring',
        deadline: '2026-03-26',
        priority: 'medium',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000034',
        title: 'Daftar isu triwulan II',
        action: 'Susun daftar isu transisi menuju triwulan II sebagai bahan antisipasi pimpinan.',
        picName: 'Helga Paramita',
        unit: 'Perencanaan',
        deadline: '2026-03-27',
        priority: 'high',
        status: 'in-progress',
      },
      {
        id: '33333333-3333-4333-8333-000000000035',
        title: 'Distribusi briefing final',
        action: 'Distribusikan briefing final ke peserta rapat pimpinan inti.',
        picName: 'Gilang Maulana',
        unit: 'Administrasi',
        deadline: '2026-03-25',
        priority: 'medium',
        status: 'completed',
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-000000000009',
    title: 'Rapat Monitoring Awal Triwulan II',
    meetingDate: '2026-04-09',
    filename: 'Notula-Monitoring-Awal-Q2.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 809_210,
    participantsCount: 9,
    participantsEmails: ['monitoring@instansi.go.id', 'pmo@instansi.go.id'],
    status: 'distributed',
    typoCount: 4,
    ambiguousCount: 3,
    ctaCount: 3,
    createdAt: '2026-04-09T10:22:00+07:00',
    analyzedAt: '2026-04-09T10:28:00+07:00',
    correctedAt: '2026-04-09T10:38:00+07:00',
    distributedAt: '2026-04-09T10:55:00+07:00',
    actualAutomationMinutes: 8,
    findings: [
      {
        kind: 'ambiguous',
        severity: 'medium',
        locationHint: 'Agenda transisi',
        originalText: 'lanjutkan inisiatif yang efektif',
        suggestedText: 'lanjutkan inisiatif yang efektif dari Q1 dan ukur dampaknya per minggu pada April 2026',
        explanation: 'Tindak lanjut perlu periodisasi yang jelas.',
      },
    ],
    approvedIndices: [0],
    ctas: [
      {
        id: '33333333-3333-4333-8333-000000000036',
        title: 'Daftar carry-over Q1',
        action: 'Susun daftar carry-over Q1 yang masih membutuhkan pengawalan di awal Q2.',
        picName: 'Nita Cahyani',
        unit: 'PMO',
        deadline: '2026-04-11',
        priority: 'high',
        status: 'completed',
      },
      {
        id: '33333333-3333-4333-8333-000000000037',
        title: 'Update dashboard mingguan',
        action: 'Perbarui dashboard mingguan agar memuat baseline Q1 vs capaian Q2.',
        picName: 'Rangga Putra',
        unit: 'Data & Monitoring',
        deadline: '2026-04-12',
        priority: 'medium',
        status: 'in-progress',
      },
      {
        id: '33333333-3333-4333-8333-000000000038',
        title: 'Briefing transisi pimpinan',
        action: 'Siapkan briefing singkat transisi ke triwulan II untuk pimpinan.',
        picName: 'Dewi Laras',
        unit: 'Sekretariat Pimpinan',
        deadline: '2026-04-10',
        priority: 'medium',
        status: 'completed',
      },
    ],
  },
];

const baseTaskSeeds = [
  ['44444444-4444-4444-8444-000000000001', 'Finalisasi daftar prioritas briefing Januari', 'Sinkronkan prioritas briefing pimpinan dengan agenda kerja minggu pertama.', 'completed', 'high', '2026-01-06T17:00:00+07:00', '2026-01-04T08:20:00+07:00'],
  ['44444444-4444-4444-8444-000000000002', 'Review surat undangan rakor bulanan', 'Pastikan format undangan, lampiran agenda, dan daftar peserta sudah lengkap.', 'completed', 'medium', '2026-01-09T15:00:00+07:00', '2026-01-08T09:10:00+07:00'],
  ['44444444-4444-4444-8444-000000000003', 'Siapkan executive summary kickoff Q1', 'Ringkas hasil kickoff program kerja untuk briefing pimpinan esok hari.', 'completed', 'high', '2026-01-08T09:00:00+07:00', '2026-01-07T16:20:00+07:00'],
  ['44444444-4444-4444-8444-000000000004', 'Koordinasi tindak lanjut media monitoring', 'Kumpulkan update dari tim media untuk laporan mingguan pimpinan.', 'completed', 'medium', '2026-01-23T16:00:00+07:00', '2026-01-21T08:45:00+07:00'],
  ['44444444-4444-4444-8444-000000000005', 'Perbarui checklist dokumen pimpinan', 'Masukkan hasil temuan AI review dokumen ke checklist finalisasi naskah.', 'completed', 'medium', '2026-01-30T14:00:00+07:00', '2026-01-27T10:05:00+07:00'],
  ['44444444-4444-4444-8444-000000000006', 'Buat rekap agenda Februari', 'Susun agenda pimpinan versi mingguan untuk bulan Februari.', 'completed', 'high', '2026-02-01T12:00:00+07:00', '2026-01-30T13:20:00+07:00'],
  ['44444444-4444-4444-8444-000000000007', 'Review bahan investor visit', 'Periksa paparan dan brief kunjungan investor sebelum dikirim ke pimpinan.', 'completed', 'high', '2026-02-12T09:00:00+07:00', '2026-02-10T08:18:00+07:00'],
  ['44444444-4444-4444-8444-000000000008', 'Susun template tindak lanjut rapat', 'Buat format seragam untuk CTA lintas rapat strategis.', 'completed', 'medium', '2026-02-15T17:30:00+07:00', '2026-02-12T11:05:00+07:00'],
  ['44444444-4444-4444-8444-000000000009', 'Kompilasi isu prioritas mingguan', 'Gabungkan isu prioritas dari monitoring program untuk briefing Jumat.', 'completed', 'high', '2026-02-20T12:00:00+07:00', '2026-02-17T09:26:00+07:00'],
  ['44444444-4444-4444-8444-000000000010', 'Siapkan bahan evaluasi tengah triwulan', 'Konsolidasikan deviasi target dan capaian unit kerja.', 'completed', 'high', '2026-03-12T18:00:00+07:00', '2026-03-09T08:10:00+07:00'],
  ['44444444-4444-4444-8444-000000000011', 'Review final deck forum kolaborasi', 'Cek konsistensi data, ejaan, dan alur narasi sebelum gladi.', 'completed', 'medium', '2026-03-10T16:00:00+07:00', '2026-03-08T10:30:00+07:00'],
  ['44444444-4444-4444-8444-000000000012', 'Finalisasi daftar tamu VIP', 'Verifikasi daftar tamu prioritas forum beserta kebutuhan protokoler.', 'completed', 'medium', '2026-03-11T11:00:00+07:00', '2026-03-09T09:15:00+07:00'],
  ['44444444-4444-4444-8444-000000000013', 'Kirim ringkasan CTA outstanding', 'Bagikan ringkasan CTA outstanding ke PMO dan sekretariat pimpinan.', 'completed', 'high', '2026-03-16T09:00:00+07:00', '2026-03-14T08:40:00+07:00'],
  ['44444444-4444-4444-8444-000000000014', 'Susun backlog dokumen prioritas', 'Daftar backlog dokumen yang perlu selesai sebelum akhir Q1.', 'completed', 'high', '2026-03-18T15:00:00+07:00', '2026-03-15T09:50:00+07:00'],
  ['44444444-4444-4444-8444-000000000015', 'Update dashboard mingguan pimpinan', 'Masukkan capaian dan risiko ke dashboard mingguan.', 'completed', 'medium', '2026-03-20T14:30:00+07:00', '2026-03-18T07:55:00+07:00'],
  ['44444444-4444-4444-8444-000000000016', 'Distribusi briefing akhir Q1', 'Kirim briefing final dan lampiran data dukung ke peserta inti.', 'completed', 'high', '2026-03-25T08:00:00+07:00', '2026-03-24T19:15:00+07:00'],
  ['44444444-4444-4444-8444-000000000017', 'Rapat singkat validasi isu triwulan II', 'Validasi isu transisi Q2 dengan PMO dan perencanaan.', 'in-progress', 'medium', '2026-03-27T10:00:00+07:00', '2026-03-25T10:12:00+07:00'],
  ['44444444-4444-4444-8444-000000000018', 'Final check surat apresiasi mitra', 'Periksa surat apresiasi sebelum ditandatangani pimpinan.', 'completed', 'low', '2026-03-28T12:00:00+07:00', '2026-03-27T16:30:00+07:00'],
  ['44444444-4444-4444-8444-000000000019', 'Persiapan monitoring carry-over Q1', 'Siapkan daftar carry-over dan penanggung jawabnya.', 'completed', 'high', '2026-04-09T09:00:00+07:00', '2026-04-07T08:25:00+07:00'],
  ['44444444-4444-4444-8444-000000000020', 'Update baseline dashboard Q2', 'Perbarui baseline capaian dashboard dari angka akhir Q1.', 'in-progress', 'medium', '2026-04-12T17:00:00+07:00', '2026-04-10T10:05:00+07:00'],
  ['44444444-4444-4444-8444-000000000021', 'Susun brief mingguan April', 'Siapkan brief mingguan program percepatan awal triwulan II.', 'todo', 'medium', '2026-04-28T09:00:00+07:00', '2026-04-24T08:40:00+07:00'],
  ['44444444-4444-4444-8444-000000000022', 'Verifikasi tindak lanjut investor', 'Pastikan komitmen investor prioritas sudah memiliki update terbaru.', 'in-progress', 'high', '2026-04-29T15:00:00+07:00', '2026-04-22T11:20:00+07:00'],
];

const Q1_START = '2026-01-01';
const Q1_END = '2026-03-31';
const DOCUMENT_DAILY_TARGETS = [4, 3, 5, 4, 4];
const TASK_DAILY_TARGETS = [7, 6, 8, 5, 9];
const MEETING_TITLE_ROTATION = [
  'Rapat Pimpinan Mingguan',
  'Rapat Sinkronisasi Agenda Pimpinan',
  'Rapat Evaluasi Prioritas Mingguan',
  'Rapat Koordinasi Briefing Pimpinan',
];
const DOCUMENT_TEMPLATE_ROTATION = [
  {
    slug: 'nota-dinas',
    title: 'Nota-Dinas',
    summary: 'AI merapikan struktur narasi, konsistensi istilah, dan kalimat arahan agar siap diajukan ke pimpinan.',
  },
  {
    slug: 'surat-undangan',
    title: 'Draft-Surat-Undangan',
    summary: 'AI mengoreksi tanggal, susunan agenda, dan detail peserta agar surat resmi lebih presisi.',
  },
  {
    slug: 'briefing',
    title: 'Bahan-Briefing',
    summary: 'AI membantu menajamkan poin briefing, menyederhanakan kalimat, dan menjaga konsistensi data dukung.',
  },
  {
    slug: 'laporan',
    title: 'Laporan-Harian',
    summary: 'AI menandai ejaan, istilah ganda, dan rekomendasi tindak lanjut yang masih terlalu umum.',
  },
];
const TASK_TEMPLATE_ROTATION = [
  ['Konfirmasi agenda pimpinan', 'Pastikan agenda, PIC, dan kebutuhan ruang rapat sudah lengkap sebelum dibagikan.'],
  ['Follow up bahan briefing', 'Kumpulkan bahan briefing dari unit terkait dan cek kelengkapan data pendukung.'],
  ['Update daftar tamu prioritas', 'Perbarui daftar tamu, nomor kontak, dan kebutuhan protokoler untuk agenda pimpinan.'],
  ['Rekap tindak lanjut rapat', 'Catat tindak lanjut rapat terakhir dan kirim pengingat ke PIC terkait.'],
  ['Review dokumen masuk', 'Periksa dokumen masuk yang perlu diprioritaskan untuk review pimpinan hari ini.'],
  ['Sinkronkan jadwal harian', 'Cocokkan agenda pimpinan dengan agenda sekretariat dan slot cadangan.'],
];
const CTA_TITLE_ROTATION = [
  ['Kirim brief pimpinan', 'Kirim brief satu halaman ke pimpinan sebelum agenda berikutnya dimulai.'],
  ['Validasi tindak lanjut unit', 'Validasi tindak lanjut unit dan pastikan PIC memahami deadline pekan berjalan.'],
  ['Update dashboard mingguan', 'Perbarui dashboard mingguan dengan progres terbaru dari seluruh agenda prioritas.'],
  ['Siapkan agenda pekan depan', 'Siapkan daftar agenda pekan depan berikut kebutuhan protokoler dan bahan dukung.'],
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function buildJakartaIso(date, hour, minute) {
  return `${dateKey(date)}T${pad(hour)}:${pad(minute)}:00+07:00`;
}

function makeSeedUuid(prefix, index) {
  return `${prefix}${String(index).padStart(12, '0')}`;
}

function enumerateQ1Weekdays() {
  const start = new Date(`${Q1_START}T00:00:00Z`);
  const end = new Date(`${Q1_END}T00:00:00Z`);
  const dates = [];
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) dates.push(new Date(cursor));
  }
  return dates;
}

function countByDate(items, getCreatedAt) {
  return items.reduce((map, item) => {
    const createdAt = new Date(getCreatedAt(item));
    if (createdAt.getMonth() > 2) return map;
    const key = dateKey(createdAt);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
}

function compareCreatedAt(a, b) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function buildGeneratedDocumentSeeds(existingSeeds) {
  const q1Weekdays = enumerateQ1Weekdays();
  const counts = countByDate(existingSeeds, (seed) => seed.createdAt);
  const generated = [];
  let index = 1;

  q1Weekdays.forEach((date, dayIndex) => {
    const target = DOCUMENT_DAILY_TARGETS[dayIndex % DOCUMENT_DAILY_TARGETS.length];
    const existingCount = counts.get(dateKey(date)) ?? 0;
    const missing = Math.max(0, target - existingCount);

    for (let slot = 0; slot < missing; slot += 1) {
      const template = DOCUMENT_TEMPLATE_ROTATION[(dayIndex + slot) % DOCUMENT_TEMPLATE_ROTATION.length];
      const isPdf = (dayIndex + slot) % 3 === 0;
      const hour = 8 + ((slot * 2 + dayIndex) % 8);
      const minute = 10 + ((slot * 13 + dayIndex * 7) % 45);
      const typoCount = 3 + ((dayIndex + slot) % 5);
      const ambiguousCount = 2 + ((dayIndex + slot * 2) % 4);
      const filename = `${template.title}-${template.slug}-${dateKey(date)}-${slot + 1}.${isPdf ? 'pdf' : 'docx'}`;

      generated.push({
        id: makeSeedUuid('11111111-1111-4111-8111-', 100000 + index),
        filename,
        fileType: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 540_000 + ((dayIndex + slot) % 7) * 95_000,
        status: 'reviewed',
        typoCount,
        ambiguousCount,
        createdAt: buildJakartaIso(date, hour, minute),
        analyzedAt: buildJakartaIso(date, hour, minute + 6),
        actualAutomationMinutes: 4 + ((dayIndex + slot) % 3),
        summary: template.summary,
        findings: [
          {
            kind: 'typo',
            severity: typoCount >= 6 ? 'high' : 'medium',
            locationHint: `Halaman ${1 + ((slot + dayIndex) % 3)}, paragraf ${2 + (slot % 3)}`,
            originalText: 'koordinassi',
            suggestedText: 'koordinasi',
            explanation: 'Typo pada istilah kerja harian sekretariat yang perlu dibetulkan sebelum dikirim.',
            confidence: 0.97,
          },
          {
            kind: 'ambiguous',
            severity: ambiguousCount >= 4 ? 'high' : 'medium',
            locationHint: `Poin tindak lanjut ${1 + (slot % 4)}`,
            originalText: 'segera ditindaklanjuti',
            suggestedText: `ditindaklanjuti paling lambat ${dateKey(new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000))}`,
            explanation: 'Instruksi diperjelas dengan tenggat agar tidak multitafsir.',
            confidence: 0.91,
          },
        ],
      });
      index += 1;
    }
  });

  return generated;
}

function buildGeneratedMeetingSeeds() {
  const generated = [];
  const mondayDates = enumerateQ1Weekdays().filter((date) => date.getUTCDay() === 1);
  let meetingIndex = 1;
  let ctaIndex = 1;

  mondayDates.forEach((date, idx) => {
    const titleBase = MEETING_TITLE_ROTATION[idx % MEETING_TITLE_ROTATION.length];
    const meetingId = makeSeedUuid('22222222-2222-4222-8222-', 100000 + meetingIndex);
    const meetingDate = dateKey(date);
    const createdHour = 15 + (idx % 3);
    const createdMinute = 10 + ((idx * 7) % 35);
    const typoCount = 3 + (idx % 4);
    const ambiguousCount = 2 + (idx % 4);
    const ctaCount = 3 + (idx % 3);
    const ctas = Array.from({ length: ctaCount }, (_, ctaOffset) => {
      const template = CTA_TITLE_ROTATION[(idx + ctaOffset) % CTA_TITLE_ROTATION.length];
      const deadlineDate = new Date(date.getTime() + (ctaOffset + 2) * 24 * 60 * 60 * 1000);
      const currentIndex = ctaIndex;
      ctaIndex += 1;
      return {
        id: makeSeedUuid('33333333-3333-4333-8333-', 100000 + currentIndex),
        title: `${template[0]} Minggu ${idx + 1}`,
        action: template[1],
        picName: `PIC ${idx + 1}.${ctaOffset + 1}`,
        unit: ctaOffset % 2 === 0 ? 'Sekretariat Pimpinan' : 'PMO',
        deadline: dateKey(deadlineDate),
        priority: ctaOffset % 2 === 0 ? 'high' : 'medium',
        status: idx >= mondayDates.length - 2 && ctaOffset === ctaCount - 1 ? 'in-progress' : 'completed',
      };
    });

    generated.push({
      id: meetingId,
      title: `${titleBase} ${idx + 1}`,
      meetingDate,
      filename: `Notula-${titleBase.replace(/\s+/g, '-')}-${meetingDate}.docx`,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 710_000 + (idx % 5) * 52_000,
      participantsCount: 8 + (idx % 6),
      participantsEmails: ['sekretariat@instansi.go.id', 'pimpinan@instansi.go.id', 'pmo@instansi.go.id'],
      status: idx >= mondayDates.length - 2 ? 'approved' : 'distributed',
      typoCount,
      ambiguousCount,
      ctaCount,
      createdAt: buildJakartaIso(date, createdHour, createdMinute),
      analyzedAt: buildJakartaIso(date, createdHour, createdMinute + 8),
      correctedAt: buildJakartaIso(date, createdHour, createdMinute + 18),
      distributedAt: idx >= mondayDates.length - 2 ? null : buildJakartaIso(date, createdHour, createdMinute + 35),
      actualAutomationMinutes: 8 + (idx % 4),
      findings: [
        {
          kind: 'ambiguous',
          severity: 'medium',
          locationHint: 'Poin tindak lanjut utama',
          originalText: 'agar segera ditindaklanjuti',
          suggestedText: `agar ditindaklanjuti maksimal ${ctas[0].deadline} oleh PIC terkait`,
          explanation: 'Catatan rapat dibuat lebih operasional dengan PIC dan tenggat yang jelas.',
        },
      ],
      approvedIndices: [0],
      ctas,
    });
    meetingIndex += 1;
  });

  return generated;
}

function buildGeneratedTaskSeeds(existingSeeds) {
  const q1Weekdays = enumerateQ1Weekdays();
  const counts = countByDate(existingSeeds, ([, , , , , , createdAt]) => createdAt);
  const generated = [];
  let index = 1;

  q1Weekdays.forEach((date, dayIndex) => {
    const target = TASK_DAILY_TARGETS[dayIndex % TASK_DAILY_TARGETS.length];
    const existingCount = counts.get(dateKey(date)) ?? 0;
    const missing = Math.max(0, target - existingCount);

    for (let slot = 0; slot < missing; slot += 1) {
      const template = TASK_TEMPLATE_ROTATION[(dayIndex + slot) % TASK_TEMPLATE_ROTATION.length];
      const createdHour = 7 + (slot % 8);
      const createdMinute = 20 + ((dayIndex * 5 + slot * 9) % 35);
      const dueOffsetDays = slot % 3 === 0 ? 0 : 1;
      const dueDate = new Date(date.getTime() + dueOffsetDays * 24 * 60 * 60 * 1000);
      const dueHour = 14 + (slot % 4);
      const status =
        dayIndex >= q1Weekdays.length - 3 && slot >= missing - 2
          ? slot % 2 === 0
            ? 'todo'
            : 'in-progress'
          : dayIndex >= q1Weekdays.length - 8 && slot === missing - 1
            ? 'in-progress'
            : 'completed';
      const priority = slot % 4 === 0 ? 'high' : slot % 3 === 0 ? 'low' : 'medium';

      generated.push([
        makeSeedUuid('44444444-4444-4444-8444-', 100000 + index),
        `${template[0]} ${dateKey(date)}-${slot + 1}`,
        template[1],
        status,
        priority,
        buildJakartaIso(dueDate, dueHour, 0),
        buildJakartaIso(date, createdHour, createdMinute),
      ]);
      index += 1;
    }
  });

  return generated;
}

const documentSeeds = [...baseDocumentSeeds, ...buildGeneratedDocumentSeeds(baseDocumentSeeds)].sort(compareCreatedAt);
const meetingSeeds = [
  ...buildGeneratedMeetingSeeds(),
  ...baseMeetingSeeds.filter((seed) => new Date(seed.createdAt).getMonth() > 2),
].sort(compareCreatedAt);
const taskSeeds = [...baseTaskSeeds, ...buildGeneratedTaskSeeds(baseTaskSeeds)].sort(
  (a, b) => new Date(a[6]).getTime() - new Date(b[6]).getTime(),
);

function buildDocumentStoragePath(userId, seed) {
  return `documents/${userId}/seed-historical-q1-2026/${seed.filename}`;
}

function buildMeetingStoragePath(userId, seed) {
  return `meeting-minutes/${userId}/seed-historical-q1-2026/${seed.filename}`;
}

function buildDocumentRows(userId) {
  return documentSeeds.map((seed) => ({
    id: seed.id,
    user_id: userId,
    filename: seed.filename,
    file_type: seed.fileType,
    file_size: seed.fileSize,
    storage_path: buildDocumentStoragePath(userId, seed),
    status: seed.status,
    typo_count: seed.typoCount,
    ambiguous_count: seed.ambiguousCount,
    findings_json: { summary: seed.summary, findings: seed.findings },
    analysis_error: null,
    analyzed_at: new Date(seed.analyzedAt),
    created_at: new Date(seed.createdAt),
    updated_at: new Date(seed.analyzedAt),
  }));
}

function buildMeetingRows(userId) {
  return meetingSeeds.map((seed) => ({
    id: seed.id,
    user_id: userId,
    title: seed.title,
    meeting_date: seed.meetingDate,
    filename: seed.filename,
    file_type: seed.fileType,
    file_size: seed.fileSize,
    storage_path: buildMeetingStoragePath(userId, seed),
    participants_count: seed.participantsCount,
    participants_emails: seed.participantsEmails,
    status: seed.status,
    typo_count: seed.typoCount,
    ambiguous_count: seed.ambiguousCount,
    cta_count: seed.ctaCount,
    findings_json: seed.findings,
    approved_findings_json: seed.approvedIndices,
    corrected_storage_path: `${buildMeetingStoragePath(userId, seed)}.corrected`,
    corrected_filename: seed.filename.replace(/\.docx$/i, '-corrected.docx'),
    ctas_json:
      seed.ctas.map((cta) => ({
        title: cta.title,
        action: cta.action,
        pic: cta.picName,
        unit: cta.unit,
        deadline: cta.deadline,
        priority: cta.priority,
        status: cta.status === 'completed' ? 'done' : cta.status === 'in-progress' ? 'in_progress' : 'pending',
      })),
    analysis_error: null,
    analyzed_at: new Date(seed.analyzedAt),
    corrected_at: seed.correctedAt ? new Date(seed.correctedAt) : null,
    distributed_at: seed.distributedAt ? new Date(seed.distributedAt) : null,
    created_at: new Date(seed.createdAt),
    updated_at: new Date(seed.distributedAt || seed.correctedAt || seed.analyzedAt),
  }));
}

function buildCtaRows() {
  return meetingSeeds.flatMap((meeting) =>
    meeting.ctas.map((cta) => ({
      id: cta.id,
      meeting_minute_id: meeting.id,
      title: cta.title,
      action: cta.action,
      pic_name: cta.picName,
      unit: cta.unit,
      deadline: cta.deadline,
      priority: cta.priority,
      status: cta.status,
      created_at: new Date(meeting.createdAt),
      updated_at: new Date(meeting.distributedAt || meeting.correctedAt || meeting.analyzedAt),
    })),
  );
}

function buildTaskRows(userId) {
  return taskSeeds.map(([id, title, description, status, priority, dueDate, createdAt]) => ({
    id,
    user_id: userId,
    title,
    description,
    status,
    priority,
    due_date: new Date(dueDate),
    created_at: new Date(createdAt),
    updated_at: status === 'completed' ? new Date(dueDate) : new Date(createdAt),
  }));
}

function buildTimeSavingsRows(userId) {
  const documentRows = documentSeeds.map((seed) => {
    const findings = seed.typoCount + seed.ambiguousCount;
    const manualEstimateMinutes = 20 + findings * 3;
    return {
      id: `55555555-5555-4555-8555-${seed.id.slice(-12)}`,
      user_id: userId,
      feature: 'document_review',
      source_id: seed.id,
      manual_estimate_minutes: manualEstimateMinutes,
      actual_automation_minutes: seed.actualAutomationMinutes,
      saved_minutes: Math.max(0, manualEstimateMinutes - seed.actualAutomationMinutes),
      metadata_json: {
        filename: seed.filename,
        typoCount: seed.typoCount,
        ambiguousCount: seed.ambiguousCount,
        findings,
        seedGroup: 'lioo-historical-q1-2026',
      },
      occurred_at: new Date(seed.analyzedAt),
      created_at: new Date(seed.analyzedAt),
    };
  });

  const meetingRows = meetingSeeds.map((seed) => {
    const findings = seed.typoCount + seed.ambiguousCount;
    const manualEstimateMinutes = 30 + findings * 2 + seed.ctaCount * 5;
    return {
      id: `66666666-6666-4666-8666-${seed.id.slice(-12)}`,
      user_id: userId,
      feature: 'minutes_cta',
      source_id: seed.id,
      manual_estimate_minutes: manualEstimateMinutes,
      actual_automation_minutes: seed.actualAutomationMinutes,
      saved_minutes: Math.max(0, manualEstimateMinutes - seed.actualAutomationMinutes),
      metadata_json: {
        title: seed.title,
        typoCount: seed.typoCount,
        ambiguousCount: seed.ambiguousCount,
        ctaCount: seed.ctaCount,
        findings,
        seedGroup: 'lioo-historical-q1-2026',
      },
      occurred_at: new Date(seed.analyzedAt),
      created_at: new Date(seed.analyzedAt),
    };
  });

  return [...documentRows, ...meetingRows];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const sql = postgres(connectionString, { prepare: false });

  try {
    const users = await sql`
      select id, clerk_user_id, email, full_name
      from users
      where clerk_user_id = ${TARGET_CLERK_USER_ID} or email = ${TARGET_EMAIL}
      order by case when clerk_user_id = ${TARGET_CLERK_USER_ID} then 0 else 1 end
      limit 1
    `;

    const user = users[0];
    if (!user) {
      throw new Error(
        `User target tidak ditemukan. Pastikan user ${TARGET_EMAIL} / ${TARGET_CLERK_USER_ID} sudah pernah login ke sistem.`,
      );
    }

    await sql.begin(async (tx) => {
      const documentIds = documentSeeds.map((seed) => seed.id);
      const meetingIds = meetingSeeds.map((seed) => seed.id);
      const ctaIds = meetingSeeds.flatMap((seed) => seed.ctas.map((cta) => cta.id));
      const taskIds = taskSeeds.map(([id]) => id);
      const timeSavingsIds = buildTimeSavingsRows(user.id).map((row) => row.id);

      if (timeSavingsIds.length) {
        await tx`delete from time_savings_events where user_id = ${user.id} and id = any(${timeSavingsIds}::uuid[])`;
      }
      if (ctaIds.length) {
        await tx`delete from cta_items where id = any(${ctaIds}::uuid[])`;
      }
      if (meetingIds.length) {
        await tx`delete from meeting_minutes where user_id = ${user.id} and id = any(${meetingIds}::uuid[])`;
      }
      if (documentIds.length) {
        await tx`delete from documents where user_id = ${user.id} and id = any(${documentIds}::uuid[])`;
      }
      if (taskIds.length) {
        await tx`delete from tasks where user_id = ${user.id} and id = any(${taskIds}::uuid[])`;
      }

      const documentRows = buildDocumentRows(user.id);
      const meetingRows = buildMeetingRows(user.id);
      const ctaRows = buildCtaRows();
      const taskRows = buildTaskRows(user.id);
      const timeSavingsRows = buildTimeSavingsRows(user.id);

      await tx`insert into documents ${tx(documentRows)}`;
      await tx`insert into meeting_minutes ${tx(meetingRows)}`;
      await tx`insert into cta_items ${tx(ctaRows)}`;
      await tx`insert into tasks ${tx(taskRows)}`;
      await tx`insert into time_savings_events ${tx(timeSavingsRows)}`;
    });

    const q1WeekdayCount = enumerateQ1Weekdays().length;
    const q1DocumentCount = documentSeeds.filter((seed) => new Date(seed.createdAt).getMonth() <= 2).length;
    const q1MeetingCount = meetingSeeds.filter((seed) => new Date(seed.createdAt).getMonth() <= 2).length;
    const q1TaskCount = taskSeeds.filter(([, , , , , , createdAt]) => new Date(createdAt).getMonth() <= 2).length;
    const totalSavedMinutes = buildTimeSavingsRows(user.id).reduce((sum, row) => sum + row.saved_minutes, 0);

    console.log(`Seed historis berhasil untuk ${user.email} (${user.id})`);
    console.log(`- Dokumen seeded: ${documentSeeds.length} (${q1DocumentCount} di Q1 2026)`);
    console.log(`- Notula seeded: ${meetingSeeds.length} (${q1MeetingCount} di Q1 2026)`);
    console.log(`- CTA seeded: ${meetingSeeds.reduce((sum, meeting) => sum + meeting.ctas.length, 0)}`);
    console.log(`- Task seeded: ${taskSeeds.length} (${q1TaskCount} di Q1 2026)`);
    console.log(`- Rata-rata dokumen Q1: ${(q1DocumentCount / q1WeekdayCount).toFixed(2)} per hari kerja`);
    console.log(`- Rata-rata task Q1: ${(q1TaskCount / q1WeekdayCount).toFixed(2)} per hari kerja`);
    console.log(`- Rapat pimpinan Q1: 1x per Senin (${q1MeetingCount} rapat)`);
    console.log(`- Time savings seeded: ${Math.round(totalSavedMinutes / 60)} jam (${totalSavedMinutes} menit)`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Seed historis gagal:', error);
  process.exit(1);
});
