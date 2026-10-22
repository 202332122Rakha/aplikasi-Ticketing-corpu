import {
  User,
  Ticket,
  Category,
  ActivityLog,
  Comment,
  Progress,
  AppNotification,
  SlaConfig,
  TicketStatus,
  PriorityLevel,
  Role,
  AutoAssignmentRule,
  Assignment,
  AdminAuditLog,
  Unit,
  UnitType,
  RegistrationRequest,
  RegistrationStatus,
  BatchProcessSummary,
  BatchProcessItemResult,
} from '../types';
import {
  UPDL_UNITS,
  CORPU_UNIT,
  NON_UPDL_UNITS,
  ALL_REGISTERED_UNITS,
} from '../data/unitsData';
import {
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_SLA_CONFIGS,
  INITIAL_TICKETS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_COMMENTS,
  INITIAL_PROGRESSES,
  INITIAL_NOTIFICATIONS,
  INITIAL_ASSIGNMENT_RULES,
  INITIAL_ADMIN_AUDIT_LOGS,
  INITIAL_REGISTRATION_REQUESTS,
} from '../data/initialData';
import {
  generateNextCategoryCode,
  generateCategoryAbbreviation,
  INITIAL_PREDEFINED_CODES,
  formatCategoryCode,
  isValidCategoryCode,
  parseCategoryCode,
} from '../utils/categoryHelpers';
import {
  generateNextTicketNumber,
  getNextTicketSequence,
  formatTicketNumber,
  extractCategoryAcronym,
  parseTicketNumber,
  formatTicketNumberDisplay,
  isValidTicketNumber,
} from '../utils/ticketHelpers';
import {
  getUnitByIdOrCode,
  isUpdlUnit,
  determineUnitType,
  auditAndMigrateTicketUnit,
  registerDynamicUnits,
} from '../utils/unitHelpers';
import {
  canAccessUnit,
  canAccessUnitType,
  canViewTicket,
  canUpdateTicket,
  getScopedTickets,
} from '../utils/authPermissions';

const KEYS = {
  USERS: 'pln_tickets_users_v1',
  CATEGORIES: 'pln_tickets_categories_v1',
  SLA_CONFIGS: 'pln_tickets_sla_configs_v1',
  ASSIGNMENT_RULES: 'pln_tickets_assignment_rules_v1',
  ASSIGNMENTS: 'pln_tickets_assignments_v1',
  TICKETS: 'pln_tickets_data_v1',
  LOGS: 'pln_tickets_logs_v1',
  COMMENTS: 'pln_tickets_comments_v1',
  PROGRESSES: 'pln_tickets_progresses_v1',
  NOTIFICATIONS: 'pln_tickets_notifications_v1',
  ACTIVE_USER: 'pln_tickets_active_user_v1',
  ADMIN_AUDIT_LOGS: 'pln_tickets_admin_audit_logs_v1',
  REGISTRATION_REQUESTS: 'pln_tickets_registration_requests_v1',
  UNITS: 'pln_tickets_units_v1',
};

class StorageService {
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initIfEmpty();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error reading ${key} from storage:`, e);
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.notify();
    } catch (e) {
      console.error(`Error writing ${key} to storage:`, e);
    }
  }

  public initIfEmpty(force = false) {
    if (force || !localStorage.getItem(KEYS.USERS)) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    if (force || !localStorage.getItem(KEYS.CATEGORIES)) {
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    }
    if (force || !localStorage.getItem(KEYS.SLA_CONFIGS)) {
      localStorage.setItem(KEYS.SLA_CONFIGS, JSON.stringify(INITIAL_SLA_CONFIGS));
    }
    if (force || !localStorage.getItem(KEYS.ASSIGNMENT_RULES)) {
      localStorage.setItem(KEYS.ASSIGNMENT_RULES, JSON.stringify(INITIAL_ASSIGNMENT_RULES));
    }
    if (force || !localStorage.getItem(KEYS.TICKETS)) {
      localStorage.setItem(KEYS.TICKETS, JSON.stringify(INITIAL_TICKETS));
    }
    if (force || !localStorage.getItem(KEYS.LOGS)) {
      localStorage.setItem(KEYS.LOGS, JSON.stringify(INITIAL_ACTIVITY_LOGS));
    }
    if (force || !localStorage.getItem(KEYS.COMMENTS)) {
      localStorage.setItem(KEYS.COMMENTS, JSON.stringify(INITIAL_COMMENTS));
    }
    if (force || !localStorage.getItem(KEYS.PROGRESSES)) {
      localStorage.setItem(KEYS.PROGRESSES, JSON.stringify(INITIAL_PROGRESSES));
    }
    if (force || !localStorage.getItem(KEYS.NOTIFICATIONS)) {
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
    }
    if (force || !localStorage.getItem(KEYS.ADMIN_AUDIT_LOGS)) {
      localStorage.setItem(KEYS.ADMIN_AUDIT_LOGS, JSON.stringify(INITIAL_ADMIN_AUDIT_LOGS));
    }
    if (force || !localStorage.getItem(KEYS.REGISTRATION_REQUESTS)) {
      localStorage.setItem(KEYS.REGISTRATION_REQUESTS, JSON.stringify(INITIAL_REGISTRATION_REQUESTS));
    }
    if (force || !localStorage.getItem(KEYS.UNITS)) {
      localStorage.setItem(KEYS.UNITS, JSON.stringify(ALL_REGISTERED_UNITS));
    }
    this.getUnits();
    if (force) {
      this.notify();
    }
  }

  public resetToDefault(): void {
    this.initIfEmpty(true);
  }

  // Master Data Units Management
  public getUnits(): Unit[] {
    const list = this.getItem<Unit[]>(KEYS.UNITS, ALL_REGISTERED_UNITS);
    let updated = false;

    // Backward-compatibility: Ensure official units exist and Puslitbang / Pusharlis are separated
    for (const initUnit of ALL_REGISTERED_UNITS) {
      const idx = list.findIndex(
        (u) => u.unitId === initUnit.unitId || (u.unitCode && u.unitCode === initUnit.unitCode)
      );
      if (idx === -1) {
        list.push(initUnit);
        updated = true;
      } else {
        // Fix any old merged Puslitbang / Pusharlis unit
        if (initUnit.unitId === 'unit-non-pusharlis' && list[idx].unitName !== 'PLN Pusharlis') {
          list[idx].unitName = 'PLN Pusharlis';
          list[idx].unitCode = 'PUSHARLIS';
          list[idx].unitType = 'NON_UPDL';
          updated = true;
        }
        if (initUnit.unitId === 'unit-non-puslitbang' && list[idx].unitName !== 'PLN Puslitbang') {
          list[idx].unitName = 'PLN Puslitbang';
          list[idx].unitCode = 'PUSLITBANG';
          list[idx].unitType = 'NON_UPDL';
          updated = true;
        }
      }
    }

    if (updated) {
      this.setItem(KEYS.UNITS, list);
    }

    registerDynamicUnits(list);
    return list;
  }

  public getUnitById(unitId?: string): Unit | undefined {
    if (!unitId) return undefined;
    const clean = unitId.trim().toLowerCase();
    return this.getUnits().find((u) => u.unitId.toLowerCase() === clean);
  }

  public saveUnit(unit: Unit, actor?: User): void {
    const units = this.getUnits();
    const idx = units.findIndex((u) => u.unitId === unit.unitId);
    if (idx >= 0) {
      units[idx] = { ...unit, updatedAt: new Date().toISOString() };
    } else {
      units.push(unit);
    }
    this.setItem(KEYS.UNITS, units);
    registerDynamicUnits(units);

    if (actor) {
      this.addAdminAuditLog({
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'UNIT_CHANGED',
        targetUserId: unit.unitId,
        targetUserName: unit.unitName,
        details: `Memperbarui data unit ${unit.unitName} (${unit.unitCode}). Status: ${unit.isActive ? 'Aktif' : 'Nonaktif'}, Tipe: ${unit.unitType}.`,
      });
    }
    this.notify();
  }

  public addUnit(
    unitData: {
      unitCode: string;
      unitName: string;
      unitRegion?: string;
      unitFocus?: string;
      unitType: UnitType;
      isActive?: boolean;
    },
    actor?: User
  ): { success: boolean; unit?: Unit; error?: string } {
    const cleanCode = unitData.unitCode.trim().toUpperCase();
    const cleanName = unitData.unitName.trim();
    if (!cleanCode || !cleanName) {
      return { success: false, error: 'Kode unit dan nama resmi unit wajib diisi.' };
    }

    const units = this.getUnits();
    // Duplicate check
    const dup = units.find(
      (u) =>
        u.unitCode.toUpperCase() === cleanCode ||
        u.unitName.toLowerCase() === cleanName.toLowerCase()
    );
    if (dup) {
      return { success: false, error: `Unit dengan kode "${cleanCode}" atau nama "${cleanName}" sudah terdaftar.` };
    }

    const now = new Date().toISOString();
    const cleanId = `unit-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const newUnit: Unit = {
      unitId: cleanId,
      unitCode: cleanCode,
      unitName: cleanName,
      unitRegion: (unitData.unitRegion as any) || (unitData.unitType === 'UPDL' ? 'Luar Jawa' : unitData.unitType === 'CORPU' ? 'Korporat' : 'Non-UPDL'),
      unitFocus: unitData.unitFocus || `Layanan kendala dan operasional unit ${cleanName}`,
      unitType: unitData.unitType,
      isActive: unitData.isActive !== false,
      createdAt: now,
      updatedAt: now,
    };

    units.push(newUnit);
    this.setItem(KEYS.UNITS, units);
    registerDynamicUnits(units);

    if (actor) {
      this.addAdminAuditLog({
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'UNIT_CHANGED',
        targetUserId: newUnit.unitId,
        targetUserName: newUnit.unitName,
        details: `Menambahkan master data unit baru: ${newUnit.unitName} (${newUnit.unitCode}) dengan kategori ${newUnit.unitType}.`,
      });
    }
    this.notify();
    return { success: true, unit: newUnit };
  }

  public toggleUnitActive(unitId: string, actor?: User): { success: boolean; unit?: Unit; error?: string } {
    const units = this.getUnits();
    const unit = units.find((u) => u.unitId === unitId);
    if (!unit) {
      return { success: false, error: 'Unit tidak ditemukan.' };
    }

    unit.isActive = !unit.isActive;
    unit.updatedAt = new Date().toISOString();
    this.setItem(KEYS.UNITS, units);
    registerDynamicUnits(units);

    if (actor) {
      this.addAdminAuditLog({
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'UNIT_CHANGED',
        targetUserId: unit.unitId,
        targetUserName: unit.unitName,
        details: `Mengubah status unit ${unit.unitName} (${unit.unitCode}) menjadi ${unit.isActive ? 'AKTIF' : 'NONAKTIF'}.`,
      });
    }
    this.notify();
    return { success: true, unit };
  }

  public canDeleteUnit(unitId: string): { canDelete: boolean; userCount: number; ticketCount: number; reason?: string } {
    const users = this.getUsers().filter((u) => (u.unitId || '').toLowerCase() === unitId.toLowerCase());
    const tickets = this.getTickets().filter((t) => (t.reporterUnitId || '').toLowerCase() === unitId.toLowerCase());
    const requests = this.getRegistrationRequests().filter((r) => (r.unitId || '').toLowerCase() === unitId.toLowerCase());

    const totalUsed = users.length + tickets.length + requests.length;
    if (totalUsed > 0) {
      return {
        canDelete: false,
        userCount: users.length,
        ticketCount: tickets.length,
        reason: `Unit ini masih digunakan oleh ${users.length} pengguna, ${tickets.length} tiket, dan ${requests.length} permohonan. Unit tidak boleh dihapus secara permanen untuk menjaga riwayat data, silakan gunakan fitur Nonaktifkan Unit.`,
      };
    }
    return { canDelete: true, userCount: 0, ticketCount: 0 };
  }

  public deleteUnit(unitId: string, actor?: User): { success: boolean; error?: string } {
    const check = this.canDeleteUnit(unitId);
    if (!check.canDelete) {
      return { success: false, error: check.reason };
    }

    const units = this.getUnits().filter((u) => u.unitId !== unitId);
    this.setItem(KEYS.UNITS, units);
    registerDynamicUnits(units);

    if (actor) {
      this.addAdminAuditLog({
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'UNIT_CHANGED',
        targetUserId: unitId,
        targetUserName: unitId,
        details: `Menghapus master unit kosong ${unitId}.`,
      });
    }
    this.notify();
    return { success: true };
  }

  // Active User / Auth
  public getActiveUser(): User {
    const defaultUser = INITIAL_USERS[0];
    const user = this.getItem<User>(KEYS.ACTIVE_USER, defaultUser);
    return user || defaultUser;
  }

  public setActiveUser(user: User): void {
    this.setItem(KEYS.ACTIVE_USER, user);
  }

  public setActiveUserById(userId: string): void {
    const users = this.getUsers();
    const found = users.find((u) => u.uid === userId);
    if (found) {
      this.setActiveUser(found);
    }
  }

  // Users
  public getUsers(): User[] {
    const list = this.getItem<User[]>(KEYS.USERS, INITIAL_USERS);
    let updated = false;
    for (const initUser of INITIAL_USERS) {
      const idx = list.findIndex((u) => u.uid === initUser.uid || u.email === initUser.email);
      if (idx === -1) {
        list.push(initUser);
        updated = true;
      } else {
        const existing = list[idx];
        // Enrich missing fields like position or lastLoginAt without overwriting admin's active status or custom edits
        if (!existing.position && initUser.position) {
          existing.position = initUser.position;
          updated = true;
        }
        if (!existing.lastLoginAt && initUser.lastLoginAt) {
          existing.lastLoginAt = initUser.lastLoginAt;
          updated = true;
        }
        // Crucial fix: sync official unit metadata from initUser if missing or outdated
        if (!existing.unitId || !existing.unitType || !existing.unitCode || !existing.unitName) {
          if (initUser.unitId) existing.unitId = initUser.unitId;
          if (initUser.unitName) existing.unitName = initUser.unitName;
          if (initUser.unitCode) existing.unitCode = initUser.unitCode;
          if (initUser.unitType) existing.unitType = initUser.unitType;
          updated = true;
        }
      }
    }

    // Ensure all users in list have consistent unit identity
    for (const u of list) {
      if (!u.unitId || !u.unitType || !u.unitCode || !u.unitName) {
        const primary = getUnitByIdOrCode(u.unitId || u.unitCode || u.unitName || u.department);
        if (primary) {
          u.unitId = primary.unitId;
          u.unitName = primary.unitName;
          u.unitCode = primary.unitCode;
          u.unitType = primary.unitType;
          updated = true;
        } else if (!u.unitType) {
          u.unitType = determineUnitType(u.unitId || u.unitName || u.department) as UnitType;
          if (u.unitType === 'UNCLASSIFIED' as any) u.unitType = 'UPDL';
          updated = true;
        }
      }
    }

    if (updated) {
      try {
        localStorage.setItem(KEYS.USERS, JSON.stringify(list));
      } catch (e) {
        console.error(e);
      }
    }
    return list;
  }

  // Admin Audit Logs
  public getAdminAuditLogs(): AdminAuditLog[] {
    return this.getItem<AdminAuditLog[]>(KEYS.ADMIN_AUDIT_LOGS, INITIAL_ADMIN_AUDIT_LOGS);
  }

  public addAdminAuditLog(log: Omit<AdminAuditLog, 'id' | 'createdAt'>): AdminAuditLog {
    const logs = this.getAdminAuditLogs();
    const newLog: AdminAuditLog = {
      ...log,
      id: `adm-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    logs.unshift(newLog);
    this.setItem(KEYS.ADMIN_AUDIT_LOGS, logs);
    return newLog;
  }

  // Registration Requests Management
  public getRegistrationRequests(): RegistrationRequest[] {
    return this.getItem<RegistrationRequest[]>(KEYS.REGISTRATION_REQUESTS, INITIAL_REGISTRATION_REQUESTS);
  }

  public getRegistrationRequestById(id: string): RegistrationRequest | undefined {
    return this.getRegistrationRequests().find((r) => r.id === id);
  }

  public saveRegistrationRequest(req: RegistrationRequest): void {
    const list = this.getRegistrationRequests();
    const idx = list.findIndex((r) => r.id === req.id);
    if (idx >= 0) {
      list[idx] = req;
    } else {
      list.unshift(req);
    }
    this.setItem(KEYS.REGISTRATION_REQUESTS, list);
  }

  public addRegistrationRequest(
    data: Omit<RegistrationRequest, 'id' | 'submittedAt' | 'status'>
  ): { success: boolean; request?: RegistrationRequest; error?: string } {
    const cleanNip = data.employeeId.trim();
    const cleanEmail = data.corporateEmail.trim().toLowerCase();

    // Check duplicate in active users
    const allUsers = this.getUsers();
    const existingUser = allUsers.find(
      (u) =>
        u.employeeId.toLowerCase() === cleanNip.toLowerCase() ||
        u.email.toLowerCase() === cleanEmail
    );
    if (existingUser) {
      return {
        success: false,
        error: `NIP (${cleanNip}) atau email korporat (${cleanEmail}) sudah terdaftar sebagai akun aktif pengguna di sistem. Silakan masuk langsung melalui halaman login.`,
      };
    }

    // Check duplicate in existing pending registration requests
    const requests = this.getRegistrationRequests();
    const existingReq = requests.find(
      (r) =>
        (r.employeeId.toLowerCase() === cleanNip.toLowerCase() ||
          r.corporateEmail.toLowerCase() === cleanEmail) &&
        (r.status === 'Menunggu Verifikasi' || r.status === 'PENDING')
    );
    if (existingReq) {
      return {
        success: false,
        error: `NIP (${cleanNip}) atau email (${cleanEmail}) sudah memiliki permohonan yang sedang menunggu verifikasi oleh Admin Ticketing. Mohon tunggu proses persetujuan.`,
      };
    }

    const newId = `REG-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(
      Math.floor(100 + Math.random() * 900)
    )}`;

    const newReq: RegistrationRequest = {
      ...data,
      employeeId: cleanNip,
      corporateEmail: cleanEmail,
      id: newId,
      status: 'Menunggu Verifikasi',
      submittedAt: new Date().toISOString(),
    };

    requests.unshift(newReq);
    this.setItem(KEYS.REGISTRATION_REQUESTS, requests);

    // Otomatis kirim notifikasi ke seluruh Admin Ticketing aktif
    const allAdmins = allUsers.filter((u) => u.role === 'admin' && u.isActive);
    const notifTimestamp = new Date().toISOString();
    allAdmins.forEach((admin) => {
      this.addNotification({
        recipientId: admin.uid,
        ticketId: newReq.id,
        ticketNumber: newReq.id,
        title: 'Pendaftaran Karyawan Baru',
        message: 'Terdapat permohonan akun karyawan baru yang membutuhkan pemeriksaan.',
        type: 'registration',
        registrationDetails: {
          requestId: newReq.id,
          fullName: newReq.fullName,
          employeeId: newReq.employeeId,
          corporateEmail: newReq.corporateEmail,
          unitName: newReq.unitName,
          submittedAt: notifTimestamp,
          status: 'Menunggu Verifikasi',
        },
      });
    });

    return { success: true, request: newReq };
  }

  public approveRegistrationRequest(
    requestId: string,
    assignedRole: Role,
    actor: User,
    confirmedUnitId?: string
  ): { success: boolean; user?: User; error?: string } {
    if (actor.role !== 'admin') {
      return { success: false, error: 'Hanya Administrator Ticketing yang berwenang menyetujui permohonan pendaftaran.' };
    }

    const requests = this.getRegistrationRequests();
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) {
      return { success: false, error: 'Permohonan pendaftaran tidak ditemukan.' };
    }
    const req = requests[reqIndex];
    if (req.status !== 'Menunggu Verifikasi' && req.status !== 'PENDING') {
      return { success: false, error: `Permohonan sudah berstatus ${req.status}.` };
    }

    // Resolve target confirmed unit from Master Data
    const effectiveTargetUnitId = confirmedUnitId || req.unitId;
    let verifiedUnit = getUnitByIdOrCode(effectiveTargetUnitId);

    // If unit was a custom/manual request and confirmed as such, automatically add to Master Data!
    if ((effectiveTargetUnitId === 'unit-pending-custom' || !verifiedUnit) && (req.requestedUnitName || req.unitName)) {
      const candidateName = (req.requestedUnitName || req.unitName).replace(/\s+/g, ' ').trim();
      const existingByName = this.getUnits().find((u) => u.unitName.toLowerCase() === candidateName.toLowerCase());
      if (existingByName) {
        verifiedUnit = existingByName;
      } else {
        const uType: UnitType = req.requestedUnitCategory || req.unitType || 'NON_UPDL';
        const addRes = this.addUnit({
          unitCode: candidateName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 12),
          unitName: candidateName,
          unitType: uType,
          unitRegion: uType === 'UPDL' ? candidateName.replace(/^PLN\s+UPDL\s+/i, '') : 'Indonesia',
          unitFocus: 'Layanan Pembelajaran & Penugasan Unit',
          isActive: true,
        }, actor);
        if (addRes.success && addRes.unit) {
          verifiedUnit = addRes.unit;
        }
      }
    }

    const finalUnitId = verifiedUnit ? verifiedUnit.unitId : req.unitId;
    const finalUnitName = verifiedUnit ? verifiedUnit.unitName : req.unitName;
    const finalUnitCode = verifiedUnit ? verifiedUnit.unitCode : req.unitCode;
    const finalUnitType: UnitType = verifiedUnit ? verifiedUnit.unitType : (req.unitType || 'UPDL');

    // Create user in system with verified unit
    const newUid = `user-reg-${Date.now()}`;
    const newUser: User = {
      uid: newUid,
      employeeId: req.employeeId,
      name: req.fullName,
      email: req.corporateEmail,
      department: req.position || 'Divisi Operasional & Diklat',
      position: req.position,
      role: assignedRole,
      unitId: finalUnitId,
      unitName: finalUnitName,
      unitCode: finalUnitCode,
      unitType: finalUnitType,
      isActive: true,
      phone: req.phone,
      createdAt: new Date().toISOString(),
    };

    // Save user permanently
    this.saveUser(newUser);

    // Save credential for login authentication
    try {
      const AUTH_CREDENTIALS_KEY = 'pln_corpu_credentials_v2';
      const rawCreds = localStorage.getItem(AUTH_CREDENTIALS_KEY);
      const credList = rawCreds ? JSON.parse(rawCreds) : [];
      const existingIdx = credList.findIndex((c: any) => c.uid === newUser.uid || c.email === newUser.email.toLowerCase());
      const newCred = {
        uid: newUser.uid,
        username: (req.username || newUser.employeeId).toLowerCase(),
        email: newUser.email.toLowerCase(),
        passwordHash: req.passwordHash || 'hash_5ec04434',
      };
      if (existingIdx >= 0) {
        credList[existingIdx] = newCred;
      } else {
        credList.push(newCred);
      }
      localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(credList));
    } catch (e) {
      console.warn('Failed to register auth credential for approved user', e);
    }

    // Update request
    req.status = 'Disetujui';
    req.assignedRole = assignedRole;
    req.processedAt = new Date().toISOString();
    req.processedByAdminId = actor.uid;
    req.processedByAdminName = actor.name;
    requests[reqIndex] = req;
    this.setItem(KEYS.REGISTRATION_REQUESTS, requests);

    // Buat notifikasi hasil persetujuan untuk pendaftar
    this.addNotification({
      recipientId: newUser.uid,
      ticketId: req.id,
      ticketNumber: req.id,
      title: 'Pendaftaran Akun Disetujui',
      message: 'Selamat, pendaftaran akun Anda telah disetujui oleh Admin Ticketing. Silakan masuk menggunakan kredensial yang telah Anda daftarkan.',
      type: 'registration',
      registrationDetails: {
        requestId: req.id,
        fullName: req.fullName,
        employeeId: req.employeeId,
        corporateEmail: req.corporateEmail,
        unitName: req.unitName,
        submittedAt: req.submittedAt,
        status: 'Disetujui',
      },
    });

    // Log admin audit
    this.addAdminAuditLog({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'REGISTRATION_APPROVED',
      targetUserId: newUser.uid,
      targetUserName: newUser.name,
      targetUserNip: newUser.employeeId,
      details: `Menyetujui permohonan pendaftaran akun ${newUser.name} (NIP: ${newUser.employeeId}, Unit: ${newUser.unitName}) dengan hak akses peran ${assignedRole.toUpperCase()}.`,
    });

    return { success: true, user: newUser };
  }

  public rejectRegistrationRequest(
    requestId: string,
    reason: string,
    actor: User
  ): { success: boolean; error?: string } {
    if (actor.role !== 'admin') {
      return { success: false, error: 'Hanya Administrator Ticketing yang berwenang menolak permohonan pendaftaran.' };
    }

    const requests = this.getRegistrationRequests();
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) {
      return { success: false, error: 'Permohonan pendaftaran tidak ditemukan.' };
    }
    const req = requests[reqIndex];
    if (req.status !== 'Menunggu Verifikasi' && req.status !== 'PENDING') {
      return { success: false, error: `Permohonan sudah berstatus ${req.status}.` };
    }

    req.status = 'Ditolak';
    req.rejectionReason = reason;
    req.processedAt = new Date().toISOString();
    req.processedByAdminId = actor.uid;
    req.processedByAdminName = actor.name;
    requests[reqIndex] = req;
    this.setItem(KEYS.REGISTRATION_REQUESTS, requests);

    // Buat notifikasi hasil penolakan untuk pendaftar
    this.addNotification({
      recipientId: req.id,
      ticketId: req.id,
      ticketNumber: req.id,
      title: 'Pendaftaran Akun Belum Disetujui',
      message: 'Mohon maaf, permohonan akun Anda belum dapat disetujui. Silakan periksa alasan penolakan dan hubungi Admin Ticketing jika memerlukan klarifikasi.',
      type: 'registration',
      registrationDetails: {
        requestId: req.id,
        fullName: req.fullName,
        employeeId: req.employeeId,
        corporateEmail: req.corporateEmail,
        unitName: req.unitName,
        submittedAt: req.submittedAt,
        status: 'Ditolak',
      },
    });

    this.addAdminAuditLog({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'REGISTRATION_REJECTED',
      targetUserId: req.id,
      targetUserName: req.fullName,
      targetUserNip: req.employeeId,
      details: `Menolak permohonan pendaftaran akun ${req.fullName} (NIP: ${req.employeeId}, Unit: ${req.unitName}). Alasan: ${reason}`,
    });

    return { success: true };
  }

  public getRegistrationByNipOrEmail(query: string): RegistrationRequest | undefined {
    const q = (query || '').trim().toLowerCase();
    if (!q) return undefined;
    return this.getRegistrationRequests().find(
      (r) =>
        r.employeeId.toLowerCase() === q ||
        r.corporateEmail.toLowerCase() === q ||
        r.id.toLowerCase() === q
    );
  }

  public deleteRegistrationRequest(requestId: string): void {
    const list = this.getRegistrationRequests().filter((r) => r.id !== requestId);
    this.setItem(KEYS.REGISTRATION_REQUESTS, list);
    this.notify();
  }

  /**
   * Pemrosesan Persetujuan Massal (Batch Approval)
   * Mendukung hingga 1.000+ permohonan dengan chunking, konsistensi data,
   * aktivasi akun nyata, dan audit log lengkap.
   */
  public async batchApproveRegistrationRequests(options: {
    requestIds: string[];
    assignedRole: Role;
    actor: User;
    onProgress?: (processed: number, total: number, currentItem: string) => void;
  }): Promise<BatchProcessSummary> {
    const { requestIds, assignedRole, actor, onProgress } = options;
    const startedAt = new Date().toISOString();

    if (actor.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Administrator Ticketing yang berwenang menyetujui permohonan.');
    }

    // Deduplikasi target IDs
    const uniqueIds = Array.from(new Set(requestIds));
    const requests = this.getRegistrationRequests();
    const reqMap = new Map(requests.map((r) => [r.id, r]));

    // Read credentials
    const AUTH_CREDENTIALS_KEY = 'pln_corpu_credentials_v2';
    let credList: any[] = [];
    try {
      const rawCreds = localStorage.getItem(AUTH_CREDENTIALS_KEY);
      credList = rawCreds ? JSON.parse(rawCreds) : [];
    } catch {
      credList = [];
    }
    const credMap = new Map(credList.map((c) => [c.email.toLowerCase(), c]));

    const itemsResult: BatchProcessItemResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const newUsersToSave: User[] = [];
    const newNotificationsToSave: AppNotification[] = [];

    const total = uniqueIds.length;
    const CHUNK_SIZE = 50;

    for (let i = 0; i < total; i++) {
      const reqId = uniqueIds[i];
      const req = reqMap.get(reqId);

      if (!req) {
        failedCount++;
        itemsResult.push({
          requestId: reqId,
          fullName: 'Data Tidak Ditemukan',
          employeeId: '-',
          status: 'FAILED',
          reason: 'Data permohonan tidak ditemukan dalam database.',
        });
      } else if (req.status === 'Disetujui' || req.status === 'APPROVED') {
        skippedCount++;
        itemsResult.push({
          requestId: req.id,
          fullName: req.fullName,
          employeeId: req.employeeId,
          corporateEmail: req.corporateEmail,
          unitName: req.unitName,
          status: 'SKIPPED',
          reason: 'Permohonan sudah berstatus Disetujui sebelumnya.',
        });
      } else if (req.status === 'Ditolak' || req.status === 'REJECTED') {
        skippedCount++;
        itemsResult.push({
          requestId: req.id,
          fullName: req.fullName,
          employeeId: req.employeeId,
          corporateEmail: req.corporateEmail,
          unitName: req.unitName,
          status: 'SKIPPED',
          reason: 'Permohonan sudah berstatus Ditolak sebelumnya.',
        });
      } else {
        try {
          const newUid = `user-reg-${Date.now()}-${i}`;
          const newUser: User = {
            uid: newUid,
            employeeId: req.employeeId,
            name: req.fullName,
            email: req.corporateEmail,
            department: req.position || 'Divisi Operasional & Diklat',
            position: req.position,
            role: assignedRole,
            unitId: req.unitId,
            unitName: req.unitName,
            unitCode: req.unitCode,
            unitType: req.unitType,
            isActive: true,
            phone: req.phone,
            createdAt: new Date().toISOString(),
          };

          // Save credential in memory map
          const newCred = {
            uid: newUser.uid,
            username: newUser.employeeId.toLowerCase(),
            email: newUser.email.toLowerCase(),
            passwordHash: req.passwordHash || 'hash_5ec04434',
          };
          credMap.set(newUser.email.toLowerCase(), newCred);
          newUsersToSave.push(newUser);

          // Update request status
          req.status = 'Disetujui';
          req.assignedRole = assignedRole;
          req.processedAt = new Date().toISOString();
          req.processedByAdminId = actor.uid;
          req.processedByAdminName = actor.name;

          // Buat notifikasi hasil persetujuan untuk pendaftar
          newNotificationsToSave.push({
            id: `notif-reg-${Date.now()}-${i}`,
            recipientId: newUser.uid,
            ticketId: req.id,
            ticketNumber: req.id,
            title: 'Pendaftaran Akun Disetujui',
            message: 'Selamat, pendaftaran akun Anda telah disetujui oleh Admin Ticketing. Silakan masuk menggunakan kredensial yang telah Anda daftarkan.',
            type: 'registration',
            isRead: false,
            createdAt: new Date().toISOString(),
            registrationDetails: {
              requestId: req.id,
              fullName: req.fullName,
              employeeId: req.employeeId,
              corporateEmail: req.corporateEmail,
              unitName: req.unitName,
              submittedAt: req.submittedAt,
              status: 'Disetujui',
            },
          });

          successCount++;
          itemsResult.push({
            requestId: req.id,
            fullName: req.fullName,
            employeeId: req.employeeId,
            corporateEmail: req.corporateEmail,
            unitName: req.unitName,
            status: 'SUCCESS',
          });
        } catch (itemErr: any) {
          failedCount++;
          itemsResult.push({
            requestId: req.id,
            fullName: req.fullName,
            employeeId: req.employeeId,
            corporateEmail: req.corporateEmail,
            unitName: req.unitName,
            status: 'FAILED',
            reason: itemErr?.message || 'Gagal memproses aktivasi akun.',
          });
        }
      }

      // Yield UI event loop and trigger progress callback
      if (onProgress && (i % 5 === 0 || i === total - 1)) {
        onProgress(i + 1, total, req ? `${req.fullName} (${req.employeeId})` : reqId);
      }
      if (i % CHUNK_SIZE === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    // Persist all updated registration requests
    this.setItem(KEYS.REGISTRATION_REQUESTS, requests);

    // Persist new users
    if (newUsersToSave.length > 0) {
      const currentUsers = this.getUsers();
      currentUsers.push(...newUsersToSave);
      this.setItem(KEYS.USERS, currentUsers);
    }

    // Persist credentials
    try {
      localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(Array.from(credMap.values())));
    } catch (e) {
      console.warn('Failed to save batch credentials', e);
    }

    // Persist notifications (capped to prevent localStorage overflow)
    if (newNotificationsToSave.length > 0) {
      const existingNotifs = this.getNotifications();
      const combinedNotifs = [...newNotificationsToSave, ...existingNotifs].slice(0, 1000);
      this.setItem(KEYS.NOTIFICATIONS, combinedNotifs);
    }

    // Comprehensive Admin Audit Log
    const completedAt = new Date().toISOString();
    this.addAdminAuditLog({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'BATCH_REGISTRATION_APPROVED',
      targetUserId: `BATCH-${Date.now()}`,
      targetUserName: `${successCount} Akun Karyawan`,
      details: `Eksekusi Persetujuan Massal: ${successCount} berhasil disetujui & diaktifkan (peran: ${assignedRole.toUpperCase()}), ${failedCount} gagal, ${skippedCount} dilewati dari total ${total} target permohonan.`,
    });

    this.notify();

    return {
      action: 'APPROVE',
      totalRequested: total,
      successCount,
      failedCount,
      skippedCount,
      items: itemsResult,
      startedAt,
      completedAt,
      actorName: actor.name,
      assignedRoleCommon: assignedRole,
    };
  }

  /**
   * Pemrosesan Penolakan Massal (Batch Rejection)
   * Wajib mencatat alasan penolakan untuk seluruh target,
   * memperbarui status, dan mencatat riwayat audit.
   */
  public async batchRejectRegistrationRequests(options: {
    requestIds: string[];
    reason: string;
    actor: User;
    onProgress?: (processed: number, total: number, currentItem: string) => void;
  }): Promise<BatchProcessSummary> {
    const { requestIds, reason, actor, onProgress } = options;
    const startedAt = new Date().toISOString();

    if (actor.role !== 'admin') {
      throw new Error('Akses ditolak: Hanya Administrator Ticketing yang berwenang menolak permohonan.');
    }
    const cleanReason = (reason || '').trim();
    if (!cleanReason || cleanReason.length < 5) {
      throw new Error('Alasan penolakan wajib diisi secara jelas (minimal 5 karakter).');
    }

    const uniqueIds = Array.from(new Set(requestIds));
    const requests = this.getRegistrationRequests();
    const reqMap = new Map(requests.map((r) => [r.id, r]));

    const itemsResult: BatchProcessItemResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const newNotificationsToSave: AppNotification[] = [];
    const total = uniqueIds.length;
    const CHUNK_SIZE = 50;

    for (let i = 0; i < total; i++) {
      const reqId = uniqueIds[i];
      const req = reqMap.get(reqId);

      if (!req) {
        failedCount++;
        itemsResult.push({
          requestId: reqId,
          fullName: 'Data Tidak Ditemukan',
          employeeId: '-',
          status: 'FAILED',
          reason: 'Data permohonan tidak ditemukan.',
        });
      } else if (req.status === 'Disetujui' || req.status === 'APPROVED') {
        skippedCount++;
        itemsResult.push({
          requestId: req.id,
          fullName: req.fullName,
          employeeId: req.employeeId,
          corporateEmail: req.corporateEmail,
          unitName: req.unitName,
          status: 'SKIPPED',
          reason: 'Permohonan sudah berstatus Disetujui sebelumnya.',
        });
      } else if (req.status === 'Ditolak' || req.status === 'REJECTED') {
        skippedCount++;
        itemsResult.push({
          requestId: req.id,
          fullName: req.fullName,
          employeeId: req.employeeId,
          corporateEmail: req.corporateEmail,
          unitName: req.unitName,
          status: 'SKIPPED',
          reason: 'Permohonan sudah berstatus Ditolak sebelumnya.',
        });
      } else {
        try {
          req.status = 'Ditolak';
          req.rejectionReason = cleanReason;
          req.processedAt = new Date().toISOString();
          req.processedByAdminId = actor.uid;
          req.processedByAdminName = actor.name;

          newNotificationsToSave.push({
            id: `notif-reg-${Date.now()}-${i}`,
            recipientId: req.id,
            ticketId: req.id,
            ticketNumber: req.id,
            title: 'Pendaftaran Akun Belum Disetujui',
            message: `Mohon maaf, permohonan akun Anda belum dapat disetujui. Alasan: "${cleanReason}". Hubungi Administrator Helpdesk PLN CorpU jika memerlukan klarifikasi.`,
            type: 'registration',
            isRead: false,
            createdAt: new Date().toISOString(),
            registrationDetails: {
              requestId: req.id,
              fullName: req.fullName,
              employeeId: req.employeeId,
              corporateEmail: req.corporateEmail,
              unitName: req.unitName,
              submittedAt: req.submittedAt,
              status: 'Ditolak',
            },
          });

          successCount++;
          itemsResult.push({
            requestId: req.id,
            fullName: req.fullName,
            employeeId: req.employeeId,
            corporateEmail: req.corporateEmail,
            unitName: req.unitName,
            status: 'SUCCESS',
          });
        } catch (itemErr: any) {
          failedCount++;
          itemsResult.push({
            requestId: req.id,
            fullName: req.fullName,
            employeeId: req.employeeId,
            corporateEmail: req.corporateEmail,
            unitName: req.unitName,
            status: 'FAILED',
            reason: itemErr?.message || 'Gagal mengubah status permohonan.',
          });
        }
      }

      if (onProgress && (i % 5 === 0 || i === total - 1)) {
        onProgress(i + 1, total, req ? `${req.fullName} (${req.employeeId})` : reqId);
      }
      if (i % CHUNK_SIZE === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    this.setItem(KEYS.REGISTRATION_REQUESTS, requests);

    if (newNotificationsToSave.length > 0) {
      const existingNotifs = this.getNotifications();
      const combinedNotifs = [...newNotificationsToSave, ...existingNotifs].slice(0, 1000);
      this.setItem(KEYS.NOTIFICATIONS, combinedNotifs);
    }

    const completedAt = new Date().toISOString();
    this.addAdminAuditLog({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'BATCH_REGISTRATION_REJECTED',
      targetUserId: `BATCH-${Date.now()}`,
      targetUserName: `${successCount} Permohonan Karyawan`,
      details: `Eksekusi Penolakan Massal: ${successCount} berhasil ditolak (Alasan: "${cleanReason}"), ${failedCount} gagal, ${skippedCount} dilewati dari total ${total} target permohonan.`,
    });

    this.notify();

    return {
      action: 'REJECT',
      totalRequested: total,
      successCount,
      failedCount,
      skippedCount,
      items: itemsResult,
      startedAt,
      completedAt,
      actorName: actor.name,
      rejectionReasonCommon: cleanReason,
    };
  }

  /**
   * Helper Pengujian Skala Besar (Section 9):
   * Menghasilkan batch data permohonan realistis untuk menguji skenario 50, 250, atau 1.000 permohonan
   */
  public generateBulkMockRegistrations(count: number = 50): { addedCount: number } {
    const units = [
      { unitId: 'unit-updl-jkt', unitName: 'PLN UPDL Jakarta', unitCode: 'UPDL_JKT', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-bgr', unitName: 'PLN UPDL Bogor', unitCode: 'UPDL_BGR', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-srl', unitName: 'PLN UPDL Suralaya', unitCode: 'UPDL_SRL', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-smg', unitName: 'PLN UPDL Semarang', unitCode: 'UPDL_SMG', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-pdn', unitName: 'PLN UPDL Pandaan', unitCode: 'UPDL_PDN', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-sby', unitName: 'PLN UPDL Surabaya', unitCode: 'UPDL_SBY', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-plb', unitName: 'PLN UPDL Palembang', unitCode: 'UPDL_PLB', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-pdg', unitName: 'PLN UPDL Padang', unitCode: 'UPDL_PDG', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-mdn', unitName: 'PLN UPDL Medan', unitCode: 'UPDL_MDN', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-bjb', unitName: 'PLN UPDL Banjarbaru', unitCode: 'UPDL_BJB', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-updl-mks', unitName: 'PLN UPDL Makassar', unitCode: 'UPDL_MKS', unitType: 'UPDL' as UnitType },
      { unitId: 'unit-corpu-pusat', unitName: 'PLN Corporate University', unitCode: 'PLN_CORPU', unitType: 'NON_UPDL' as UnitType },
    ];

    const firstNames = [
      'Bambang', 'Agus', 'Dwi', 'Tri', 'Eko', 'Hendra', 'Fajar', 'Arif', 'Rina', 'Dewi',
      'Sri', 'Nur', 'Yusuf', 'Ilham', 'Indra', 'Rian', 'Bayu', 'Wawan', 'Siti', 'Ayu',
      'Gunawan', 'Hartono', 'Prasetyo', 'Kurniawan', 'Hidayat', 'Firmansyah', 'Santoso', 'Wijaya'
    ];
    const lastNames = [
      'Pratama', 'Saputra', 'Kusuma', 'Nugroho', 'Wibowo', 'Setiawan', 'Susanto', 'Haryanto',
      'Siregar', 'Nasution', 'Lubis', 'Simanjuntak', 'Pangestu', 'Subekti', 'Utomo', 'Mulyono',
      'Purnama', 'Syahputra', 'Mahendra', 'Wardhana'
    ];

    const positions = [
      'Staf Pelaksana Diklat & Pembelajaran',
      'Teknisi Pemeliharaan Jaringan Transmisi',
      'Operator Gardu Induk & Distribusi',
      'Instruktur Akademi Kepemimpinan',
      'Analis Manajemen Aset & Logistik',
      'Staf Pengadaan Barang & Jasa',
      'Analis K3L & Keselamatan Ketenagalistrikan',
      'Spesialis Pengolahan Data & Sistem Informasi',
      'Petugas Pelayanan & Hubungan Pelanggan',
      'Koordinator Administrasi Akademik',
    ];

    const currentRequests = this.getRegistrationRequests();
    const existingNips = new Set(currentRequests.map((r) => r.employeeId.toLowerCase()));
    const newItems: RegistrationRequest[] = [];

    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${fn} ${ln}`;
      const year = 1985 + Math.floor(Math.random() * 16);
      const randNum = String(1000 + Math.floor(Math.random() * 8999));
      const nip = `${year}${randNum}-PLN`;

      if (existingNips.has(nip.toLowerCase())) continue;
      existingNips.add(nip.toLowerCase());

      const emailSlug = `${fn.toLowerCase()}.${ln.toLowerCase()}${randNum.slice(0, 2)}@pln.co.id`;
      const unit = units[Math.floor(Math.random() * units.length)];
      const pos = positions[Math.floor(Math.random() * positions.length)];
      const minutesAgo = Math.floor(Math.random() * 2880); // within last 48 hours
      const submittedAt = new Date(now - minutesAgo * 60000).toISOString();

      const newId = `REG-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(
        Math.floor(1000 + Math.random() * 8999)
      )}`;

      newItems.push({
        id: newId,
        fullName,
        employeeId: nip,
        corporateEmail: emailSlug,
        unitId: unit.unitId,
        unitName: unit.unitName,
        unitCode: unit.unitCode,
        unitType: unit.unitType,
        position: pos,
        phone: `0812${String(Math.floor(10000000 + Math.random() * 89999999))}`,
        passwordHash: 'hash_5ec04434',
        agreedToTerms: true,
        status: 'Menunggu Verifikasi',
        submittedAt,
      });
    }

    const updated = [...newItems, ...currentRequests];
    this.setItem(KEYS.REGISTRATION_REQUESTS, updated);
    this.notify();

    return { addedCount: newItems.length };
  }

  // Count active tickets for a user (as PIC)
  public getActiveTicketsForPic(picId: string): Ticket[] {
    const activeStatuses: TicketStatus[] = [
      'Baru',
      'Diverifikasi',
      'Ditugaskan',
      'Dalam Proses',
      'Menunggu Pelapor',
      'Menunggu Pihak Ketiga',
      'Menunggu Persetujuan',
    ];
    return this.getTickets().filter(
      (t) => t.currentPicId === picId && activeStatuses.includes(t.status)
    );
  }

  // Reassign all active tickets from one PIC to another
  public reassignActiveTickets(
    fromPicId: string,
    toPicId: string,
    actor: User,
    reason: string = 'Pengalihan beban penugasan (PIC dinonaktifkan)'
  ): { count: number; reassignedTicketNumbers: string[] } {
    const toPic = this.getUserById(toPicId);
    const fromPic = this.getUserById(fromPicId);
    if (!toPic) {
      throw new Error('PIC tujuan tidak ditemukan.');
    }

    const tickets = this.getTickets();
    const activeStatuses: TicketStatus[] = [
      'Baru',
      'Diverifikasi',
      'Ditugaskan',
      'Dalam Proses',
      'Menunggu Pelapor',
      'Menunggu Pihak Ketiga',
      'Menunggu Persetujuan',
    ];

    const reassignedNumbers: string[] = [];
    const timestamp = new Date().toISOString();

    for (const t of tickets) {
      if (t.currentPicId === fromPicId && activeStatuses.includes(t.status)) {
        t.currentPicId = toPic.uid;
        t.currentPicName = toPic.name;
        t.currentPicTeam = toPic.team || t.currentPicTeam;
        t.assignedPicId = toPic.uid;
        t.assignedTeam = toPic.team || t.assignedTeam;
        t.assignmentStatus = 'reassigned';
        t.updatedAt = timestamp;
        t.assignedAt = timestamp;
        if (t.status === 'Baru' || t.status === 'Diverifikasi') {
          t.status = 'Ditugaskan';
        }

        reassignedNumbers.push(t.ticketNumber);

        this.addActivityLog({
          ticketId: t.id,
          ticketNumber: t.ticketNumber,
          actorId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'PENGALIHAN_PIC',
          beforeValue: `${fromPic?.name || fromPicId}`,
          afterValue: `${toPic.name} (${toPic.team || 'Tim Teknis'})`,
          details: `Tiket dialihkan dari ${fromPic?.name || 'PIC sebelumnya'} kepada ${toPic.name}. Alasan: ${reason}`,
        });

        this.addNotification({
          recipientId: toPic.uid,
          ticketId: t.id,
          ticketNumber: t.ticketNumber,
          title: 'Pengalihan Tiket Masuk',
          message: `Tiket #${t.ticketNumber} "${t.title}" telah dialihkan kepada Anda oleh Admin Helpdesk.`,
          type: 'assignment',
        });
      }
    }

    this.setItem(KEYS.TICKETS, tickets);

    if (reassignedNumbers.length > 0) {
      this.addAdminAuditLog({
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'TICKETS_REASSIGNED',
        targetUserId: fromPicId,
        targetUserName: fromPic?.name || fromPicId,
        targetUserNip: fromPic?.employeeId,
        details: `Mengalihkan ${reassignedNumbers.length} tiket aktif (${reassignedNumbers.join(', ')}) dari ${fromPic?.name || 'PIC'} kepada ${toPic.name}. Alasan: ${reason}`,
      });
    }

    return {
      count: reassignedNumbers.length,
      reassignedTicketNumbers: reassignedNumbers,
    };
  }

  // Check safety rule: protect last admin and prevent self-role demotion
  public validateRoleChange(
    targetUser: User,
    newRole: Role,
    actor: User
  ): { valid: boolean; message?: string } {
    if (targetUser.uid === actor.uid && newRole !== actor.role) {
      return {
        valid: false,
        message: 'Demi kepatuhan keamanan, Anda tidak dapat mengubah peran (role) akun Anda sendiri.',
      };
    }

    if (targetUser.role === 'admin' && newRole !== 'admin') {
      const activeAdmins = this.getUsers().filter(
        (u) => u.role === 'admin' && u.isActive && u.uid !== targetUser.uid
      );
      if (activeAdmins.length === 0) {
        return {
          valid: false,
          message: 'Gagal: Akun ini merupakan Administrator aktif terakhir di sistem. Anda tidak dapat mencabut hak akses admin terakhir.',
        };
      }
    }

    return { valid: true };
  }

  // Check safety rule: protect last admin deactivation
  public validateStatusChange(
    targetUser: User,
    newStatus: boolean,
    actor: User
  ): { valid: boolean; message?: string } {
    if (!newStatus && targetUser.uid === actor.uid) {
      return {
        valid: false,
        message: 'Anda tidak dapat menonaktifkan akun yang sedang aktif digunakan login saat ini.',
      };
    }

    if (!newStatus && targetUser.role === 'admin') {
      const activeAdmins = this.getUsers().filter(
        (u) => u.role === 'admin' && u.isActive && u.uid !== targetUser.uid
      );
      if (activeAdmins.length === 0) {
        return {
          valid: false,
          message: 'Gagal: Tidak dapat menonaktifkan akun Administrator aktif terakhir di sistem.',
        };
      }
    }

    return { valid: true };
  }

  public getUserById(uid: string): User | undefined {
    return this.getUsers().find((u) => u.uid === uid);
  }

  public saveUser(user: User): void {
    // Enforce consistent unit fields before saving
    if (!user.unitType || !user.unitId || !user.unitCode || !user.unitName) {
      const primary = getUnitByIdOrCode(user.unitId || user.unitCode || user.unitName || user.department);
      if (primary) {
        user.unitId = primary.unitId;
        user.unitName = primary.unitName;
        user.unitCode = primary.unitCode;
        user.unitType = primary.unitType;
      } else if (!user.unitType) {
        user.unitType = determineUnitType(user.unitId || user.unitName || user.department) as UnitType;
        if (user.unitType === 'UNCLASSIFIED' as any) user.unitType = 'UPDL';
      }
    }

    const users = this.getUsers();
    const index = users.findIndex((u) => u.uid === user.uid);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.setItem(KEYS.USERS, users);
    
    const active = this.getActiveUser();
    if (active.uid === user.uid) {
      this.setActiveUser(user);
    }
    this.notify();
  }

  // Categories
  public getCategories(): Category[] {
    const list = this.getItem<Category[]>(KEYS.CATEGORIES, INITIAL_CATEGORIES);
    let updated = false;

    // Backward-compatibility: Ensure every category has a valid code conforming to #XXXX-MM-YYYY-NNN
    for (const cat of list) {
      if (!cat.code || !isValidCategoryCode(cat.code)) {
        if (INITIAL_PREDEFINED_CODES[cat.id]) {
          cat.code = INITIAL_PREDEFINED_CODES[cat.id];
        } else {
          const parsed = parseCategoryCode(cat.code || '');
          if (parsed) {
            cat.code = formatCategoryCode(parsed.abbr, parsed.month, parsed.year, parsed.seq);
          } else {
            cat.code = generateNextCategoryCode(cat.name, list);
          }
        }
        updated = true;
      }
      if (!cat.createdAt) {
        cat.createdAt = new Date().toISOString();
        updated = true;
      }
    }

    // Ensure all predefined initial categories exist in case the user has partial old cache
    for (const initCat of INITIAL_CATEGORIES) {
      const idx = list.findIndex((c) => c.id === initCat.id);
      if (idx === -1) {
        list.push(initCat);
        updated = true;
      } else if (list[idx].code !== initCat.code && INITIAL_PREDEFINED_CODES[initCat.id]) {
        list[idx].code = initCat.code;
        if (!list[idx].createdAt) {
          list[idx].createdAt = initCat.createdAt;
        }
        updated = true;
      }
    }

    if (updated) {
      this.setItem(KEYS.CATEGORIES, list);
    }
    return list;
  }

  public getCategoryById(categoryId: string): Category | undefined {
    return this.getCategories().find((c) => c.id === categoryId);
  }

  public getNextCategoryCode(name: string, customAbbr?: string, month?: number | string, year?: number): string {
    const categories = this.getCategories();
    return generateNextCategoryCode(name, categories, customAbbr, month, year);
  }

  public saveCategory(category: Category): void {
    const list = this.getCategories();
    if (!category.code || !isValidCategoryCode(category.code)) {
      category.code = generateNextCategoryCode(category.name, list);
    }
    if (!category.createdAt) {
      category.createdAt = new Date().toISOString();
    }
    const index = list.findIndex((c) => c.id === category.id);
    if (index >= 0) {
      list[index] = category;
    } else {
      list.push(category);
    }
    this.setItem(KEYS.CATEGORIES, list);
  }

  public deleteCategory(categoryId: string): void {
    const list = this.getCategories().filter((c) => c.id !== categoryId);
    this.setItem(KEYS.CATEGORIES, list);
  }

  // SLA Configs
  public getSlaConfigs(): SlaConfig[] {
    return this.getItem<SlaConfig[]>(KEYS.SLA_CONFIGS, INITIAL_SLA_CONFIGS);
  }

  public saveSlaConfig(configs: SlaConfig[]): void {
    this.setItem(KEYS.SLA_CONFIGS, configs);
  }

  // Auto Assignment Rules
  public getAssignmentRules(): AutoAssignmentRule[] {
    return this.getItem<AutoAssignmentRule[]>(KEYS.ASSIGNMENT_RULES, INITIAL_ASSIGNMENT_RULES);
  }

  public saveAssignmentRule(rule: AutoAssignmentRule): void {
    const list = this.getAssignmentRules();
    const index = list.findIndex((r) => r.id === rule.id || r.categoryId === rule.categoryId);
    if (index >= 0) {
      list[index] = rule;
    } else {
      list.push(rule);
    }
    this.setItem(KEYS.ASSIGNMENT_RULES, list);
  }

  public saveAssignmentRules(rules: AutoAssignmentRule[]): void {
    this.setItem(KEYS.ASSIGNMENT_RULES, rules);
  }

  /**
   * Deterministic Auto-Assignment Engine:
   * Maps category -> Target Team -> Active PIC candidate with lowest active workload
   * Consistent tie-breaker: employeeId
   */
  public findAutoAssignee(categoryId: string, categoryName: string): {
    assignedPic: User | null;
    targetTeam: string;
    method: 'auto' | 'manual';
    reason: string;
    workload: number;
  } {
    const rules = this.getAssignmentRules();
    const rule = rules.find(
      (r) =>
        (r.categoryId === categoryId || r.categoryName.toLowerCase() === categoryName.toLowerCase()) &&
        r.isActive
    );
    const targetTeam = rule ? rule.targetTeam : 'IT Helpdesk & Operations';

    // Active PICs only
    const allPics = this.getUsers().filter((u) => u.role === 'pic' && u.isActive);
    if (allPics.length === 0) {
      return {
        assignedPic: null,
        targetTeam,
        method: 'auto',
        reason: 'Tidak ada petugas PIC yang berstatus aktif di sistem.',
        workload: 0,
      };
    }

    const activeTickets = this.getTickets().filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    );

    // Candidates within target team
    let teamCandidates = allPics.filter(
      (p) => p.team && p.team.toLowerCase() === targetTeam.toLowerCase()
    );

    // If specific default PIC configured and active
    if (rule?.defaultPicId) {
      const preferred = allPics.find((p) => p.uid === rule.defaultPicId);
      if (preferred && !teamCandidates.some((c) => c.uid === preferred.uid)) {
        teamCandidates.unshift(preferred);
      }
    }

    // Fall back to all active PICs if team has no active PIC
    const candidates = teamCandidates.length > 0 ? teamCandidates : allPics;

    // Calculate active workload (only tickets NOT finished/closed)
    const candidatesWithWorkload = candidates.map((pic) => {
      const workload = activeTickets.filter((t) => t.currentPicId === pic.uid).length;
      return { pic, workload };
    });

    // Sort by lowest active workload, tie-breaker: explicit PIC order
    const orderMap: Record<string, number> = {
      'user-pic-1': 1,
      'user-pic-2': 2,
      'user-pic-3': 3,
    };
    candidatesWithWorkload.sort((a, b) => {
      if (a.workload !== b.workload) {
        return a.workload - b.workload;
      }
      const ordA = orderMap[a.pic.uid] || 99;
      const ordB = orderMap[b.pic.uid] || 99;
      if (ordA !== ordB) return ordA - ordB;
      return (a.pic.employeeId || a.pic.uid).localeCompare(b.pic.employeeId || b.pic.uid);
    });

    const selected = candidatesWithWorkload[0];
    return {
      assignedPic: selected.pic,
      targetTeam: selected.pic.team || targetTeam,
      method: 'auto',
      reason: `Auto-Assignment kategori "${categoryName}" ke tim ${selected.pic.team || targetTeam} (Beban aktif: ${selected.workload} tiket).`,
      workload: selected.workload,
    };
  }

  // Assignments
  public getAssignments(ticketId?: string): Assignment[] {
    const list = this.getItem<Assignment[]>(KEYS.ASSIGNMENTS, []);
    if (ticketId) {
      return list.filter((a) => a.ticketId === ticketId);
    }
    return list;
  }

  public addAssignment(assignment: Assignment): void {
    const list = this.getAssignments();
    list.unshift(assignment);
    this.setItem(KEYS.ASSIGNMENTS, list);
  }

  // Tickets
  public getTickets(): Ticket[] {
    const list = this.getItem<Ticket[]>(KEYS.TICKETS, INITIAL_TICKETS);
    const existingIds = new Set(list.map((t) => t.id));
    let updated = false;

    // Merge any newly introduced seed tickets (e.g. Corpu & Non-UPDL)
    for (const initTkt of INITIAL_TICKETS) {
      if (!existingIds.has(initTkt.id)) {
        list.push(initTkt);
        existingIds.add(initTkt.id);
        updated = true;
      }
    }

    const users = this.getUsers();
    const userMap = new Map(users.map((u) => [u.uid, u]));
    const categories = this.getCategories();
    const catMap = new Map(categories.map((c) => [c.id, c.code]));
    const migratedMap = new Map<string, string>(); // oldNumber -> newNumber

    for (const t of list) {
      if (!t.categoryCode && catMap.has(t.categoryId)) {
        t.categoryCode = catMap.get(t.categoryId);
        updated = true;
      }
      if (t.currentPicId && userMap.has(t.currentPicId)) {
        const u = userMap.get(t.currentPicId)!;
        if (t.currentPicName !== u.name || (u.team && t.currentPicTeam !== u.team)) {
          t.currentPicName = u.name;
          t.currentPicTeam = u.team || t.currentPicTeam;
          updated = true;
        }
      }

      // Check legacy TCU format or missing '#' format
      if (t.ticketNumber && (t.ticketNumber.includes('TCU') || !t.ticketNumber.startsWith('#'))) {
        const oldNumber = t.ticketNumber;
        if (t.ticketNumber.includes('TCU')) {
          t.legacyTicketNumber = t.legacyTicketNumber || t.ticketNumber;
          const cat = categories.find((c) => c.id === t.categoryId || c.name === t.categoryName);
          const abbr = extractCategoryAcronym(cat || { name: t.categoryName, code: t.categoryCode });
          const d = t.createdAt ? new Date(t.createdAt) : new Date();
          const month = isNaN(d.getTime()) ? '10' : (d.getMonth() + 1).toString().padStart(2, '0');
          const year = isNaN(d.getTime()) ? 2026 : d.getFullYear();
          // Extract old sequence
          const parts = t.ticketNumber.split('-');
          const lastPart = parts[parts.length - 1];
          const seq = parseInt(lastPart, 10) || 1;
          t.ticketNumber = formatTicketNumber(abbr, month, year, seq);
          migratedMap.set(oldNumber, t.ticketNumber);
          updated = true;
        } else if (!t.ticketNumber.startsWith('#')) {
          t.ticketNumber = `#${t.ticketNumber}`;
          migratedMap.set(oldNumber, t.ticketNumber);
          updated = true;
        }
      }

      // Audit and migrate unit origin data for old tickets safely (Requirement 6)
      if (!t.reporterUnitType) {
        const migrationResult = auditAndMigrateTicketUnit(t, users);
        if (migrationResult.updated) {
          t.reporterUnitId = migrationResult.ticket.reporterUnitId;
          t.reporterUnitName = migrationResult.ticket.reporterUnitName;
          t.reporterUnitCode = migrationResult.ticket.reporterUnitCode;
          t.reporterUnitType = migrationResult.ticket.reporterUnitType;
          updated = true;
        }
      }
    }

    if (updated) {
      try {
        localStorage.setItem(KEYS.TICKETS, JSON.stringify(list));
        if (migratedMap.size > 0) {
          this.syncMigratedTicketNumbers(migratedMap);
        }
      } catch (e) {
        console.error(e);
      }
    }
    return list;
  }

  // Helper to sync updated ticket numbers into related logs & notifications
  private syncMigratedTicketNumbers(migratedMap: Map<string, string>): void {
    try {
      const logs = this.getItem<ActivityLog[]>(KEYS.LOGS, INITIAL_ACTIVITY_LOGS);
      let logsChanged = false;
      for (const log of logs) {
        if (log.ticketNumber && migratedMap.has(log.ticketNumber)) {
          log.ticketNumber = migratedMap.get(log.ticketNumber)!;
          logsChanged = true;
        }
      }
      if (logsChanged) {
        this.setItem(KEYS.LOGS, logs);
      }

      const notifs = this.getItem<AppNotification[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
      let notifsChanged = false;
      for (const n of notifs) {
        if (n.ticketNumber && migratedMap.has(n.ticketNumber)) {
          const oldNum = n.ticketNumber;
          const newNum = migratedMap.get(oldNum)!;
          n.ticketNumber = newNum;
          if (n.message && n.message.includes(oldNum)) {
            n.message = n.message.replace(new RegExp(oldNum, 'g'), newNum);
          }
          notifsChanged = true;
        }
      }
      if (notifsChanged) {
        this.setItem(KEYS.NOTIFICATIONS, notifs);
      }
    } catch (e) {
      console.warn('Failed to sync migrated ticket numbers in logs/notifs', e);
    }
  }

  /**
   * Mengambil satu tiket berdasarkan Identifier Unik (id), Nomor Tiket Resmi (#XXXX-MM-YYYY-NNN),
   * atau Nomor Tiket Warisan (Legacy), dengan dukungan URL decode dan case-insensitive.
   */
  public getTicketById(idOrNumber: string, currentUser?: User): Ticket | undefined {
    if (!idOrNumber) return undefined;
    let clean = '';
    try {
      clean = decodeURIComponent(idOrNumber).trim();
    } catch {
      clean = idOrNumber.trim();
    }

    if (!clean || clean.toLowerCase() === 'all' || clean.toLowerCase() === 'undefined' || clean.toLowerCase() === 'null') {
      return undefined;
    }

    const cleanLower = clean.toLowerCase();
    const cleanWithoutHash = clean.startsWith('#') ? clean.slice(1).trim() : clean;
    const cleanWithHash = clean.startsWith('#') ? clean : `#${clean}`;
    const allTickets = this.getTickets();

    // 1. Direct match by internal primary ID
    let found = allTickets.find((t) => t.id === clean || t.id.toLowerCase() === cleanLower);

    // 2. Match by official ticketNumber (with or without '#', case-insensitive)
    if (!found) {
      found = allTickets.find((t) => {
        const num = t.ticketNumber || '';
        const numLower = num.toLowerCase();
        return (
          num === clean ||
          num === cleanWithHash ||
          num === cleanWithoutHash ||
          numLower === cleanLower ||
          numLower === cleanWithHash.toLowerCase() ||
          numLower === cleanWithoutHash.toLowerCase()
        );
      });
    }

    // 3. Match by legacy ticket number if present
    if (!found) {
      found = allTickets.find((t) => {
        if (!t.legacyTicketNumber) return false;
        const leg = t.legacyTicketNumber.toLowerCase();
        return (
          leg === cleanLower ||
          leg === cleanWithoutHash.toLowerCase() ||
          t.legacyTicketNumber === clean ||
          t.legacyTicketNumber === cleanWithHash
        );
      });
    }

    if (!found) return undefined;

    // Strict Authorization Check: If currentUser is provided, reject if not authorized (Section 9)
    if (currentUser && !canViewTicket(currentUser, found)) {
      return undefined;
    }

    return found;
  }

  /**
   * Mengambil unit UPDL terdaftar berdasarkan unitId atau unitCode
   */
  public getUpdlUnitById(unitId: string): Unit | undefined {
    if (!unitId) return undefined;
    const clean = unitId.trim().toLowerCase();
    return UPDL_UNITS.find(
      (u) =>
        u.unitId.toLowerCase() === clean ||
        u.unitCode.toLowerCase() === clean ||
        u.unitName.toLowerCase() === clean
    );
  }

  /**
   * Memvalidasi otorisasi akses pengguna ke halaman tiket unit UPDL tertentu
   * - Admin & Manajemen: Akses global penuh ke seluruh 11 UPDL
   * - PIC: Akses teknis penanganan kendala ke seluruh UPDL
   * - Pelapor: Hanya boleh mengakses data tiket unit asalnya sendiri
   */
  public validateUnitAccess(
    unitId: string,
    currentUser: User
  ): {
    authorized: boolean;
    notFound: boolean;
    unit?: Unit;
    reason?: string;
  } {
    const unit = this.getUpdlUnitById(unitId);
    if (!unit) {
      return {
        authorized: false,
        notFound: true,
        reason: `Unit dengan ID "${unitId}" tidak ditemukan dalam Master Data 11 UPDL resmi PLN Corporate University.`,
      };
    }

    // Admin & Manajemen have full global rights
    if (currentUser.role === 'admin' || currentUser.role === 'manajemen') {
      return { authorized: true, notFound: false, unit };
    }

    // PIC has support operations rights
    if (currentUser.role === 'pic') {
      return { authorized: true, notFound: false, unit };
    }

    // Pelapor can ONLY access their own assigned unit
    if (currentUser.role === 'pelapor') {
      const userUnitId = (currentUser.unitId || '').toLowerCase();
      const userUnitCode = (currentUser.unitCode || '').toLowerCase();
      const targetUnitId = unit.unitId.toLowerCase();
      const targetUnitCode = unit.unitCode.toLowerCase();

      if (userUnitId === targetUnitId || (userUnitCode && userUnitCode === targetUnitCode)) {
        return { authorized: true, notFound: false, unit };
      }

      return {
        authorized: false,
        notFound: false,
        unit,
        reason: `Akses Terbatas: Sebagai Pelapor, Anda hanya memiliki otorisasi mengakses tiket pada unit Anda (${currentUser.unitName || 'Unit Anda'}). Akses ke unit ${unit.unitName} ditangguhkan.`,
      };
    }

    return {
      authorized: false,
      notFound: false,
      unit,
      reason: 'Peran akun Anda tidak memiliki otorisasi untuk mengakses data tiket unit ini.',
    };
  }

  /**
   * Mengambil tiket khusus untuk satu Unit UPDL dengan validasi ketat ID unit dan otorisasi
   */
  public getTicketsByUnit(
    unitId: string,
    currentUser?: User
  ): {
    authorized: boolean;
    notFound: boolean;
    unit: Unit | null;
    tickets: Ticket[];
    error?: string;
  } {
    const unit = this.getUpdlUnitById(unitId);
    if (!unit) {
      return {
        authorized: false,
        notFound: true,
        unit: null,
        tickets: [],
        error: `Unit dengan ID "${unitId}" tidak terdaftar dalam Master Data 11 UPDL.`,
      };
    }

    if (currentUser) {
      const authCheck = this.validateUnitAccess(unitId, currentUser);
      if (!authCheck.authorized) {
        return {
          authorized: false,
          notFound: authCheck.notFound,
          unit,
          tickets: [],
          error: authCheck.reason,
        };
      }
    }

    const allTickets = this.getTickets();
    const targetId = unit.unitId.toLowerCase();
    const targetCode = unit.unitCode.toLowerCase();
    const targetName = unit.unitName.toLowerCase();

    // Strict filtering: ONLY tickets originating from this UPDL
    const filtered = allTickets.filter((t) => {
      const matchId = (t.reporterUnitId || '').toLowerCase() === targetId;
      const matchCode = (t.reporterUnitCode || '').toLowerCase() === targetCode;
      const matchName = (t.reporterUnitName || '').toLowerCase().includes(targetName);
      return matchId || matchCode || matchName;
    });

    return {
      authorized: true,
      notFound: false,
      unit,
      tickets: filtered,
    };
  }

  /**
   * Menghitung statistik lengkap tiket khusus untuk satu Unit UPDL
   */
  public getUpdlUnitStats(
    unitId: string,
    currentUser?: User
  ): {
    total: number;
    baru: number;
    dalamProses: number;
    menunggu: number;
    selesai: number;
    ditutup: number;
    kritis: number;
    active: number;
  } {
    const res = this.getTicketsByUnit(unitId, currentUser);
    const tickets = res.tickets;

    const baru = tickets.filter((t) => t.status === 'Baru').length;
    const dalamProses = tickets.filter((t) => t.status === 'Dalam Proses').length;
    const menunggu = tickets.filter((t) =>
      ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
    ).length;
    const selesai = tickets.filter((t) => t.status === 'Selesai').length;
    const ditutup = tickets.filter((t) => t.status === 'Ditutup').length;
    const kritis = tickets.filter((t) => t.priority === 'Kritis').length;
    const active = tickets.filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;

    return {
      total: tickets.length,
      baru,
      dalamProses,
      menunggu,
      selesai,
      ditutup,
      kritis,
      active,
    };
  }

  /**
   * Menghasilkan map jumlah tiket aktif untuk setiap 11 UPDL (untuk badge sidebar dan overview)
   */
  public getAllUpdlUnitActiveCounts(): Record<string, number> {
    const allTickets = this.getTickets();
    const counts: Record<string, number> = {};

    UPDL_UNITS.forEach((unit) => {
      const targetId = unit.unitId.toLowerCase();
      const targetCode = unit.unitCode.toLowerCase();
      const targetName = unit.unitName.toLowerCase();

      const unitTickets = allTickets.filter((t) => {
        const matchId = (t.reporterUnitId || '').toLowerCase() === targetId;
        const matchCode = (t.reporterUnitCode || '').toLowerCase() === targetCode;
        const matchName = (t.reporterUnitName || '').toLowerCase().includes(targetName);
        return matchId || matchCode || matchName;
      });

      const activeCount = unitTickets.filter(
        (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
      ).length;

      counts[unit.unitId] = activeCount;
    });

    return counts;
  }

  /**
   * Memvalidasi otorisasi akses pengguna ke tiket Unit UPDL
   */
  public validateUpdlAccess(
    currentUser: User,
    specificUnitId?: string
  ): { authorized: boolean; notFound?: boolean; reason?: string } {
    if (currentUser.role === 'admin' || currentUser.role === 'manajemen') {
      return { authorized: true };
    }

    if (currentUser.role === 'pic') {
      const isUpdl = canAccessUnitType(currentUser, 'UPDL');
      if (!isUpdl) {
        return {
          authorized: false,
          reason: 'Akses Terbatas: Akun PIC Anda tidak memiliki penugasan di unit UPDL.',
        };
      }
      return { authorized: true };
    }

    if (currentUser.role === 'pelapor') {
      const isUpdl = canAccessUnitType(currentUser, 'UPDL');
      if (!isUpdl) {
        return {
          authorized: false,
          reason: `Akses Terbatas: Sebagai Pelapor dari unit "${currentUser.unitName || 'Lainnya'}", Anda tidak berwenang mengakses data tiket Unit UPDL.`,
        };
      }

      // Pengguna UPDL sah untuk unit UPDL mereka sendiri
      return { authorized: true };
    }

    return {
      authorized: false,
      reason: 'Peran akun Anda tidak memiliki otorisasi untuk mengakses tiket Unit UPDL.',
    };
  }

  /**
   * Mengambil daftar tiket yang HANYA berasal dari 11 Unit UPDL Resmi.
   * Mendukung filter 'ALL' (Semua Unit UPDL) atau satu Unit UPDL spesifik.
   * Isolasi ketat: TIDAK MENGANDUNG TIKET PLN CORPU MAUPUN TIKET UNIT UMUM / NON-UPDL!
   */
  public getUpdlTickets(
    currentUser?: User,
    specificUnitId?: string
  ): {
    authorized: boolean;
    notFound: boolean;
    unit: Unit | null;
    units: Unit[];
    tickets: Ticket[];
    error?: string;
  } {
    const isGlobal = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen');
    // Non-admin users are strictly bound to their assigned unit
    const effectiveUnitId = !isGlobal && currentUser
      ? currentUser.unitId || 'unit-updl-pdg'
      : specificUnitId;

    let selectedUnit: Unit | null = null;
    if (effectiveUnitId && effectiveUnitId !== 'ALL') {
      const foundUnit = this.getUpdlUnitById(effectiveUnitId);
      if (!foundUnit) {
        return {
          authorized: false,
          notFound: true,
          unit: null,
          units: isGlobal ? UPDL_UNITS : [],
          tickets: [],
          error: `Unit UPDL dengan identifier "${effectiveUnitId}" tidak terdaftar dalam Master Data 11 UPDL resmi PT PLN (Persero).`,
        };
      }
      selectedUnit = foundUnit;
    }

    if (currentUser) {
      const auth = this.validateUpdlAccess(currentUser, effectiveUnitId);
      if (!auth.authorized) {
        return {
          authorized: false,
          notFound: Boolean(auth.notFound),
          unit: selectedUnit,
          units: isGlobal ? UPDL_UNITS : (selectedUnit ? [selectedUnit] : []),
          tickets: [],
          error: auth.reason,
        };
      }
    }

    const allTickets = this.getTickets();
    const updlIds = new Set(UPDL_UNITS.map((u) => u.unitId.toLowerCase()));
    const updlCodes = new Set(UPDL_UNITS.map((u) => u.unitCode.toLowerCase()));

    // Strict filter: Exclude any CORPU or NON_UPDL tickets
    let filtered = allTickets.filter((t) => {
      if (t.reporterUnitType === 'CORPU' || t.reporterUnitType === 'NON_UPDL') {
        return false;
      }
      const uId = (t.reporterUnitId || '').toLowerCase();
      const uCode = (t.reporterUnitCode || '').toLowerCase();
      const uName = (t.reporterUnitName || '').toLowerCase();

      // Exclude explicitly Corpu or Non-UPDL IDs
      if (
        uId === 'unit-pln-corpu' ||
        uCode === 'pln_corpu' ||
        NON_UPDL_UNITS.some((nu) => nu.unitId.toLowerCase() === uId || nu.unitCode.toLowerCase() === uCode)
      ) {
        return false;
      }

      const matchExplicitType = t.reporterUnitType === 'UPDL';
      const matchRegisteredId = updlIds.has(uId);
      const matchRegisteredCode = updlCodes.has(uCode);
      const matchName = UPDL_UNITS.some(
        (uu) => uName.includes(uu.unitName.toLowerCase()) || uu.unitName.toLowerCase().includes(uName)
      );

      return matchExplicitType || matchRegisteredId || matchRegisteredCode || matchName;
    });

    // PRIVASI KETAT (Section 7 & 8):
    // Pelapor HANYA melihat tiket miliknya sendiri (reporterId === currentUser.uid)
    if (currentUser && currentUser.role === 'pelapor') {
      filtered = filtered.filter((t) => t.reporterId === currentUser.uid);
    } else if (currentUser && currentUser.role === 'pic') {
      filtered = filtered.filter((t) => t.currentPicId === currentUser.uid);
    }

    // Jika difilter per unit UPDL spesifik (atau unit terikat pengguna biasa)
    if (selectedUnit) {
      const targetId = selectedUnit.unitId.toLowerCase();
      const targetCode = selectedUnit.unitCode.toLowerCase();
      const targetName = selectedUnit.unitName.toLowerCase();

      filtered = filtered.filter((t) => {
        const matchId = (t.reporterUnitId || '').toLowerCase() === targetId;
        const matchCode = (t.reporterUnitCode || '').toLowerCase() === targetCode;
        const matchName = (t.reporterUnitName || '').toLowerCase().includes(targetName);
        return matchId || matchCode || matchName;
      });
    }

    return {
      authorized: true,
      notFound: false,
      unit: selectedUnit,
      units: isGlobal ? UPDL_UNITS : (selectedUnit ? [selectedUnit] : (currentUser?.unitId ? [this.getUpdlUnitById(currentUser.unitId)].filter(Boolean) as Unit[] : [])),
      tickets: filtered,
    };
  }

  /**
   * Menghitung statistik lengkap tiket Unit UPDL (bisa 'ALL' atau per unit tertentu)
   */
  public getUpdlStats(
    currentUser?: User,
    specificUnitId?: string
  ): {
    total: number;
    baru: number;
    dalamProses: number;
    menunggu: number;
    selesai: number;
    ditutup: number;
    kritis: number;
    active: number;
  } {
    const res = this.getUpdlTickets(currentUser, specificUnitId);
    const tickets = res.tickets;

    const baru = tickets.filter((t) => t.status === 'Baru').length;
    const dalamProses = tickets.filter((t) => t.status === 'Dalam Proses').length;
    const menunggu = tickets.filter((t) =>
      ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
    ).length;
    const selesai = tickets.filter((t) => t.status === 'Selesai').length;
    const ditutup = tickets.filter((t) => t.status === 'Ditutup').length;
    const kritis = tickets.filter((t) => t.priority === 'Kritis').length;
    const active = tickets.filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;

    return {
      total: tickets.length,
      baru,
      dalamProses,
      menunggu,
      selesai,
      ditutup,
      kritis,
      active,
    };
  }

  /**
   * Menghitung jumlah tiket aktif Unit UPDL untuk badge sidebar
   */
  public getUpdlActiveCount(currentUser?: User): number {
    if (!currentUser) return 0;
    if (!canAccessUnitType(currentUser, 'UPDL')) return 0;
    const targetUnit =
      currentUser.role === 'admin' || currentUser.role === 'manajemen'
        ? 'ALL'
        : currentUser.unitId || 'ALL';
    const res = this.getUpdlTickets(currentUser, targetUnit);
    return res.tickets.filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;
  }

  // =========================================================================
  // METODE TIKET UNIT PLN CORPU (Bukan UPDL)
  // =========================================================================

  /**
   * Mengambil data unit PLN Corporate University
   */
  public getCorpuUnit(): Unit {
    return CORPU_UNIT;
  }

  /**
   * Memvalidasi otorisasi akses pengguna ke tiket PLN Corpu
   */
  /**
   * Memvalidasi otorisasi akses pengguna ke tiket PLN Corpu
   */
  public validateCorpuAccess(currentUser: User): { authorized: boolean; reason?: string } {
    if (currentUser.role === 'admin' || currentUser.role === 'manajemen') {
      return { authorized: true };
    }

    if (!canAccessUnitType(currentUser, 'CORPU')) {
      return {
        authorized: false,
        reason: `Akses Terbatas: Akun Anda (${currentUser.unitName || 'Unit Anda'}) tidak memiliki otorisasi mengakses tiket internal PLN Corporate University.`,
      };
    }

    return { authorized: true };
  }

  /**
   * Mengambil daftar tiket yang HANYA berasal dari PLN Corporate University
   */
  public getCorpuTickets(currentUser?: User): {
    authorized: boolean;
    unit: Unit;
    tickets: Ticket[];
    error?: string;
  } {
    if (currentUser) {
      const auth = this.validateCorpuAccess(currentUser);
      if (!auth.authorized) {
        return {
          authorized: false,
          unit: CORPU_UNIT,
          tickets: [],
          error: auth.reason,
        };
      }
    }

    const allTickets = this.getTickets();
    const targetId = CORPU_UNIT.unitId.toLowerCase();
    const targetCode = CORPU_UNIT.unitCode.toLowerCase();

    // Isolasi ketat: HANYA tiket dari PLN Corporate University
    let tickets = allTickets.filter((t) => {
      const matchType = t.reporterUnitType === 'CORPU';
      const matchId = (t.reporterUnitId || '').toLowerCase() === targetId;
      const matchCode = (t.reporterUnitCode || '').toLowerCase() === targetCode;
      const matchName = (t.reporterUnitName || '').toLowerCase().includes('corporate university') ||
        (t.reporterUnitName || '').toLowerCase().includes('corpu');

      return matchType || matchId || matchCode || matchName;
    });

    // PRIVASI KETAT: Pelapor hanya melihat tiket miliknya
    if (currentUser && currentUser.role === 'pelapor') {
      tickets = tickets.filter((t) => t.reporterId === currentUser.uid);
    } else if (currentUser && currentUser.role === 'pic') {
      tickets = tickets.filter((t) => t.currentPicId === currentUser.uid);
    }

    return {
      authorized: true,
      unit: CORPU_UNIT,
      tickets,
    };
  }

  /**
   * Menghitung statistik lengkap tiket PLN Corporate University
   */
  public getCorpuStats(currentUser?: User): {
    total: number;
    baru: number;
    dalamProses: number;
    menunggu: number;
    selesai: number;
    ditutup: number;
    kritis: number;
    active: number;
  } {
    const res = this.getCorpuTickets(currentUser);
    const tickets = res.tickets;

    const baru = tickets.filter((t) => t.status === 'Baru').length;
    const dalamProses = tickets.filter((t) => t.status === 'Dalam Proses').length;
    const menunggu = tickets.filter((t) =>
      ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
    ).length;
    const selesai = tickets.filter((t) => t.status === 'Selesai').length;
    const ditutup = tickets.filter((t) => t.status === 'Ditutup').length;
    const kritis = tickets.filter((t) => t.priority === 'Kritis').length;
    const active = tickets.filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;

    return {
      total: tickets.length,
      baru,
      dalamProses,
      menunggu,
      selesai,
      ditutup,
      kritis,
      active,
    };
  }

  /**
   * Menghitung jumlah tiket aktif PLN Corporate University untuk badge sidebar
   */
  public getCorpuActiveCount(currentUser?: User): number {
    if (currentUser && !canAccessUnitType(currentUser, 'CORPU')) {
      return 0;
    }
    const res = this.getCorpuTickets(currentUser);
    return res.tickets.filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;
  }

  // =========================================================================
  // METODE TIKET UNIT PLN UMUM (Non-UPDL Terdaftar)
  // =========================================================================

  /**
   * Mengambil daftar Master Unit Non-UPDL (termasuk unit dinamis)
   */
  public getNonUpdlUnits(): Unit[] {
    return this.getUnits().filter((u) => u.isActive && u.unitType === 'NON_UPDL');
  }

  /**
   * Mengambil satu unit Non-UPDL berdasarkan ID
   */
  public getNonUpdlUnitById(unitId?: string): Unit | undefined {
    if (!unitId) return undefined;
    const clean = unitId.trim().toLowerCase();
    return this.getUnits().find(
      (u) =>
        (u.unitId.toLowerCase() === clean ||
        u.unitCode.toLowerCase() === clean ||
        u.unitName.toLowerCase() === clean) &&
        u.unitType === 'NON_UPDL'
    );
  }

  /**
   * Memvalidasi otorisasi akses pengguna ke tiket Unit PLN Umum
   */
  public validateNonUpdlAccess(
    currentUser: User,
    specificUnitId?: string
  ): { authorized: boolean; reason?: string } {
    if (currentUser.role === 'admin' || currentUser.role === 'manajemen') {
      return { authorized: true };
    }

    if (!canAccessUnitType(currentUser, 'NON_UPDL')) {
      return {
        authorized: false,
        reason: `Akses Terbatas: Sebagai pengguna dari unit "${currentUser.unitName || 'Lainnya'}", Anda tidak berwenang mengakses data tiket Unit Umum Non-UPDL.`,
      };
    }

    // Jika non-admin memilih unit spesifik di luar unit asalnya
    if (specificUnitId && specificUnitId !== 'ALL') {
      const userUnitId = (currentUser.unitId || '').toLowerCase();
      if (userUnitId !== specificUnitId.toLowerCase()) {
        return {
          authorized: false,
          reason: `Akses Terbatas: Anda hanya dapat mengakses tiket unit Anda (${currentUser.unitName || 'Unit Anda'}).`,
        };
      }
    }

    return { authorized: true };
  }

  /**
   * Mengambil daftar tiket yang HANYA berasal dari Unit Umum / Non-UPDL terdaftar
   * (PLN Kantor Pusat, PLN UID Jakarta Raya, PLN Puslitbang / Pusharlis).
   * Menjamin isolasi penuh: TIDAK mengandung tiket UPDL maupun tiket PLN Corpu!
   */
  public getNonUpdlTickets(
    currentUser?: User,
    specificUnitId?: string
  ): {
    authorized: boolean;
    units: Unit[];
    tickets: Ticket[];
    error?: string;
  } {
    if (currentUser) {
      const auth = this.validateNonUpdlAccess(currentUser, specificUnitId);
      if (!auth.authorized) {
        return {
          authorized: false,
          units: NON_UPDL_UNITS,
          tickets: [],
          error: auth.reason,
        };
      }
    }

    const allTickets = this.getTickets();
    const nonUpdlIds = new Set(NON_UPDL_UNITS.map((u) => u.unitId.toLowerCase()));
    const nonUpdlCodes = new Set(NON_UPDL_UNITS.map((u) => u.unitCode.toLowerCase()));

    // Strict filter: Exclude any UPDL and exclude Corpu
    let filtered = allTickets.filter((t) => {
      if (t.reporterUnitType === 'UPDL' || t.reporterUnitType === 'CORPU') {
        return false;
      }
      const uId = (t.reporterUnitId || '').toLowerCase();
      const uCode = (t.reporterUnitCode || '').toLowerCase();
      const uName = (t.reporterUnitName || '').toLowerCase();

      if (uId.includes('updl') || uId === 'unit-pln-corpu' || uCode.includes('updl') || uCode === 'pln_corpu') {
        return false;
      }

      const matchExplicitType = t.reporterUnitType === 'NON_UPDL';
      const matchRegisteredId = nonUpdlIds.has(uId);
      const matchRegisteredCode = nonUpdlCodes.has(uCode);
      const matchRegisteredName = NON_UPDL_UNITS.some((nu) =>
        uName.includes(nu.unitName.toLowerCase()) || nu.unitName.toLowerCase().includes(uName)
      );

      return matchExplicitType || matchRegisteredId || matchRegisteredCode || matchRegisteredName;
    });

    // PRIVASI KETAT: Pelapor hanya melihat tiket miliknya
    if (currentUser && currentUser.role === 'pelapor') {
      filtered = filtered.filter((t) => t.reporterId === currentUser.uid);
    } else if (currentUser && currentUser.role === 'pic') {
      filtered = filtered.filter((t) => t.currentPicId === currentUser.uid);
    }

    // Jika difilter per unit umum spesifik
    const effectiveFilter =
      currentUser && currentUser.role !== 'admin' && currentUser.role !== 'manajemen'
        ? currentUser.unitId
        : specificUnitId;

    if (effectiveFilter && effectiveFilter !== 'ALL') {
      const targetUnit = this.getNonUpdlUnitById(effectiveFilter);
      if (targetUnit) {
        const tId = targetUnit.unitId.toLowerCase();
        const tCode = targetUnit.unitCode.toLowerCase();
        const tName = targetUnit.unitName.toLowerCase();

        filtered = filtered.filter((t) => {
          const matchId = (t.reporterUnitId || '').toLowerCase() === tId;
          const matchCode = (t.reporterUnitCode || '').toLowerCase() === tCode;
          const matchName = (t.reporterUnitName || '').toLowerCase().includes(tName);
          return matchId || matchCode || matchName;
        });
      }
    }

    const isGlobal = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen');

    return {
      authorized: true,
      units: isGlobal ? this.getNonUpdlUnits() : (currentUser?.unitId ? [this.getNonUpdlUnitById(currentUser.unitId)].filter(Boolean) as Unit[] : []),
      tickets: filtered,
    };
  }

  /**
   * Menghitung statistik lengkap tiket Unit PLN Umum
   */
  public getNonUpdlStats(
    currentUser?: User,
    specificUnitId?: string
  ): {
    total: number;
    baru: number;
    dalamProses: number;
    menunggu: number;
    selesai: number;
    ditutup: number;
    kritis: number;
    active: number;
  } {
    const res = this.getNonUpdlTickets(currentUser, specificUnitId);
    const tickets = res.tickets;

    const baru = tickets.filter((t) => t.status === 'Baru').length;
    const dalamProses = tickets.filter((t) => t.status === 'Dalam Proses').length;
    const menunggu = tickets.filter((t) =>
      ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
    ).length;
    const selesai = tickets.filter((t) => t.status === 'Selesai').length;
    const ditutup = tickets.filter((t) => t.status === 'Ditutup').length;
    const kritis = tickets.filter((t) => t.priority === 'Kritis').length;
    const active = tickets.filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;

    return {
      total: tickets.length,
      baru,
      dalamProses,
      menunggu,
      selesai,
      ditutup,
      kritis,
      active,
    };
  }

  /**
   * Menghitung jumlah tiket aktif Unit PLN Umum untuk badge sidebar
   */
  public getNonUpdlActiveCount(currentUser?: User): number {
    if (currentUser && !canAccessUnitType(currentUser, 'NON_UPDL')) {
      return 0;
    }
    const targetUnit =
      currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen')
        ? 'ALL'
        : currentUser?.unitId || 'ALL';
    const res = this.getNonUpdlTickets(currentUser, targetUnit);
    return res.tickets.filter(
      (t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status)
    ).length;
  }

  /**
   * Generates the next official ticket number adhering to #XXXX-MM-YYYY-NNN
   * based on the chosen category and current date.
   */
  public getNextTicketNumber(category?: Category | { code?: string; name: string } | string, date: Date | string = new Date()): string {
    const tickets = this.getTickets();
    let catObj: { code?: string; name?: string } | null = null;
    if (typeof category === 'string') {
      catObj = this.getCategoryById(category) || this.getCategories().find((c) => c.name === category) || null;
    } else if (category) {
      catObj = category;
    }
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    return generateNextTicketNumber(catObj, tickets, targetDate);
  }

  public createTicket(
    newTicket: Omit<Ticket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'reopenedCount'>
  ): Ticket {
    const tickets = this.getTickets();
    const id = `tkt-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const cat = this.getCategoryById(newTicket.categoryId);
    const categoryCode = newTicket.categoryCode || cat?.code;
    const ticketNumber = this.getNextTicketNumber(cat || { name: newTicket.categoryName, code: categoryCode }, timestamp);

    // Check if reporter explicitly selected a PIC or if auto-assignment should run
    let assignedPic: User | null = null;
    let assignmentMethod: 'auto' | 'manual' = 'auto';
    let assignmentReason = '';
    let targetTeam = '';

    if (newTicket.currentPicId && newTicket.currentPicId !== 'AUTO') {
      const explicitPic = this.getUserById(newTicket.currentPicId);
      if (explicitPic && explicitPic.isActive) {
        assignedPic = explicitPic;
        assignmentMethod = 'manual';
        targetTeam = explicitPic.team || 'Tim Teknis';
        assignmentReason = `Dipilih langsung oleh pelapor (${newTicket.reporterName})`;
      }
    }

    if (!assignedPic) {
      // Run Auto Assignment Engine
      const assignResult = this.findAutoAssignee(newTicket.categoryId, newTicket.categoryName);
      assignedPic = assignResult.assignedPic;
      assignmentMethod = 'auto';
      targetTeam = assignResult.targetTeam;
      assignmentReason = assignResult.reason;
    }

    // SECURE BACKEND BINDING: Determine origin unit from verified reporter account in database (Requirement 3 & 9)
    const verifiedReporter = this.getUserById(newTicket.reporterId) || this.getActiveUser();
    const verifiedUnit = getUnitByIdOrCode(verifiedReporter.unitId);

    const reporterUnitId = verifiedReporter.unitId || verifiedUnit?.unitId || 'unit-pln-corpu';
    const reporterUnitName = verifiedReporter.unitName || verifiedUnit?.unitName || 'PLN Corporate University (PLN Corpu)';
    const reporterUnitCode = verifiedReporter.unitCode || verifiedUnit?.unitCode || 'PLN_CORPU';
    const reporterUnitType: UnitType =
      verifiedReporter.unitType ||
      (verifiedUnit ? verifiedUnit.unitType : isUpdlUnit(reporterUnitId) ? 'UPDL' : 'CORPU');

    const status: TicketStatus = assignedPic ? 'Ditugaskan' : 'Baru';
    const assignedAt: string | undefined = assignedPic ? timestamp : undefined;

    const ticket: Ticket = {
      ...newTicket,
      id,
      ticketNumber,
      categoryCode,
      status,
      reporterUnitId,
      reporterUnitName,
      reporterUnitCode,
      reporterUnitType,
      currentPicId: assignedPic?.uid,
      currentPicName: assignedPic?.name,
      currentPicTeam: assignedPic ? (assignedPic.team || targetTeam) : undefined,
      assignedPicId: assignedPic?.uid,
      assignedTeam: assignedPic ? (assignedPic.team || targetTeam) : undefined,
      assignmentMethod,
      assignmentStatus: assignedPic ? 'assigned' : 'unassigned',
      assignedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      reopenedCount: 0,
    };

    tickets.unshift(ticket);
    this.setItem(KEYS.TICKETS, tickets);

    // Initial Ticket Created Log
    this.addActivityLog({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      actorId: ticket.reporterId,
      actorName: ticket.reporterName,
      actorRole: 'pelapor',
      action: 'TIKET_DIBUAT',
      afterValue: status,
      details: `Tiket "${ticket.title}" berhasil dibuat dengan nomor ${ticket.ticketNumber}.`,
    });

    const admins = this.getUsers().filter((u) => u.role === 'admin');

    if (assignedPic) {
      // 1. Record Assignment
      this.addAssignment({
        id: `asg-${Date.now()}`,
        ticketId: ticket.id,
        picId: assignedPic.uid,
        picName: assignedPic.name,
        assignedBy: assignmentMethod === 'manual' ? ticket.reporterId : 'SYSTEM-AUTO',
        assignedByName:
          assignmentMethod === 'manual'
            ? `${ticket.reporterName} (Pelapor)`
            : 'Auto-Assignment Engine CorpU',
        assignedAt: timestamp,
        assignmentStatus: 'pending',
        reason: assignmentReason,
      });

      // 2. Activity Log
      this.addActivityLog({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        actorId: assignmentMethod === 'manual' ? ticket.reporterId : 'system',
        actorName: assignmentMethod === 'manual' ? ticket.reporterName : 'Auto-Assignment Engine',
        actorRole: assignmentMethod === 'manual' ? 'pelapor' : 'admin',
        action: assignmentMethod === 'manual' ? 'PENUGASAN_LANGSUNG_PELAPOR' : 'PENUGASAN_OTOMATIS',
        beforeValue: 'Baru',
        afterValue: 'Ditugaskan',
        details:
          assignmentMethod === 'manual'
            ? `Pelapor (${ticket.reporterName}) menugaskan langsung tiket ini kepada ${assignedPic.name} (${assignedPic.team || targetTeam}).`
            : `Sistem secara otomatis menugaskan tiket kepada ${assignedPic.name} (${assignedPic.team || targetTeam}) berdasarkan kategori "${ticket.categoryName}".`,
      });

      // 3. Notify PIC
      this.addNotification({
        recipientId: assignedPic.uid,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title:
          assignmentMethod === 'manual'
            ? `Penugasan Langsung dari ${ticket.reporterName}`
            : 'Penugasan Tiket Baru',
        message:
          assignmentMethod === 'manual'
            ? `Pelapor ${ticket.reporterName} (${ticket.department}) memilih Anda untuk menangani tiket #${ticket.ticketNumber} "${ticket.title}".`
            : `Tiket #${ticket.ticketNumber} "${ticket.title}" (Prioritas: ${ticket.priority}) dari ${ticket.reporterName} (${ticket.department}) telah ditugaskan kepada Anda.`,
        type: 'assignment',
      });

      // 4. Notify Reporter (Confirmation of assigned PIC)
      this.addNotification({
        recipientId: ticket.reporterId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: 'Tiket Berhasil Dibuat & Ditugaskan',
        message: `Tiket #${ticket.ticketNumber} telah diteruskan kepada ${assignedPic.name} (${assignedPic.team || targetTeam}).`,
        type: 'status',
      });

      // 5. Notify Admins
      admins.forEach((admin) => {
        this.addNotification({
          recipientId: admin.uid,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title:
            assignmentMethod === 'manual'
              ? 'Tiket Baru (Ditugaskan oleh Pelapor)'
              : 'Tiket Baru Auto-Assigned',
          message:
            assignmentMethod === 'manual'
              ? `Tiket #${ticket.ticketNumber} "${ticket.title}" langsung ditugaskan oleh pelapor kepada ${assignedPic.name}.`
              : `Tiket baru #${ticket.ticketNumber} "${ticket.title}" otomatis ditugaskan ke ${assignedPic.name}.`,
          type: 'assignment',
        });
      });
    } else {
      // No PIC available: Ticket stays in unassigned queue and alert admin (Requirement 3)
      this.addActivityLog({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        actorId: 'system',
        actorName: 'Auto-Assignment Engine',
        actorRole: 'admin',
        action: 'AUTO_ASSIGNMENT_GAGAL',
        beforeValue: 'Baru',
        afterValue: 'Baru',
        details: `Tidak ditemukan petugas PIC aktif untuk kategori "${ticket.categoryName}". Tiket masuk antrean Belum Ditugaskan untuk verifikasi manual Admin.`,
      });

      admins.forEach((admin) => {
        this.addNotification({
          recipientId: admin.uid,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: 'Auto-Assignment Gagal (Butuh Disposisi Manual)',
          message: `Tiket #${ticket.ticketNumber} "${ticket.title}" belum memiliki PIC aktif. Mohon tetapkan PIC secara manual.`,
          type: 'sla',
        });
      });
    }

    return ticket;
  }

  public updateTicket(ticket: Ticket, actorUser: User, actionName: string, details?: string): void {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticket.id);
    if (index >= 0) {
      const oldTicket = tickets[index];
      ticket.updatedAt = new Date().toISOString();
      tickets[index] = ticket;
      this.setItem(KEYS.TICKETS, tickets);

      // Log status transition or update
      this.addActivityLog({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        actorId: actorUser.uid,
        actorName: actorUser.name,
        actorRole: actorUser.role,
        action: actionName,
        beforeValue: oldTicket.status,
        afterValue: ticket.status,
        details: details || `Status tiket diperbarui menjadi ${ticket.status}.`,
      });

      // Dispatch targeted notifications
      if (oldTicket.status !== ticket.status) {
        // Notify reporter if status changed
        if (ticket.reporterId !== actorUser.uid) {
          this.addNotification({
            recipientId: ticket.reporterId,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            title: `Status Tiket: ${ticket.status}`,
            message: `Tiket #${ticket.ticketNumber} Anda kini berstatus "${ticket.status}".`,
            type: 'status',
          });
        }

        // Notify PIC if assigned and not the actor
        if (ticket.currentPicId && ticket.currentPicId !== actorUser.uid) {
          this.addNotification({
            recipientId: ticket.currentPicId,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            title: `Pembaruan Tiket #${ticket.ticketNumber}`,
            message: `Status tiket tugas Anda diperbarui menjadi "${ticket.status}".`,
            type: 'status',
          });
        }
      }
    }
  }

  /**
   * Mengklasifikasikan atau memperbarui Asal Unit pada tiket (Requirement 6 & 9)
   * Hanya dapat dipanggil oleh otoritas Admin berwenang dan tercatat di immutable audit log.
   */
  public classifyTicketUnit(ticketId: string, unitId: string, actor: User): Ticket {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) {
      throw new Error('Tiket tidak ditemukan.');
    }

    const targetUnit = getUnitByIdOrCode(unitId);
    if (!targetUnit) {
      throw new Error('Unit tujuan tidak terdaftar di sistem.');
    }

    const prevTicket = tickets[index];
    const oldUnitName = prevTicket.reporterUnitName || 'Belum Terklasifikasi';
    const oldUnitType = prevTicket.reporterUnitType || 'UNCLASSIFIED';

    const updatedTicket: Ticket = {
      ...prevTicket,
      reporterUnitId: targetUnit.unitId,
      reporterUnitName: targetUnit.unitName,
      reporterUnitCode: targetUnit.unitCode,
      reporterUnitType: targetUnit.unitType,
      updatedAt: new Date().toISOString(),
    };

    tickets[index] = updatedTicket;
    this.setItem(KEYS.TICKETS, tickets);

    // Record immutable activity log
    this.addActivityLog({
      ticketId: updatedTicket.id,
      ticketNumber: updatedTicket.ticketNumber,
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'ASAL_UNIT_DIKLASIFIKASIKAN',
      beforeValue: `${oldUnitName} (${oldUnitType})`,
      afterValue: `${targetUnit.unitName} (${targetUnit.unitType})`,
      details: `Admin ${actor.name} menetapkan asal unit pelapor tiket menjadi ${targetUnit.unitName} (${targetUnit.unitType}).`,
    });

    // Record admin audit log
    this.addAdminAuditLog({
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'UNIT_CLASSIFIED',
      targetUserId: updatedTicket.reporterId,
      targetUserName: updatedTicket.reporterName,
      details: `Klasifikasi asal unit tiket #${updatedTicket.ticketNumber} menjadi ${targetUnit.unitName} (${targetUnit.unitType}).`,
    });

    return updatedTicket;
  }

  // Activity Logs
  public getActivityLogs(ticketId?: string): ActivityLog[] {
    const all = this.getItem<ActivityLog[]>(KEYS.LOGS, INITIAL_ACTIVITY_LOGS);
    if (ticketId) {
      return all.filter((l) => l.ticketId === ticketId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addActivityLog(logData: Omit<ActivityLog, 'id' | 'createdAt'>): void {
    const logs = this.getItem<ActivityLog[]>(KEYS.LOGS, INITIAL_ACTIVITY_LOGS);
    const newLog: ActivityLog = {
      ...logData,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    logs.unshift(newLog);
    this.setItem(KEYS.LOGS, logs);
  }

  // Comments
  public getComments(ticketId: string): Comment[] {
    const all = this.getItem<Comment[]>(KEYS.COMMENTS, INITIAL_COMMENTS);
    return all.filter((c) => c.ticketId === ticketId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  public addComment(commentData: Omit<Comment, 'id' | 'createdAt'>): Comment {
    const comments = this.getItem<Comment[]>(KEYS.COMMENTS, INITIAL_COMMENTS);
    const newComment: Comment = {
      ...commentData,
      id: `com-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    comments.push(newComment);
    this.setItem(KEYS.COMMENTS, comments);

    // Notify ticket participants
    const ticket = this.getTicketById(commentData.ticketId);
    if (ticket && commentData.visibility === 'public') {
      if (commentData.authorId !== ticket.reporterId) {
        this.addNotification({
          recipientId: ticket.reporterId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: 'Komentar Baru pada Tiket Anda',
          message: `${commentData.authorName}: "${commentData.message.substring(0, 75)}..."`,
          type: 'comment',
        });
      }
      if (ticket.currentPicId && commentData.authorId !== ticket.currentPicId) {
        this.addNotification({
          recipientId: ticket.currentPicId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: 'Tanggapan Pelapor Tiket',
          message: `${commentData.authorName}: "${commentData.message.substring(0, 75)}..."`,
          type: 'comment',
        });
      }
    }

    return newComment;
  }

  // Progresses
  public getProgresses(ticketId: string): Progress[] {
    const all = this.getItem<Progress[]>(KEYS.PROGRESSES, INITIAL_PROGRESSES);
    return all.filter((p) => p.ticketId === ticketId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addProgress(progressData: Omit<Progress, 'id' | 'createdAt'>): Progress {
    const progresses = this.getItem<Progress[]>(KEYS.PROGRESSES, INITIAL_PROGRESSES);
    const newProgress: Progress = {
      ...progressData,
      id: `prg-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    progresses.unshift(newProgress);
    this.setItem(KEYS.PROGRESSES, progresses);
    return newProgress;
  }

  // Notifications
  public getNotifications(recipientId?: string): AppNotification[] {
    const all = this.getItem<AppNotification[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    if (!recipientId) {
      return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return all.filter((n) => n.recipientId === recipientId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public markNotificationAsRead(id: string): void {
    const list = this.getItem<AppNotification[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const index = list.findIndex((n) => n.id === id);
    if (index >= 0) {
      list[index].isRead = true;
      this.setItem(KEYS.NOTIFICATIONS, list);
    }
  }

  public markAllNotificationsAsRead(recipientId: string): void {
    const list = this.getItem<AppNotification[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    let modified = false;
    list.forEach((n) => {
      if (n.recipientId === recipientId && !n.isRead) {
        n.isRead = true;
        modified = true;
      }
    });
    if (modified) {
      this.setItem(KEYS.NOTIFICATIONS, list);
    }
  }

  public addNotification(notificationData: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): void {
    const list = this.getItem<AppNotification[]>(KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const newNotif: AppNotification = {
      ...notificationData,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    list.unshift(newNotif);
    this.setItem(KEYS.NOTIFICATIONS, list);
  }

  // Export full backup
  public exportAllData(): string {
    const backup = {
      exportedAt: new Date().toISOString(),
      appName: 'PLN Corporate University Ticketing Management System',
      tickets: this.getTickets(),
      users: this.getUsers(),
      categories: this.getCategories(),
      slaConfigs: this.getSlaConfigs(),
      activityLogs: this.getActivityLogs(),
      comments: this.getItem(KEYS.COMMENTS, []),
      progresses: this.getItem(KEYS.PROGRESSES, []),
    };
    return JSON.stringify(backup, null, 2);
  }
}

export const storageService = new StorageService();
