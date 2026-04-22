import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-gray-800">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Terakhir diperbarui: 23 April 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Informasi yang Kami Kumpulkan</h2>
          <p>
            Kami mengumpulkan data akun (nama, email), data penggunaan aplikasi, serta konten yang Anda unggah
            untuk menjalankan fitur platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Penggunaan Data</h2>
          <p>
            Data digunakan untuk autentikasi, penyimpanan dokumen, pemrosesan fitur AI, sinkronisasi agenda, dan
            peningkatan reliabilitas layanan.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. Keamanan Data</h2>
          <p>
            Kami menerapkan kontrol akses berbasis peran, enkripsi pada data sensitif, serta praktik keamanan teknis
            yang wajar untuk melindungi data pengguna.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Berbagi Data ke Pihak Ketiga</h2>
          <p>
            Integrasi pihak ketiga (misalnya Google Calendar atau penyedia model AI) hanya dipakai untuk fungsi yang
            Anda aktifkan. Kami tidak menjual data pengguna.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Retensi dan Hak Pengguna</h2>
          <p>
            Data disimpan selama akun aktif atau sesuai kebutuhan operasional. Anda dapat meminta perubahan atau
            penghapusan data melalui admin sistem.
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
