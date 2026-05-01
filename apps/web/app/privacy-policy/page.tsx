import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Kebijakan Privasi</h1>
        <p className="mt-3 text-sm text-gray-500">Berlaku sejak: 1 Mei 2026 &mdash; Terakhir diperbarui: 1 Mei 2026</p>
        <p className="mt-4 text-sm leading-7 text-gray-600">
          Kebijakan Privasi ini menjelaskan bagaimana <strong>Secretary</strong> (&ldquo;kami&rdquo;, &ldquo;layanan&rdquo;)
          mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi Anda. Dengan menggunakan layanan kami,
          Anda menyetujui praktik yang dijelaskan dalam dokumen ini.
        </p>
      </div>

      <div className="space-y-10 text-sm leading-7 text-gray-700">

        <section>
          <h2 className="text-base font-semibold text-gray-900">1. Informasi yang Kami Kumpulkan</h2>
          <p className="mt-2">Kami mengumpulkan beberapa kategori data berikut:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Data Akun</strong> — nama lengkap, alamat email, foto profil, dan kredensial autentikasi yang diperlukan untuk membuat dan mengelola akun Anda.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Data Konten</strong> — dokumen, notulensi rapat, agenda, catatan, dan file lain yang Anda unggah atau buat di dalam platform.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Data Penggunaan</strong> — fitur yang diakses, durasi sesi, log aktivitas, dan metadata interaksi untuk meningkatkan kualitas layanan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Data Perangkat</strong> — jenis peramban, sistem operasi, alamat IP, dan pengaturan bahasa untuk kebutuhan kompatibilitas dan keamanan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Data Integrasi</strong> — token akses dan data kalender yang diperoleh melalui integrasi pihak ketiga yang Anda izinkan secara eksplisit (seperti Google Calendar).</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">2. Cara Kami Menggunakan Data Anda</h2>
          <p className="mt-2">Data yang kami kumpulkan digunakan semata-mata untuk tujuan berikut:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Menyediakan, mengoperasikan, dan memelihara fitur inti platform Secretary.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Memproses permintaan fitur kecerdasan buatan (AI) seperti ringkasan dokumen, notulensi otomatis, dan saran agenda.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mensinkronkan data kalender dan jadwal rapat dengan layanan pihak ketiga yang Anda sambungkan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mengirimkan notifikasi, pembaruan layanan, dan komunikasi administratif yang relevan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Menganalisis pola penggunaan secara agregat (tanpa mengidentifikasi individu) untuk meningkatkan performa dan keandalan platform.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mematuhi kewajiban hukum dan menyelesaikan perselisihan yang mungkin timbul.</span>
            </li>
          </ul>
          <p className="mt-3 rounded-lg bg-violet-50 px-4 py-3 text-gray-700">
            Kami <strong>tidak</strong> menggunakan konten dokumen Anda untuk melatih model AI kami atau model milik pihak ketiga tanpa persetujuan eksplisit Anda.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">3. Dasar Hukum Pemrosesan Data</h2>
          <p className="mt-2">
            Pemrosesan data pribadi Anda didasarkan pada satu atau lebih landasan hukum berikut: (a) pelaksanaan perjanjian layanan antara Anda dan kami; (b) kepentingan sah kami dalam mengoperasikan dan meningkatkan platform secara aman; (c) kepatuhan terhadap kewajiban hukum yang berlaku; dan (d) persetujuan eksplisit Anda untuk fitur tertentu seperti integrasi kalender atau notifikasi pemasaran.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">4. Keamanan dan Perlindungan Data</h2>
          <p className="mt-2">Kami menerapkan lapisan perlindungan teknis dan organisasi, antara lain:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Enkripsi Transit</strong> — semua komunikasi antara perangkat Anda dan server kami dienkripsi menggunakan TLS 1.2 atau lebih baru.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Enkripsi Penyimpanan</strong> — data sensitif dienkripsi saat disimpan (encryption at rest) menggunakan standar industri AES-256.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Kontrol Akses Berbasis Peran (RBAC)</strong> — hak akses terhadap data dibatasi sesuai peran dan kebutuhan masing-masing pengguna dalam organisasi.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Audit Log</strong> — setiap akses dan perubahan data dicatat untuk keperluan investigasi insiden dan kepatuhan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Pembaruan Berkala</strong> — sistem kami diperbarui secara rutin untuk menambal kerentanan keamanan yang diketahui.</span>
            </li>
          </ul>
          <p className="mt-3 text-gray-600">
            Meskipun kami berkomitmen penuh terhadap keamanan, tidak ada sistem yang sepenuhnya bebas risiko. Kami mendorong Anda untuk menggunakan kata sandi yang kuat dan tidak membagikan kredensial akun Anda.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">5. Berbagi Data dengan Pihak Ketiga</h2>
          <p className="mt-2">
            Kami <strong>tidak menjual</strong> data pribadi Anda kepada siapa pun. Data hanya dibagikan dalam situasi terbatas berikut:
          </p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Penyedia Infrastruktur</strong> — mitra penyimpanan cloud dan komputasi yang kami gunakan untuk menjalankan platform, terikat oleh perjanjian kerahasiaan (DPA).</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Model AI Pihak Ketiga</strong> — konten yang Anda kirimkan ke fitur AI diteruskan ke penyedia model (misalnya API OpenAI atau Anthropic) hanya untuk memproses permintaan tersebut, tidak untuk pelatihan ulang.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Integrasi yang Anda Aktifkan</strong> — saat Anda menghubungkan Google Calendar atau layanan pihak ketiga lainnya, data yang diperlukan dibagikan sesuai izin yang Anda berikan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Kewajiban Hukum</strong> — kami dapat mengungkapkan data jika diwajibkan oleh hukum yang berlaku atau perintah pengadilan yang sah.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">6. Retensi Data</h2>
          <p className="mt-2">
            Data akun dan konten disimpan selama akun Anda aktif. Setelah akun dihapus, data akan dihapus permanen dari sistem kami dalam waktu <strong>30 hari</strong>, kecuali ada kewajiban hukum untuk menyimpannya lebih lama. Log sistem anonim dapat disimpan hingga 12 bulan untuk keperluan analisis keandalan.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">7. Hak-Hak Anda</h2>
          <p className="mt-2">Sebagai pengguna, Anda memiliki hak-hak berikut terkait data pribadi Anda:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Hak Akses</strong> — meminta salinan data pribadi yang kami simpan tentang Anda.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Hak Koreksi</strong> — meminta perbaikan data yang tidak akurat atau tidak lengkap.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Hak Penghapusan</strong> — meminta penghapusan data pribadi Anda (&ldquo;hak untuk dilupakan&rdquo;).</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Hak Portabilitas</strong> — menerima data Anda dalam format yang dapat dibaca mesin untuk dipindahkan ke layanan lain.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Hak Keberatan</strong> — menolak pemrosesan data untuk tujuan tertentu, termasuk komunikasi pemasaran.</span>
            </li>
          </ul>
          <p className="mt-3 text-gray-600">
            Untuk mengajukan permintaan terkait hak-hak di atas, hubungi admin sistem atau kirimkan email ke alamat kontak kami. Kami akan merespons dalam 14 hari kerja.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">8. Cookie dan Teknologi Pelacakan</h2>
          <p className="mt-2">
            Kami menggunakan cookie esensial untuk menjaga sesi autentikasi dan preferensi pengguna. Cookie analitik digunakan secara anonim untuk memahami pola penggunaan platform. Anda dapat menonaktifkan cookie non-esensial melalui pengaturan peramban, namun beberapa fitur platform mungkin tidak berfungsi optimal.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">9. Privasi Anak-Anak</h2>
          <p className="mt-2">
            Layanan kami tidak ditujukan untuk individu di bawah usia 18 tahun. Kami tidak dengan sengaja mengumpulkan data pribadi dari anak-anak. Jika Anda mengetahui bahwa seorang anak telah memberikan data kepada kami tanpa persetujuan orang tua, segera hubungi kami agar kami dapat menghapus data tersebut.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">10. Perubahan Kebijakan Privasi</h2>
          <p className="mt-2">
            Kami dapat memperbarui kebijakan ini dari waktu ke waktu untuk mencerminkan perubahan praktik kami atau ketentuan hukum yang berlaku. Jika terjadi perubahan material, kami akan memberikan pemberitahuan melalui email atau notifikasi dalam aplikasi setidaknya <strong>14 hari</strong> sebelum perubahan berlaku. Penggunaan layanan setelah tanggal berlaku dianggap sebagai persetujuan terhadap versi terbaru kebijakan ini.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900">11. Hubungi Kami</h2>
          <p className="mt-2">
            Jika Anda memiliki pertanyaan, kekhawatiran, atau permintaan terkait kebijakan privasi ini atau pengelolaan data Anda, silakan hubungi kami melalui:
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-gray-700">
            <p><strong>Secretary</strong></p>
            <p className="mt-1">Email: <a href="mailto:privacy@secretary.app" className="text-violet-700 hover:text-violet-900">privacy@secretary.app</a></p>
            <p className="mt-1">Melalui halaman <strong>Pengaturan &rsaquo; Bantuan &amp; Dukungan</strong> di dalam aplikasi.</p>
          </div>
        </section>

      </div>

      <div className="mt-12 border-t border-gray-200 pt-6 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-violet-700 hover:text-violet-900">
          ← Kembali ke Beranda
        </Link>
        <Link href="/terms" className="text-sm font-medium text-violet-700 hover:text-violet-900">
          Syarat Layanan →
        </Link>
      </div>
    </main>
  );
}
