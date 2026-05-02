import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-gray-800">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Syarat &amp; Ketentuan Layanan</h1>
        <p className="mt-3 text-sm text-gray-500">Berlaku sejak: 1 Mei 2026 &mdash; Terakhir diperbarui: 1 Mei 2026</p>
        <p className="mt-4 text-sm leading-7 text-gray-600">
          Syarat &amp; Ketentuan ini (&ldquo;Syarat&rdquo;) mengatur akses dan penggunaan platform <strong>AURA &mdash; AI‑Powered Secretary Assistant</strong> yang dioperasikan oleh <strong>Golda Fortuna</strong> (&ldquo;kami&rdquo;, &ldquo;platform&rdquo;). Dengan mendaftar atau menggunakan layanan kami, Anda (&ldquo;Pengguna&rdquo;) menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan dalam dokumen ini.
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs leading-6 text-amber-800">
          Jika Anda tidak menyetujui salah satu ketentuan ini, harap hentikan penggunaan layanan dan hapus akun Anda.
        </p>
      </div>

      <div className="space-y-10 text-sm leading-7 text-gray-700">

        {/* 1 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">1. Definisi</h2>
          <p className="mt-2">Dalam dokumen ini, istilah-istilah berikut memiliki arti sebagaimana didefinisikan di bawah ini:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Layanan</strong> — seluruh fitur, modul, antarmuka, dan API yang tersedia di platform AURA, termasuk Review Dokumen, Notula Rapat, Agenda Pimpinan, WhatsApp Reminder, Manajemen Tugas, dan Academy.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Akun</strong> — identitas digital unik yang dibuat Pengguna untuk mengakses Layanan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Konten Pengguna</strong> — semua dokumen, teks, file, data, dan informasi apa pun yang diunggah, dibuat, atau disimpan Pengguna melalui Layanan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Fitur AI</strong> — fungsi yang memanfaatkan model bahasa besar (LLM) pihak ketiga seperti Claude (Anthropic), GPT (OpenAI), atau DeepSeek untuk memproses permintaan Pengguna.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Organisasi</strong> — entitas atau instansi yang mendaftarkan akun dan memberikan akses kepada anggota timnya.</span>
            </li>
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">2. Deskripsi Layanan</h2>
          <p className="mt-2">
            AURA adalah platform manajemen administrasi berbasis kecerdasan buatan yang dirancang untuk membantu sekretaris pimpinan dan staf administrasi dalam mengelola dokumen, rapat, agenda, dan komunikasi secara lebih efisien. Layanan tersedia berbasis web dan dapat diakses melalui peramban modern yang terhubung ke internet.
          </p>
          <p className="mt-3 text-gray-600">
            Kami berhak menambahkan, mengubah, atau menghentikan fitur tertentu tanpa pemberitahuan sebelumnya, namun akan berusaha memberikan informasi yang wajar untuk perubahan yang berdampak signifikan bagi Pengguna aktif.
          </p>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">3. Pendaftaran Akun &amp; Keamanan</h2>
          <p className="mt-2">Untuk menggunakan Layanan, Anda wajib membuat akun dengan ketentuan berikut:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Anda harus berusia minimal <strong>18 tahun</strong> atau memiliki izin dari wali sah Anda.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Informasi yang diberikan saat pendaftaran harus <strong>akurat, lengkap, dan terkini</strong>. Pembuatan akun dengan identitas palsu dilarang keras.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Anda bertanggung jawab penuh atas kerahasiaan kata sandi dan seluruh aktivitas yang dilakukan melalui akun Anda.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Segera laporkan kepada kami jika Anda mengetahui atau mencurigai adanya akses tidak sah ke akun Anda.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Satu akun hanya boleh dimiliki oleh satu individu; berbagi kredensial dengan pihak lain tidak diizinkan.</span>
            </li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">4. Lisensi Penggunaan</h2>
          <p className="mt-2">
            Kami memberikan Anda lisensi terbatas, non-eksklusif, tidak dapat dipindahtangankan, dan dapat dicabut untuk mengakses serta menggunakan Layanan semata-mata untuk keperluan internal organisasi Anda sesuai dengan Syarat ini.
          </p>
          <p className="mt-3 text-gray-600">
            Lisensi ini tidak mencakup hak untuk menyalin, mendistribusikan, merekayasa balik, mengubah, atau membuat karya turunan dari Layanan atau bagian apa pun darinya. Seluruh hak yang tidak secara tegas diberikan di sini tetap berada pada kami.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">5. Penggunaan yang Diizinkan &amp; Dilarang</h2>
          <p className="mt-2">Anda diizinkan menggunakan Layanan untuk:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mengelola dokumen, notulensi, agenda, dan tugas administrasi perkantoran yang sah.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Memanfaatkan fitur AI untuk meningkatkan produktivitas administrasi dalam lingkup organisasi Anda.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mengintegrasikan Layanan dengan aplikasi pihak ketiga yang Anda miliki aksesnya secara sah.</span>
            </li>
          </ul>
          <p className="mt-4">Anda <strong>dilarang</strong> menggunakan Layanan untuk:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Melanggar hukum atau peraturan yang berlaku, termasuk namun tidak terbatas pada undang-undang perlindungan data, hak cipta, dan privasi.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mengunggah konten yang mengandung malware, virus, atau kode berbahaya apa pun.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Melakukan scraping, crawling, atau ekstraksi data masif dari platform tanpa izin tertulis kami.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mencoba meretas, mengganggu, atau membebani infrastruktur layanan kami secara berlebihan (serangan DoS/DDoS).</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Mengakses akun pengguna lain tanpa izin eksplisit.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Menjual kembali, menyewakan, atau menawarkan Layanan kepada pihak ketiga atas nama Anda sendiri tanpa perjanjian reseller tertulis dari kami.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Memasukkan informasi rahasia negara, data kesehatan pasien, atau data yang dilindungi regulasi khusus tanpa kontrol keamanan tambahan yang disepakati.</span>
            </li>
          </ul>
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs leading-6 text-red-800">
            Pelanggaran terhadap ketentuan di atas dapat mengakibatkan penangguhan atau penghapusan akun secara permanen, dan berpotensi dilaporkan kepada pihak berwenang.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">6. Konten Pengguna</h2>
          <p className="mt-2">
            Anda mempertahankan kepemilikan penuh atas Konten Pengguna yang Anda unggah atau buat di platform. Dengan menggunakan Layanan, Anda memberikan kepada kami lisensi terbatas, non-eksklusif, bebas royalti, semata-mata untuk memproses, menyimpan, dan menampilkan konten tersebut dalam rangka menyediakan Layanan kepada Anda.
          </p>
          <p className="mt-3 text-gray-600">
            Anda bertanggung jawab memastikan bahwa Konten Pengguna yang diunggah tidak melanggar hak pihak ketiga, tidak mengandung konten ilegal, dan tidak melanggar ketentuan penggunaan yang berlaku. Kami berhak menghapus konten yang melanggar Syarat ini tanpa pemberitahuan sebelumnya.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">7. Fitur Kecerdasan Buatan (AI)</h2>
          <p className="mt-2">Penggunaan fitur AI dalam platform ini tunduk pada ketentuan tambahan berikut:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Pemrosesan Konten</strong> — konten yang Anda kirimkan ke fitur AI (teks dokumen, notulensi, dsb.) diteruskan ke model AI pihak ketiga yang Anda pilih (Claude, GPT, DeepSeek) hanya untuk memproses permintaan tersebut. Konten tidak digunakan untuk melatih model AI manapun.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Tanggung Jawab Hasil AI</strong> — output yang dihasilkan fitur AI bersifat sugestif dan tidak boleh dijadikan satu-satunya dasar pengambilan keputusan penting tanpa verifikasi manusia.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Kunci API Anda</strong> — jika Anda menggunakan kunci API sendiri, Anda bertanggung jawab penuh atas biaya penggunaan dan keamanan kunci tersebut.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Konten Sensitif</strong> — jangan mengirimkan informasi yang sangat sensitif (rahasia negara, data medis, dll.) ke fitur AI kecuali Anda memahami dan menerima risiko yang terkait.</span>
            </li>
          </ul>
          <p className="mt-3 rounded-lg bg-violet-50 px-4 py-3 text-gray-700 text-xs leading-6">
            Kami tidak bertanggung jawab atas ketidakakuratan, kesalahan, atau konsekuensi yang timbul dari hasil generasi AI. Selalu lakukan tinjauan manusia sebelum menggunakan output AI untuk keperluan resmi.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">8. Integrasi Pihak Ketiga</h2>
          <p className="mt-2">
            Platform ini dapat terintegrasi dengan layanan pihak ketiga seperti Google Calendar, WhatsApp Business API, dan penyedia model AI. Penggunaan integrasi tersebut tunduk pada syarat dan kebijakan privasi masing-masing penyedia. Kami tidak bertanggung jawab atas gangguan, kehilangan data, atau kerugian yang disebabkan oleh perubahan atau gangguan pada layanan pihak ketiga.
          </p>
          <p className="mt-3 text-gray-600">
            Anda menyetujui bahwa dengan menghubungkan akun pihak ketiga, Anda mengizinkan kami mengakses dan menggunakan data dari layanan tersebut sesuai dengan ruang lingkup izin yang Anda berikan.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">9. Ketersediaan &amp; Pemeliharaan Layanan</h2>
          <p className="mt-2">
            Kami berupaya menjaga platform tersedia <strong>24/7</strong>, namun tidak dapat menjamin uptime tanpa gangguan. Pemeliharaan terjadwal akan diinformasikan sebelumnya bila memungkinkan.
          </p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Gangguan tak terduga (bug kritis, insiden keamanan, force majeure) dapat menyebabkan downtime tanpa pemberitahuan sebelumnya.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Kami tidak bertanggung jawab atas kerugian yang disebabkan oleh ketidaktersediaan layanan yang berada di luar kendali wajar kami.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Pengguna disarankan untuk menyimpan salinan lokal dokumen penting dan tidak mengandalkan platform sebagai satu-satunya media penyimpanan.</span>
            </li>
          </ul>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">10. Kekayaan Intelektual</h2>
          <p className="mt-2">
            Seluruh elemen platform AURA — termasuk namun tidak terbatas pada desain antarmuka, kode sumber, merek dagang, logo, teks pemasaran, dan dokumentasi — adalah milik eksklusif <strong>Golda Fortuna</strong> dan dilindungi oleh hukum hak cipta dan kekayaan intelektual yang berlaku.
          </p>
          <p className="mt-3 text-gray-600">
            Nama &ldquo;AURA&rdquo; dan &ldquo;AI‑Powered Secretary Assistant&rdquo; adalah merek yang tidak boleh digunakan tanpa izin tertulis kami. Laporan pelanggaran kekayaan intelektual dapat disampaikan melalui kontak yang tercantum di bagian akhir dokumen ini.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">11. Privasi &amp; Perlindungan Data</h2>
          <p className="mt-2">
            Pengumpulan, penggunaan, dan perlindungan data pribadi Anda diatur secara terpisah dalam{' '}
            <Link href="/privacy-policy" className="text-violet-700 underline underline-offset-2 hover:text-violet-900">
              Kebijakan Privasi
            </Link>{' '}
            kami, yang merupakan bagian tak terpisahkan dari Syarat ini. Dengan menyetujui Syarat ini, Anda juga menyetujui Kebijakan Privasi kami.
          </p>
        </section>

        {/* 12 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">12. Penghentian Akun</h2>
          <p className="mt-2"><strong>Penghentian oleh Pengguna:</strong> Anda dapat menutup akun kapan saja melalui menu <em>Pengaturan &rsaquo; Akun &rsaquo; Hapus Akun</em>. Data Anda akan dihapus permanen dalam 30 hari setelah permintaan, kecuali ada kewajiban hukum untuk menyimpannya.</p>
          <p className="mt-3"><strong>Penghentian oleh Kami:</strong> Kami berhak menangguhkan atau menghentikan akun Anda — dengan atau tanpa pemberitahuan sebelumnya — jika:</p>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Anda melanggar Syarat ini atau kebijakan penggunaan yang berlaku.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Aktivitas akun Anda menimbulkan risiko keamanan atau hukum bagi platform atau pengguna lain.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span>Terdapat instruksi dari otoritas hukum yang berwenang.</span>
            </li>
          </ul>
          <p className="mt-3 text-gray-600">
            Setelah penghentian, hak Anda untuk menggunakan Layanan berakhir seketika. Ketentuan yang secara alami bertahan setelah penghentian (termasuk kekayaan intelektual, batasan tanggung jawab, dan penyelesaian sengketa) tetap berlaku.
          </p>
        </section>

        {/* 13 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">13. Penafian &amp; Batasan Tanggung Jawab</h2>
          <p className="mt-2">
            Layanan disediakan <strong>&ldquo;sebagaimana adanya&rdquo; (as-is)</strong> dan <strong>&ldquo;sebagaimana tersedia&rdquo; (as-available)</strong> tanpa jaminan apa pun, baik tersurat maupun tersirat, termasuk namun tidak terbatas pada jaminan kelayakan jual, kesesuaian untuk tujuan tertentu, atau ketiadaan pelanggaran hak pihak ketiga.
          </p>
          <p className="mt-3 text-gray-600">
            Sejauh diizinkan oleh hukum yang berlaku, total tanggung jawab kumulatif kami atas klaim apa pun yang timbul dari atau berkaitan dengan Layanan tidak akan melebihi jumlah yang Anda bayarkan kepada kami dalam <strong>tiga bulan</strong> terakhir sebelum klaim tersebut timbul, atau <strong>Rp 500.000</strong> (mana yang lebih besar).
          </p>
          <p className="mt-3 text-gray-600">
            Dalam keadaan apa pun kami tidak bertanggung jawab atas kerugian tidak langsung, insidental, konsekuensial, khusus, atau hukuman, termasuk kehilangan data, kehilangan pendapatan, atau gangguan bisnis, meskipun kami telah diberitahu tentang kemungkinan kerugian tersebut.
          </p>
        </section>

        {/* 14 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">14. Ganti Rugi (Indemnifikasi)</h2>
          <p className="mt-2">
            Anda setuju untuk membebaskan, membela, dan memberikan ganti rugi kepada kami, afiliasi, direktur, karyawan, dan mitra kami dari dan terhadap segala klaim, kerugian, kewajiban, biaya hukum, dan pengeluaran yang timbul dari: (i) penggunaan Layanan oleh Anda yang melanggar Syarat ini; (ii) Konten Pengguna yang Anda unggah; atau (iii) pelanggaran Anda terhadap hak pihak ketiga mana pun.
          </p>
        </section>

        {/* 15 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">15. Penyelesaian Sengketa</h2>
          <p className="mt-2">
            Para pihak sepakat untuk terlebih dahulu menyelesaikan setiap sengketa yang timbul dari Syarat ini atau penggunaan Layanan melalui <strong>musyawarah mufakat</strong> dalam jangka waktu 30 hari sejak sengketa disampaikan secara tertulis.
          </p>
          <p className="mt-3 text-gray-600">
            Apabila penyelesaian musyawarah tidak tercapai, sengketa diselesaikan melalui <strong>Pengadilan Negeri</strong> yang berwenang sesuai dengan hukum yang berlaku di wilayah Republik Indonesia, kecuali diatur lain dalam perjanjian tertulis antara para pihak.
          </p>
        </section>

        {/* 16 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">16. Hukum yang Berlaku</h2>
          <p className="mt-2">
            Syarat ini diatur oleh dan ditafsirkan berdasarkan hukum <strong>Republik Indonesia</strong>, tanpa memperhatikan ketentuan konflik hukumnya. Undang-undang yang relevan antara lain mencakup UU ITE, UU Perlindungan Data Pribadi (UU PDP), dan peraturan terkait lainnya yang berlaku.
          </p>
        </section>

        {/* 17 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">17. Ketentuan Lain-Lain</h2>
          <ul className="mt-3 space-y-2 list-none pl-0">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Keterpisahan</strong> — jika ketentuan apa pun dalam Syarat ini dinyatakan tidak berlaku atau tidak dapat ditegakkan, ketentuan tersebut akan dimodifikasi seminimal mungkin agar dapat ditegakkan, sementara ketentuan lainnya tetap berlaku penuh.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Tidak Ada Pengabaian</strong> — kegagalan kami untuk menegakkan hak apa pun dalam Syarat ini tidak dianggap sebagai pengabaian hak tersebut di masa mendatang.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Perjanjian Utuh</strong> — Syarat ini, bersama Kebijakan Privasi dan dokumen yang dirujuk di dalamnya, merupakan keseluruhan perjanjian antara Anda dan kami terkait penggunaan Layanan, dan menggantikan semua perjanjian sebelumnya.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-violet-600">▸</span>
              <span><strong>Pengalihan</strong> — Anda tidak dapat mengalihkan hak atau kewajiban di bawah Syarat ini tanpa persetujuan tertulis kami terlebih dahulu. Kami dapat mengalihkan Syarat ini kepada pihak lain sebagai bagian dari restrukturisasi atau merger bisnis.</span>
            </li>
          </ul>
        </section>

        {/* 18 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">18. Perubahan Syarat</h2>
          <p className="mt-2">
            Kami dapat memperbarui Syarat ini dari waktu ke waktu. Perubahan material akan diberitahukan melalui email atau notifikasi dalam aplikasi setidaknya <strong>14 hari</strong> sebelum berlaku efektif, dengan menyertakan ringkasan perubahan yang dilakukan. Versi terbaru selalu tersedia di halaman ini beserta tanggal pembaruan.
          </p>
          <p className="mt-3 text-gray-600">
            Penggunaan Layanan setelah tanggal berlakunya perubahan dianggap sebagai penerimaan terhadap Syarat yang telah diperbarui. Jika Anda tidak menyetujui perubahan tersebut, Anda harus menghentikan penggunaan Layanan sebelum tanggal berlaku.
          </p>
        </section>

        {/* 19 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900">19. Hubungi Kami</h2>
          <p className="mt-2">
            Jika Anda memiliki pertanyaan, keberatan, atau masukan terkait Syarat ini, silakan hubungi kami melalui:
          </p>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-gray-700">
            <p><strong>Golda Fortuna &mdash; AURA Secretary Assistant</strong></p>
            <p className="mt-1">Email: <a href="mailto:admin@secretary.app" className="text-violet-700 hover:text-violet-900">admin@secretary.app</a></p>
            <p className="mt-1">Melalui halaman <strong>Pengaturan &rsaquo; Bantuan &amp; Dukungan</strong> di dalam aplikasi.</p>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Kami akan merespons pertanyaan Anda dalam waktu <strong>5 hari kerja</strong>.
          </p>
        </section>

      </div>

      <div className="mt-12 border-t border-gray-200 pt-6 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-violet-700 hover:text-violet-900">
          ← Kembali ke Beranda
        </Link>
        <Link href="/privacy-policy" className="text-sm font-medium text-violet-700 hover:text-violet-900">
          Kebijakan Privasi →
        </Link>
      </div>
    </main>
  );
}
