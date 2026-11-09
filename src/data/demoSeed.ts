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
  LabOperationConfig,
  NotificationLog,
  ProgressRecord,
  ResearchProcessLogEntry,
  Student,
  UserProfile,
} from '../types/domain';
import { DEFAULT_ACADEMIC_EVENTS_2026 } from './roadmapSeed';

export const SYSTEM_ADMIN_EMAIL = 'nittai.daigakuin@gmail.com';
export const SYSTEM_REMINDER_SENDER_EMAIL = 'nittai.daigakuin@gmail.com';

export const INITIAL_LAB_OPERATION_CONFIG: LabOperationConfig = {
  academicYear: 2026,
  primaryAdminName: '管理者 (nittai.daigakuin@gmail.com)',
  studentAdminNames: '菊水・立山（来年度運用・学生管理担当）',
  scheduleManagerName: '菊水・立山（年間スケジュール・Googleカレンダー管理担当）',
  taskManagerName: '菊水・立山（ロードマップタスク・情報修正担当）',
  updateTimingRule:
    '毎週のゼミ前日までに、自身の進行中タスクの状態・個人目標日・研究プロセスコメントを更新する',
  reviewMethodRule:
    '週次ゼミ・ミーティングにて「研究室メンバーの進捗」画面を全員で共有し、遅れている項目や相談事項を確認する',
  googleCalendarId: 'nittai.daigakuin@gmail.com',
  gasBridgeWebhookUrl: '',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

export const INITIAL_PROCESS_LOGS: ResearchProcessLogEntry[] = [];
export const INITIAL_NOTIFICATION_LOGS: NotificationLog[] = [];

/**
 * nittai.daigakuin@gmail.com アカウントの Google Apps Script にそのまま貼り付けて使える
 * 「① 実メール送信 + ② 朝8時自動リマインド + ③ Googleカレンダー双方向同期」オールインワン無料連携スクリプト
 */
export const GAS_EMAIL_AND_CALENDAR_BRIDGE_CODE = `/**
 * 大学院研究進捗管理Webアプリ — メール送信 & Googleカレンダー双方向連携ブリッジ (GAS)
 * 使い方:
 * 1. nittai.daigakuin@gmail.com で https://script.google.com/ を開き「新しいプロジェクト」を作成
 * 2. このコードを貼り付けて保存し、「デプロイ > 新しいデプロイ > ウェブアプリ」（アクセスできるユーザー: 全員）でデプロイ
 * 3. 発行された「ウェブアプリURL」をWebアプリ管理画面の「通知・メール・Calendar連携」に貼り付けるだけで開通します！
 */

const CALENDAR_ID = 'nittai.daigakuin@gmail.com';
const SENDER_NAME = '大学院研究進捗管理システム';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    // 1. 個別または一括リマインドメール送信
    if (action === 'SEND_EMAIL') {
      GmailApp.sendEmail(body.recipientEmail, body.subject, body.textBody, {
        name: SENDER_NAME
      });
      return jsonResponse({ ok: true, sentAt: new Date().toISOString() });
    }

    // 2. Googleカレンダーとの双方向同期 (Webアプリ ⇄ Google Calendar)
    if (action === 'SYNC_CALENDAR_BIDIRECTIONAL') {
      const cal = CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar();
      const localEvents = body.events || [];

      // (A) Webアプリ側の予定をGoogleカレンダーへ反映
      for (const ev of localEvents) {
        if (!ev.calendarDisplay || !ev.date) continue;
        const start = new Date(ev.date + 'T00:00:00+09:00');
        const existing = cal.getEventsForDay(start).find(c => c.getTitle() === ev.name);
        if (!existing) {
          cal.createAllDayEvent(ev.name, start, { description: ev.notes || '' });
        }
      }

      // (B) Googleカレンダー側で登録・変更された予定を取得してWebアプリへ返却
      const fromDate = new Date(new Date().getFullYear(), 0, 1);
      const toDate = new Date(new Date().getFullYear() + 2, 3, 31);
      const gcalEvents = cal.getEvents(fromDate, toDate).map(g => {
        const d = g.getStartTime();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return {
          googleCalendarEventId: g.getId(),
          title: g.getTitle(),
          date: yyyy + '-' + mm + '-' + dd,
          notes: g.getDescription() || '',
          updatedAt: (g.getLastUpdated() || new Date()).toISOString()
        };
      });

      return jsonResponse({ ok: true, remoteCalendarEvents: gcalEvents });
    }

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

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
