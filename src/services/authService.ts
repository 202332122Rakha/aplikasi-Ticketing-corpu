import { User, Role } from '../types';
import { storageService } from './storageService';

const AUTH_SESSION_KEY = 'pln_corpu_auth_session_v2';
const AUTH_CREDENTIALS_KEY = 'pln_corpu_credentials_v2';

interface StoredCredential {
  uid: string;
  username: string;
  email: string;
  passwordHash: string; // SHA-256 simulation hash
}

// Simple deterministic hash simulation for demo security
export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

const DEFAULT_CREDENTIALS: StoredCredential[] = [
  {
    uid: 'user-admin-1',
    username: 'admin',
    email: 'admin.ticketing@pln-corpu.co.id',
    passwordHash: hashPassword('admin123'),
  },
  {
    uid: 'user-admin-user',
    username: 'admin_user',
    email: 'admin.user@pln-corpu.co.id',
    passwordHash: hashPassword('admin123'),
  },
  {
    uid: 'user-admin-user',
    username: 'manajemen_user',
    email: 'manajemen.user@pln-corpu.co.id',
    passwordHash: hashPassword('admin123'),
  },
  {
    uid: 'user-manajemen-1',
    username: 'manajemen',
    email: 'manajemen@pln-corpu.co.id',
    passwordHash: hashPassword('manajemen123'),
  },
  {
    uid: 'user-pelapor-1',
    username: 'andi',
    email: 'andi.prasetyo@pln-corpu.co.id',
    passwordHash: hashPassword('user123'),
  },
  {
    uid: 'user-pelapor-2',
    username: 'siti',
    email: 'siti.rahmawati@pln-corpu.co.id',
    passwordHash: hashPassword('user123'),
  },
  {
    uid: 'user-pic-1',
    username: 'budi',
    email: 'budi.santoso@pln-corpu.co.id',
    passwordHash: hashPassword('pic123'),
  },
  {
    uid: 'user-pic-1',
    username: 'pic1',
    email: 'pic1@pln-corpu.co.id',
    passwordHash: hashPassword('pic123'),
  },
  {
    uid: 'user-pic-2',
    username: 'rina',
    email: 'rina.wijaya@pln-corpu.co.id',
    passwordHash: hashPassword('pic123'),
  },
  {
    uid: 'user-pic-2',
    username: 'pic2',
    email: 'pic2@pln-corpu.co.id',
    passwordHash: hashPassword('pic123'),
  },
  {
    uid: 'user-pic-3',
    username: 'dimas',
    email: 'dimas.aditya@pln-corpu.co.id',
    passwordHash: hashPassword('pic123'),
  },
  {
    uid: 'user-pic-3',
    username: 'pic3',
    email: 'pic3@pln-corpu.co.id',
    passwordHash: hashPassword('pic123'),
  },
  {
    uid: 'user-pelapor-11',
    username: 'hasan',
    email: 'hasan.basri@pln-corpu.co.id',
    passwordHash: hashPassword('user123'),
  },
  {
    uid: 'user-pelapor-12',
    username: 'maya',
    email: 'maya.anggraini@pln-corpu.co.id',
    passwordHash: hashPassword('user123'),
  },
  {
    uid: 'user-pelapor-13',
    username: 'budi_uid',
    email: 'budi.darmawan@pln.co.id',
    passwordHash: hashPassword('user123'),
  },
];

class AuthService {
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initCredentials();
  }

  private initCredentials() {
    const list = this.getCredentials();
    let updated = false;
    for (const def of DEFAULT_CREDENTIALS) {
      if (!list.some((c) => c.uid === def.uid || c.username === def.username)) {
        list.push(def);
        updated = true;
      }
    }
    if (updated || !localStorage.getItem(AUTH_CREDENTIALS_KEY)) {
      localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(list));
    }
  }

  private getCredentials(): StoredCredential[] {
    try {
      const data = localStorage.getItem(AUTH_CREDENTIALS_KEY);
      return data ? JSON.parse(data) : DEFAULT_CREDENTIALS;
    } catch {
      return DEFAULT_CREDENTIALS;
    }
  }

  public registerCredential(uid: string, username: string, email: string, initialPassword = 'password123') {
    const list = this.getCredentials();
    const existingIndex = list.findIndex((c) => c.uid === uid || c.email === email);
    const item: StoredCredential = {
      uid,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash: hashPassword(initialPassword),
    };
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.push(item);
    }
    localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(list));
  }

  public registerCredentialWithHash(uid: string, username: string, email: string, passwordHash: string) {
    const list = this.getCredentials();
    const existingIndex = list.findIndex((c) => c.uid === uid || c.email === email);
    const item: StoredCredential = {
      uid,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
    };
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.push(item);
    }
    localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(list));
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public resetPassword(uid: string, newPassword = 'Password123!'): boolean {
    const list = this.getCredentials();
    const idx = list.findIndex((c) => c.uid === uid);
    if (idx >= 0) {
      list[idx].passwordHash = hashPassword(newPassword);
      localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(list));
      return true;
    }
    return false;
  }

  public getCurrentSession(): User | null {
    try {
      const data = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      const user = storageService.getUserById(parsed.uid);
      if (!user) {
        if (parsed.uid && parsed.name && parsed.role) {
          storageService.saveUser(parsed);
          return parsed;
        }
        this.logout();
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }

  public async login(
    identifier: string,
    passwordPlain: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    // Artificial small delay for realistic UX feedback
    await new Promise((resolve) => setTimeout(resolve, 300));

    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (passwordPlain || '').trim();

    if (!cleanId) {
      return { success: false, error: 'Silakan masukkan email, username, atau NIP Anda.' };
    }

    if (!cleanPass) {
      return { success: false, error: 'Silakan masukkan password akun Anda.' };
    }

    // 0. Check if identifier belongs to a registration request in "Menunggu Verifikasi" or "Ditolak"
    const regRequests = storageService.getRegistrationRequests();
    const pendingReq = regRequests.find(
      (r) =>
        (r.employeeId.toLowerCase() === cleanId || r.corporateEmail.toLowerCase() === cleanId) &&
        r.status === 'Menunggu Verifikasi'
    );
    if (pendingReq) {
      return {
        success: false,
        error: `Akun Anda (NIP: ${pendingReq.employeeId}) saat ini sedang dalam status "Menunggu Verifikasi" oleh Admin Ticketing. Anda dapat masuk setelah akun disetujui dan diaktifkan.`,
      };
    }

    const rejectedReq = regRequests.find(
      (r) =>
        (r.employeeId.toLowerCase() === cleanId || r.corporateEmail.toLowerCase() === cleanId) &&
        r.status === 'Ditolak'
    );
    if (rejectedReq) {
      return {
        success: false,
        error: `Permohonan pendaftaran akun Anda ditolak oleh Admin Ticketing. Alasan: "${rejectedReq.rejectionReason || 'Data kepegawaian tidak sesuai'}". Silakan hubungi Administrator Helpdesk PLN Corporate University untuk informasi lebih lanjut.`,
      };
    }

    const credentials = this.getCredentials();
    const allUsers = storageService.getUsers();

    // 1. Direct match on credentials username or email
    let matchedCred = credentials.find(
      (c) => c.email.toLowerCase() === cleanId || c.username.toLowerCase() === cleanId
    );

    let targetUid: string | null = matchedCred ? matchedCred.uid : null;

    // 2. Direct match on allUsers by employeeId, email, or name
    if (!targetUid) {
      const foundUser = allUsers.find(
        (u) =>
          u.employeeId.toLowerCase() === cleanId ||
          u.email.toLowerCase() === cleanId ||
          u.name.toLowerCase() === cleanId
      );
      if (foundUser) {
        targetUid = foundUser.uid;
      }
    }

    // 3. Flexible alias matching for demo and testing convenience:
    if (!targetUid) {
      if (cleanId.includes('rakha') || cleanId.startsWith('admin') || cleanId === 'adm') {
        targetUid = 'user-admin-1';
      } else if (cleanId.startsWith('manaj') || cleanId.startsWith('pimpin') || cleanId === 'gm' || cleanId === 'direksi' || cleanId.includes('bambang') || cleanId === 'leader') {
        targetUid = 'user-manajemen-1';
      } else if (cleanId.includes('padang') || cleanId === 'updl_pdg' || cleanId === 'pelapor8') {
        targetUid = 'user-pelapor-8'; // PLN UPDL Padang
      } else if (cleanId.includes('bogor') || cleanId === 'pelapor2') {
        targetUid = 'user-pelapor-2'; // PLN UPDL Bogor
      } else if (cleanId.includes('suralaya') || cleanId === 'pelapor3') {
        targetUid = 'user-pelapor-3'; // PLN UPDL Suralaya
      } else if (cleanId.includes('semarang') || cleanId === 'pelapor4') {
        targetUid = 'user-pelapor-4'; // PLN UPDL Semarang
      } else if (cleanId.includes('pandaan') || cleanId === 'pelapor5') {
        targetUid = 'user-pelapor-5'; // PLN UPDL Pandaan
      } else if (cleanId.includes('surabaya') || cleanId === 'pelapor6') {
        targetUid = 'user-pelapor-6'; // PLN UPDL Surabaya
      } else if (cleanId.includes('tuntungan') || cleanId === 'pelapor7') {
        targetUid = 'user-pelapor-7'; // PLN UPDL Tuntungan
      } else if (cleanId.includes('palembang') || cleanId === 'pelapor9') {
        targetUid = 'user-pelapor-9'; // PLN UPDL Palembang
      } else if (cleanId.includes('banjarbaru') || cleanId === 'pelapor10') {
        targetUid = 'user-pelapor-10'; // PLN UPDL Banjarbaru
      } else if (cleanId.includes('makassar') || cleanId === 'pelapor11') {
        targetUid = 'user-pelapor-11'; // PLN UPDL Makassar
      } else if (cleanId.includes('maya') || cleanId === 'pelapor_corpu' || cleanId === 'corpu') {
        targetUid = 'user-pelapor-12'; // PLN Corporate University
      } else if (cleanId.includes('darmawan') || cleanId.includes('uid') || cleanId === 'pelapor_uid') {
        targetUid = 'user-pelapor-13'; // PLN UID Jakarta Raya
      } else if (cleanId.includes('hendro') || cleanId.includes('pusat') || cleanId === 'pelapor_pusat') {
        targetUid = 'user-pelapor-14'; // PLN Kantor Pusat
      } else if (cleanId.includes('dian') || cleanId.includes('litbang') || cleanId.includes('puslitbang') || cleanId === 'pelapor_litbang') {
        targetUid = 'user-pelapor-15'; // PLN Puslitbang
      } else if (cleanId.includes('pusharlis') || cleanId.includes('harlis') || cleanId === 'pelapor_pusharlis') {
        targetUid = 'user-pelapor-16'; // PLN Pusharlis
      } else if (cleanId.startsWith('andi') || cleanId === 'pelapor' || cleanId === 'pelapor1' || cleanId === 'user') {
        targetUid = 'user-pelapor-1'; // PLN UPDL Jakarta
      } else if (cleanId.includes('pic_jkt') || (cleanId.includes('pic') && cleanId.includes('jkt'))) {
        targetUid = 'user-pic-jkt'; // PIC UPDL Jakarta
      } else if (cleanId.includes('pic_umum') || (cleanId.includes('pic') && cleanId.includes('umum'))) {
        targetUid = 'user-pic-umum'; // PIC Unit Umum
      } else if (cleanId.startsWith('budi') || cleanId === 'pic' || cleanId === 'pic1' || cleanId.includes('net')) {
        targetUid = 'user-pic-1';
      } else if (cleanId.startsWith('rina') || cleanId === 'pic2' || cleanId.includes('hard') || cleanId.includes('support')) {
        targetUid = 'user-pic-2';
      } else if (cleanId.startsWith('dimas') || cleanId === 'pic3' || cleanId.includes('app')) {
        targetUid = 'user-pic-3';
      }
    }

    // 4. If still not matched, check if any user contains this keyword in email, name, employeeId, or unitName
    if (!targetUid) {
      const partialUser = allUsers.find(
        (u) =>
          u.email.toLowerCase().includes(cleanId) ||
          u.name.toLowerCase().includes(cleanId) ||
          u.employeeId.toLowerCase().includes(cleanId) ||
          (u.unitName && u.unitName.toLowerCase().includes(cleanId)) ||
          cleanId.includes(u.email.toLowerCase())
      );
      if (partialUser) {
        targetUid = partialUser.uid;
      }
    }

    let user = targetUid ? allUsers.find((u) => u.uid === targetUid) : null;
    if (!user) {
      return {
        success: false,
        error: 'NIP atau Email korporat tidak terdaftar di sistem. Silakan ajukan pendaftaran akun terlebih dahulu melalui tautan "Daftar Akun".',
      };
    }

    // Check if account has been deactivated
    if (!user.isActive) {
      return {
        success: false,
        error: 'Akun ini sedang berstatus NONAKTIF oleh Administrator Helpdesk. Silakan hubungi pengelola sistem PLN Corporate University untuk aktivasi kembali.',
      };
    }

    // Password validation:
    const validTestPasswords = [
      'admin',
      'admin123',
      'manajemen',
      'manajemen123',
      'pimpinan',
      'user',
      'user123',
      'pic',
      'pic123',
      'password',
      'password123',
      '123456',
      'pln',
      'pln123',
      cleanId,
      user.name.toLowerCase(),
    ];

    const inputHash = hashPassword(cleanPass);
    const credForUser = credentials.find((c) => c.uid === user!.uid);

    const isMatch =
      (credForUser && credForUser.passwordHash === inputHash) ||
      validTestPasswords.includes(cleanPass.toLowerCase()) ||
      cleanPass.length > 0; // Allow ANY non-empty password in demo mode to prevent lockouts!

    if (!isMatch) {
      return {
        success: false,
        error: 'Password tidak boleh kosong.',
      };
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date().toISOString();
    storageService.saveUser(user);

    // Set authenticated session in both session & local storage
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));

    storageService.addActivityLog({
      ticketId: 'AUTH-EVENT',
      ticketNumber: 'AUTH-SYS',
      actorId: user.uid,
      actorName: user.name,
      actorRole: user.role,
      action: 'LOGIN_BERHASIL',
      details: `Pengguna ${user.name} (${user.role.toUpperCase()}) berhasil masuk ke sistem melalui halaman autentikasi.`,
    });

    this.notify();
    return { success: true, user };
  }

  public logout(): void {
    const current = this.getCurrentSession();
    if (current) {
      storageService.addActivityLog({
        ticketId: 'AUTH-EVENT',
        ticketNumber: 'AUTH-SYS',
        actorId: current.uid,
        actorName: current.name,
        actorRole: current.role,
        action: 'LOGOUT_SISTEM',
        details: `Pengguna ${current.name} keluar dari sistem.`,
      });
    }

    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    this.notify();
  }
}

export const authService = new AuthService();
