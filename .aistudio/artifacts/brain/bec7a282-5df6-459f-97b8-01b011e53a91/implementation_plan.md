# PLN Corporate University — Ticketing Management System

Sistem manajemen tiket enterprise terpadu untuk PLN Corporate University guna mengelola laporan kendala, keluhan, insiden, dan permintaan layanan secara end-to-end dengan alur peran terverifikasi (Pelapor, Admin, PIC), pelacakan SLA otomatis, serta audit trail komprehensif.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Keputusan yang Telah Dikonfirmasi Pengguna**:
> - **Data Persistence Strategy**: Mode interaktif penuh dengan LocalStorage terstruktur dan Service Layer Repository yang 100% kompatibel untuk transisi mulus ke Cloud Firestore / Firebase. Termasuk tombol "Reset Data Demo" dan "Ekspor Data".
> - **Visual Direction**: Desain Enterprise PLN Corporate Green (`#006B3F` / `#02804A`) dipadukan dengan aksen Teal cerah (`#00A39E`), latar Slate bersih (`#F8FAFC` & `#FFFFFF`), serta tipografi modern terstruktur yang terinspirasi dari referensi Helpdesk & Qiscus ticketing yang Anda unggah.
> - **Role Switching Experience**: Quick Role Switcher Banner di bagian atas antarmuka, memungkinkan penguji berpindah seketika antara akun:
>   1. **Admin** (Admin Ticketing - Manajemen SLA, verifikasi laporan, penugasan PIC, analitik & audit log).
>   2. **Pelapor** (Andi - Keuangan, Siti - SDM: buat tiket, pantau progres, komentar, konfirmasi solusi).
>   3. **PIC** (Budi - Network, Rina - IT Support, Dimas - App Support: terima/tolak tiket, update progres, catatan internal, ajukan solusi).

---

### 1. Overview & Core Concept

- **Tujuan Utama**: Menggantikan pelaporan manual/ad-hoc di PLN Corporate University dengan platform ticketing terpusat berstandar ITIL. Setiap kendala atau permohonan diberi ID unik `TCU-YYYY-NNNNN` dengan kalkulasi prioritas otomatis (Dampak $\times$ Urgensi), batas SLA respons & resolusi, serta riwayat penanganan transparan.
- **Target Pengguna**:
  - *Pelapor (Karyawan/Instruktur/Peserta Diklat)*: Melaporkan gangguan kelas, jaringan, akun aplikasi pembelajaran, atau sarana diklat.
  - *Admin Helpdesk*: Memverifikasi tiket, menetapkan PIC berdasarkan tim/keahlian, mengelola kategori dan konfigurasi SLA.
  - *PIC / Petugas Penanganan*: Menerima penugasan, mencatat progres penanganan, meminta data tambahan ke pelapor, dan menyerahkan solusi.
- **Nilai Bisnis**: Memastikan nol tiket terlewat, transparansi waktu penyelesaian (MTTR), serta kepatuhan terhadap standar layanan pembelajaran PLN Corporate University.

---

### 2. User Experience & Visual Design

- **Alur Kerja Utama (Key User Flows)**:
  1. *Pembuatan Tiket*: Pelapor mengisi formulir dengan panduan matriks dampak (Individu/Tim/Dept/Banyak Pengguna) & urgensi. Nomor tiket langsung terbit (contoh: `TCU-2026-00001`).
  2. *Triase & Penugasan Admin*: Admin menerima notifikasi tiket baru, memvalidasi data, dan memilih PIC dengan rekomendasi beban kerja aktif.
  3. *Penanganan PIC*: PIC menerima tiket di menu "Penugasan Saya", mengubah status menjadi *Dalam Proses*, mencatat checkpoint aktivitas (dengan opsi catatan internal vs komentar publik).
  4. *Resolusi & Konfirmasi*: PIC mengisi formulir solusi dan bukti penyelesaian. Pelapor memvalidasi: dapat memilih "Konfirmasi Selesai & Tutup" atau "Ajukan Buka Kembali (Reopen)" jika belum tuntas.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Enterprise Modern Utility — berwibawa, bersih, dense information layout tanpa ornamen berlebih.
  - *Color Palette*:
    - Canvas: `#F8FAFC` (Slate 50) dengan kartu `#FFFFFF` berbingkai halus (`border-slate-200`).
    - Brand Primary: Deep PLN Green (`#006B3F`), Hover (`#005230`), Accent Cyan/Teal (`#00A39E`).
    - Semantic Status:
      - Baru: Biru Slate (`#3B82F6`)
      - Diverifikasi / Ditugaskan: Indigo (`#6366F1`)
      - Dalam Proses: Cyan / Teal (`#0D9488`)
      - Menunggu (Pelapor/Vendor/Approval): Amber (`#D97706`)
      - Selesai / Ditutup: Emerald Green (`#16A34A`)
      - Ditolak: Rose Red (`#E11D48`)
    - Prioritas: Kritis (Merah Crimson), Tinggi (Oranye), Sedang (Kuning Amber), Rendah (Abu-abu Slate).
  - *Typography*: Plus Jakarta Sans untuk display & headline, Manrope/Inter untuk body, dan font monospace tabular (`tabular-nums`) untuk nomor tiket `TCU-XXXX-XXXXX`, metrik SLA, serta timestamp.
  - *Zero-Pill & Tabular Discipline*: Sesuai standar desain antarmuka bantuan enterprise, status dan metadata disajikan dengan kontras jelas dan ikon indikator tanpa tumpukan badge dekoratif.
- **Responsive Layout**:
  - Desktop: Sidebar navigasi 260px collapsible + Header navigasi (Quick Role Switcher, Global Search, Notification Center, Profil) + Main content grid.
  - Mobile/Tablet: Sidebar drawer responsif, tabel otomatis bertransisi ke tampilan list card yang nyaman disentuh.

---

### 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Repository Pattern (Demo Storage + Firestore Interface)**
  - *Pendekatan*: Membangun `TicketRepository` interface dan `LocalTicketRepository` dengan skema data lengkap yang identik dengan Firestore schema (sebagaimana dijabarkan pada Bagian 17).
  - *Alasan*: Pengguna dapat langsung menguji coba seluruh alur bisnis secara mulus tanpa wajib menyiapkan akun GCP/Firebase di awal, sekaligus siap 100% dipasangkan dengan Firebase SDK jika dikonfigurasi.
- **Keputusan 2: Matriks Prioritas Otomatis & Override Berita Acara**
  - *Pendekatan*: Matriks prioritas otomatis (Dampak $\times$ Urgensi = Prioritas). Admin dapat mengubah prioritas tiket dengan syarat wajib menyertakan alasan perubahan yang tersimpan di Audit Log.
  - *Alasan*: Menghindari subyektivitas pelapor namun tetap memberikan fleksibilitas terukur bagi admin.
- **Keputusan 3: Pemisahan Catatan Internal (Internal Notes) vs Komentar Publik**
  - *Pendekatan*: Pada tab aktivitas dan komentar, PIC dan Admin memiliki opsi "Catatan Internal" (hanya terlihat oleh staf teknis/admin) dan "Komentar Publik" (bisa dibaca dan dibalas pelapor).
  - *Alasan*: Menjamin kerahasiaan catatan teknis/eskalasi internal PLN sambil menjaga komunikasi terbuka dengan pelapor.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App Navigation & Top Bar                        │
│   [PLN CorpU Logo] · [Quick Role Switcher] · [Search] · [Notif Bell]   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌──────────────────────┐  ┌──────────────────────────────────────────────┐
│  Collapsible Sidebar │  │           Active View Router (16 Modul)        │
│  - Dashboard         │  │ 1. Dashboard (Stat Cards, Visual Charts, Queue)│
│  - Semua Tiket       │  │ 2. Buat Tiket (Smart Impact-Urgency Matrix)   │
│  - Buat Tiket        │  │ 3. Detail Tiket (5 Tabs: Timeline, Notes, Solusi)
│  - Tiket Saya        │  │ 4. Manajemen PIC (Beban Kerja, Penugasan)      │
│  - Penugasan Saya    │  │ 5. Manajemen Kategori & Subkategori           │
│  - Manajemen PIC     │  │ 6. Manajemen Pengguna & Tim                   │
│  - Kategori & SLA    │  │ 7. SLA & Prioritas (Target Respons & Resolusi)│
│  - Laporan & Audit   │  │ 8. Laporan & Analitik (MTTR, SLA%, Ekspor CSV)│
│  - Notifikasi & Set  │  │ 9. Audit Trail & Riwayat Perubahan            │
└──────────────────────┘  └──────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Unified Ticket Service & Repository                  │
│       - Data Persistence (LocalStorage Initializer & Firestore Ready)  │
│       - Ticket Number Generator: TCU-2026-NNNNN                        │
│       - Automated SLA Remaining Calculator & Overdue Detection         │
│       - Activity Log & Notification Dispatcher                         │
└────────────────────────────────────────────────────────────────────────┘
```

#### Struktur Data Utama:
- **Users**: 6 Akun demo bawaan (Admin Ticketing, Andi Keuangan, Siti SDM, Budi Network, Rina IT Support, Dimas App Support).
- **Tickets**: 10 Tiket awal siap uji yang mencakup seluruh spektrum status (*Baru, Diverifikasi, Ditugaskan, Dalam Proses, Menunggu Pelapor, Menunggu Pihak Ketiga, Menunggu Persetujuan, Selesai, Ditutup, Ditolak*).
- **ActivityLogs & Progresses**: Pencatatan riwayat setiap aksi lengkap dengan *actorId*, *timestamp*, *statusBefore*, *statusAfter*, dan *keterangan*.
- **Categories & SLA Profiles**: 10 Kategori lengkap dengan subkategori, target SLA respons (15m - 2h) dan SLA penyelesaian (2h - 48h).

---

### Tahapan Pengerjaan Selanjutnya

1. **Setup Komponen & Utilitas**: Tipe data TypeScript, repositori simulasi data lokal dengan 10 tiket realistik PLN CorpU, generator nomor tiket `TCU-2026-XXXXX`.
2. **Layout & Shell**: Navigasi sidebar, header dengan Quick Role Switcher, notifikasi dropdown, dan breadcrumb.
3. **Modul Dashboard**: Kartu metrik operasional (Total, Aktif, Menunggu, Selesai, Terlambat, Kritis, SLA%), grafik interaktif, dan antrean tiket prioritas tinggi.
4. **Modul Tiket & Detail**: Tabel data kaya filter & pencarian, formulir pembuatan tiket cerdas, detail tiket 5-tab dengan timeline interaktif, komentar, dan pencatatan solusi.
5. **Modul Manajemen & Laporan**: Manajemen PIC dengan analitik beban kerja, konfigurasi Kategori & SLA, Laporan analitik dengan ekspor CSV, dan Audit Log viewer.
6. **Verifikasi & Polish**: Uji coba kompilasi (`compile_applet`), verifikasi responsivitas mobile, dan dokumentasi operasional lengkap.
