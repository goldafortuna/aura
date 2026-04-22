import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-gray-800">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-500">Terakhir diperbarui: 23 April 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Penerimaan Syarat</h2>
          <p>
            Dengan menggunakan layanan ini, Anda menyetujui syarat penggunaan ini serta kebijakan yang berlaku.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Akun dan Tanggung Jawab</h2>
          <p>
            Anda bertanggung jawab menjaga keamanan akun, kredensial, dan aktivitas yang dilakukan melalui akun Anda.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. Penggunaan yang Diperbolehkan</h2>
          <p>
            Layanan hanya boleh digunakan untuk aktivitas yang sah, tidak melanggar hukum, serta tidak merusak
            stabilitas sistem.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Ketersediaan Layanan</h2>
          <p>
            Kami berupaya menjaga layanan tetap tersedia, namun tidak menjamin layanan bebas gangguan setiap saat.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Perubahan Layanan dan Syarat</h2>
          <p>
            Kami dapat memperbarui fitur maupun syarat layanan dari waktu ke waktu. Perubahan berlaku setelah
            dipublikasikan.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link href="/" className="text-sm font-medium text-violet-700 hover:text-violet-900">
          ← Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
