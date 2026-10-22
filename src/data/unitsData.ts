import { Unit } from '../types';

/**
 * MASTER DATA 12 UNIT RESMI PLN CORPORATE UNIVERSITY
 * Terdiri dari:
 * - 11 UPDL (6 UPDL Pulau Jawa + 5 UPDL Luar Jawa)
 * - 1 Unit Korporat (PLN Corporate University / PLN Corpu - BUKAN UPDL)
 * 
 * Serta Unit Umum / Non-UPDL terdaftar untuk pelapor eksternal diklat.
 */

// 11 Unit UPDL Resmi
export const UPDL_UNITS: Unit[] = [
  // --- A. Wilayah Pulau Jawa (6 UPDL) ---
  {
    unitId: 'unit-updl-jkt',
    unitCode: 'UPDL_JKT',
    unitName: 'PLN UPDL Jakarta',
    unitRegion: 'Jawa',
    unitFocus: 'Leadership Academy dan Corporate Culture Academy, termasuk pengembangan kepemimpinan dan manajemen.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-bgr',
    unitCode: 'UPDL_BGR',
    unitName: 'PLN UPDL Bogor',
    unitRegion: 'Jawa',
    unitFocus: 'Project Academy dan Procurement Academy, termasuk manajemen proyek, pengadaan barang/jasa, serta pelatihan pegawai baru.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-srl',
    unitCode: 'UPDL_SRL',
    unitName: 'PLN UPDL Suralaya',
    unitRegion: 'Jawa',
    unitFocus: 'Primary Energy dan Power Generation Academy, termasuk pembangkitan energi primer dan pembangkit termal.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-smg',
    unitCode: 'UPDL_SMG',
    unitName: 'PLN UPDL Semarang',
    unitRegion: 'Jawa',
    unitFocus: 'Transmission dan Live Line Maintenance Academy, termasuk transmisi dan pemeliharaan jaringan tegangan tinggi/PDKB.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-pdn',
    unitCode: 'UPDL_PDN',
    unitName: 'PLN UPDL Pandaan',
    unitRegion: 'Jawa',
    unitFocus: 'Distribution dan Commerce Academy, termasuk distribusi jaringan serta niaga/pelayanan pelanggan.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-sby',
    unitCode: 'UPDL_SBY',
    unitName: 'PLN UPDL Surabaya',
    unitRegion: 'Jawa',
    unitFocus: 'Pelatihan teknis kelistrikan, pengoperasian pembangkit mikro, pemeliharaan motor, serta kompetensi praktik lapangan.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },

  // --- B. Wilayah Luar Pulau Jawa (5 UPDL) ---
  {
    unitId: 'unit-updl-ttg',
    unitCode: 'UPDL_TTG',
    unitName: 'PLN UPDL Tuntungan',
    unitRegion: 'Luar Jawa',
    unitFocus: 'Pembelajaran ketenagalistrikan wilayah Sumatera Bagian Utara, manajemen kepemimpinan, dan tanggap darurat bencana.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-pdg',
    unitCode: 'UPDL_PDG',
    unitName: 'PLN UPDL Padang',
    unitRegion: 'Luar Jawa',
    unitFocus: 'Pendidikan dan pelatihan kelistrikan untuk wilayah regional Sumatera Barat dan sekitarnya.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-plb',
    unitCode: 'UPDL_PLB',
    unitName: 'PLN UPDL Palembang',
    unitRegion: 'Luar Jawa',
    unitFocus: 'Ketenagalistrikan wilayah Sumatera Bagian Selatan, optimalisasi teknologi digital seperti inspeksi drone, dan keselamatan kerja.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-bjb',
    unitCode: 'UPDL_BJB',
    unitName: 'PLN UPDL Banjarbaru',
    unitRegion: 'Luar Jawa',
    unitFocus: 'Pengembangan kompetensi, teknik, dan manajemen kelistrikan untuk regional Kalimantan.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-updl-mks',
    unitCode: 'UPDL_MKS',
    unitName: 'PLN UPDL Makassar',
    unitRegion: 'Luar Jawa',
    unitFocus: 'Pusat pendidikan utama teknik kelistrikan dan niaga untuk regional Sulawesi, Maluku, hingga Papua.',
    unitType: 'UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

// 1 Unit Korporat (PLN Corpu - BUKAN UPDL)
export const CORPU_UNIT: Unit = {
  unitId: 'unit-pln-corpu',
  unitCode: 'PLN_CORPU',
  unitName: 'PLN Corporate University (PLN Corpu)',
  unitRegion: 'Korporat',
  unitFocus: 'Pengelolaan pembelajaran korporat, pengembangan kompetensi, dan layanan pembelajaran yang relevan dengan HXMS.',
  unitType: 'CORPU',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

// Master Data 12 Unit Resmi PLN Corporate University
export const OFFICIAL_UNITS: Unit[] = [...UPDL_UNITS, CORPU_UNIT];

// Master Data Unit Umum / Non-UPDL Lainnya (Unit PLN di luar 11 UPDL & Corpu)
export const NON_UPDL_UNITS: Unit[] = [
  {
    unitId: 'unit-non-pusat',
    unitCode: 'PLN_PUSAT',
    unitName: 'PLN Kantor Pusat',
    unitRegion: 'Non-UPDL',
    unitFocus: 'Kantor Pusat PT PLN (Persero) pengambil kebijakan korporat dan strategi kelistrikan nasional.',
    unitType: 'NON_UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-non-uid-jkt',
    unitCode: 'UID_JKT',
    unitName: 'PLN UID Jakarta Raya',
    unitRegion: 'Non-UPDL',
    unitFocus: 'Unit Induk Distribusi Jakarta Raya - Pelayanan pelanggan dan distribusi kelistrikan ibu kota.',
    unitType: 'NON_UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-non-puslitbang',
    unitCode: 'PUSLITBANG',
    unitName: 'PLN Puslitbang',
    unitRegion: 'Non-UPDL',
    unitFocus: 'Pusat Penelitian dan Pengembangan Ketenagalistrikan PT PLN (Persero).',
    unitType: 'NON_UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    unitId: 'unit-non-pusharlis',
    unitCode: 'PUSHARLIS',
    unitName: 'PLN Pusharlis',
    unitRegion: 'Non-UPDL',
    unitFocus: 'Pusat Pemeliharaan Ketenagalistrikan PT PLN (Persero).',
    unitType: 'NON_UPDL',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

// Seluruh Unit Terdaftar (11 UPDL + 1 PLN Corpu + Unit Non-UPDL)
export const ALL_REGISTERED_UNITS: Unit[] = [...OFFICIAL_UNITS, ...NON_UPDL_UNITS];
