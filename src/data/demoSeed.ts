/**
 * 初期システム設定・管理者アカウント定義
 * - お試し学生（ダミーデータ）は一切含めない（0件から運用開始）
 * - 管理者アカウント: nittai.daigakuin@gmail.com（表示名: 管理者）
 * - リマインド通知送信元メールアドレス: nittai.daigakuin@gmail.com
 * - セキュリティルール (#4, #77) に従い、平文パスワードはソースコードに保持せず SHA-256 ダイジェストで検証する
 */

import type {
  AcademicYear,
  AuditLog,
  ProgressRecord,
  Student,
  UserProfile,
} from '../types/domain';
import { DEFAULT_ACADEMIC_EVENTS_2026 } from './roadmapSeed';

export const SYSTEM_ADMIN_EMAIL = 'nittai.daigakuin@gmail.com';
export const SYSTEM_REMINDER_SENDER_EMAIL = 'nittai.daigakuin@gmail.com';

// SHA-256 digest of the initial admin password (no plaintext password stored in repository)
export const INITIAL_ADMIN_PASSWORD_SHA256 =
  'f28fe1424e68063026410825f32325d7279602e4a67dcd7c3e613133f7d6c2a4';

export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface StoredAccount {
  passwordHash: string;
  profile: UserProfile;
}

export const INITIAL_USERS: Record<string, StoredAccount> = {
  [SYSTEM_ADMIN_EMAIL]: {
    passwordHash: INITIAL_ADMIN_PASSWORD_SHA256,
    profile: {
      uid: 'uid-admin-main',
      email: SYSTEM_ADMIN_EMAIL,
      displayName: '管理者',
      studentId: null,
      roles: { student: false, admin: true },
      mustChangePassword: false,
      active: true,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      lastLoginAt: null,
    },
  },
};

export const INITIAL_STUDENTS: Student[] = [];

export function buildInitialDemoProgress(): ProgressRecord[] {
  return [];
}

export const INITIAL_ACADEMIC_YEARS: Record<number, AcademicYear> = {
  2026: {
    year: 2026,
    isCurrent: true,
    updatedAt: '2026-04-01T00:00:00.000Z',
    events: DEFAULT_ACADEMIC_EVENTS_2026.map((ev) => ({ ...ev })),
  },
  2027: {
    year: 2027,
    isCurrent: false,
    updatedAt: '2026-04-01T00:00:00.000Z',
    events: DEFAULT_ACADEMIC_EVENTS_2026.map((ev) => ({
      ...ev,
      date: ev.date
        ? `${Number(ev.date.slice(0, 4)) + 1}${ev.date.slice(4)}`
        : null,
    })),
  },
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
