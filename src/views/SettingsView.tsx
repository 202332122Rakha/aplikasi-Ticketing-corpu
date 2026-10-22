import React, { useState } from 'react';
import {
  Settings,
  Database,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Shield,
  Info,
} from 'lucide-react';
import { storageService } from '../services/storageService';

export const SettingsView: React.FC = () => {
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleReset = () => {
    if (confirm('PERINGATAN: Apakah Anda yakin ingin mereset seluruh data simulasi ke kondisi bawaan awal (10 tiket standar)?')) {
      storageService.resetToDefault();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
    }
  };

  const handleExportBackup = () => {
    const json = storageService.exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_PLN_CorpU_Ticketing_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Pengaturan Aplikasi
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Konfigurasi sistem, informasi instalasi, dan pengelolaan basis data PLN Corporate University.
        </p>
      </div>

      {resetSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Basis data simulasi berhasil direset ke 10 tiket standar awal!</span>
        </div>
      )}

      {/* System Identity Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Server className="w-4 h-4 text-emerald-700" />
          Identitas & Lingkungan Sistem
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-slate-400">Nama Aplikasi:</span>
            <p className="font-bold text-slate-900">PLN Corporate University Ticketing Management System</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-slate-400">Versi Rilis:</span>
            <p className="font-bold text-slate-900 font-mono-numbers">v1.0.0-PROD (Magang CorpU)</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-slate-400">Mode Penyimpanan:</span>
            <p className="font-bold text-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Local Storage Repository (Firebase-Ready Interface)
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-slate-400">Format Penomoran Tiket:</span>
            <p className="font-bold text-[#1765B3] font-mono text-xs">
              #XXXX-MM-YYYY-NNN (Kategori, Bulan, Tahun, No. Urut)
            </p>
          </div>
        </div>
      </div>

      {/* Data Management & Backup */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Database className="w-4 h-4 text-emerald-700" />
          Pengelolaan & Cadangan Data
        </h2>

        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-slate-900 block">Ekspor Cadangan Data Lengkap (JSON)</span>
              <span className="text-slate-500">
                Unduh seluruh data tiket, pengguna, audit log, dan konfigurasi SLA dalam format file JSON.
              </span>
            </div>
            <button
              onClick={handleExportBackup}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Unduh Cadangan</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-rose-50/40 rounded-xl border border-rose-200">
            <div>
              <span className="font-bold text-rose-900 block">Reset Basis Data Simulasi</span>
              <span className="text-slate-500">
                Kembalikan seluruh tabel ke kondisi awal dengan 10 tiket realistik dan 6 akun demo standar.
              </span>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Data Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notice info */}
      <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Aplikasi ini dirancang sebagai proyek magang dan prototipe teruji untuk pengelolaan helpdesk di
          lingkungan PLN Corporate University. Arsitektur data telah dipisahkan ke dalam repository service layer
          sehingga dapat langsung disambungkan ke Firebase Authentication dan Cloud Firestore kapan pun kredensial
          resmi dikonfigurasikan.
        </p>
      </div>
    </div>
  );
};
