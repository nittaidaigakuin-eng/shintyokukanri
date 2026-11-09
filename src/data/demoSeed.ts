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
  googleSpreadsheetUrl: '',
  gasBridgeWebhookUrl: '',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

export const INITIAL_PROCESS_LOGS: ResearchProcessLogEntry[] = [];
export const INITIAL_NOTIFICATION_LOGS: NotificationLog[] = [];

/**
 * nittai.daigakuin@gmail.com アカウントの Googleスプレッドシート（拡張機能 > Apps Script）にそのまま貼り付けて使える
 * 「① 実メール送信 + ② Googleカレンダー双方向同期 + ③ スプレッドシート自動シート生成＆双方向同期（日付・進捗の相互修正）」オールインワン無料連携スクリプト
 */
export const GAS_EMAIL_AND_CALENDAR_BRIDGE_CODE = `/**
 * 大学院研究進捗管理Webアプリ — メール送信 & Googleカレンダー & スプレッドシート双方向連携ブリッジ (GAS)
 * 使い方（一番おすすめ＆簡単な手順）:
 * 1. 先に作成していたGoogleスプレッドシートを開き、上部メニュー「拡張機能 > Apps Script」をクリック
 * 2. このコードをすべて貼り付けて保存（Ctrl+S）
 * 3. 右上の「デプロイ > 新しいデプロイ > 種類の選択：ウェブアプリ」（アクセスできるユーザー: 全員）でデプロイ
 * 4. 発行された「ウェブアプリURL」をWebアプリ管理画面に貼り付けるだけで、
 *    メール送信・Googleカレンダー双方向連携・スプレッドシートでの日付/進捗修正がすべて自動で繋がります！
 */

const CALENDAR_ID = 'nittai.daigakuin@gmail.com';
const SENDER_NAME = '大学院研究進捗管理システム';
const SHEET_EVENTS = '連携_年度イベント日程';
const SHEET_PROGRESS = '連携_学生進捗・日付修正';

// スプレッドシート上で日付やステータスを直接書き換えた際、右端の「最終更新日時」を自動更新してWebアプリ側に優先反映させるトリガー
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const name = sheet.getName();
    const row = e.range.getRow();
    if (row <= 1) return;
    const nowIso = new Date().toISOString();
    if (name === SHEET_EVENTS && e.range.getColumn() <= 8) {
      sheet.getRange(row, 9).setValue(nowIso);
    } else if (name === SHEET_PROGRESS && e.range.getColumn() <= 11) {
      sheet.getRange(row, 12).setValue(nowIso);
    }
  } catch (_) {}
}

function getTargetSpreadsheet(spreadsheetUrl) {
  if (spreadsheetUrl) {
    const m = String(spreadsheetUrl).match(/\\/d\\/([a-zA-Z0-9-_]+)/);
    if (m && m[1]) {
      return SpreadsheetApp.openById(m[1]);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function formatDateCell(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }
  return String(val).trim();
}

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

      for (const ev of localEvents) {
        if (!ev.calendarDisplay || !ev.date) continue;
        const start = new Date(ev.date + 'T00:00:00+09:00');
        const existing = cal.getEventsForDay(start).find(c => c.getTitle() === ev.name);
        if (!existing) {
          cal.createAllDayEvent(ev.name, start, { description: ev.notes || '' });
        }
      }

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

    // 3. Googleスプレッドシートとの双方向同期（シート自動生成・日付や進捗の相互修正）
    if (action === 'SYNC_SPREADSHEET_BIDIRECTIONAL') {
      const ss = getTargetSpreadsheet(body.spreadsheetUrl);
      if (!ss) {
        return jsonResponse({ ok: false, error: '連携先のスプレッドシートが見つかりません。スプレッドシートURLを設定するか、スプレッドシート内のApps Scriptに配置してください。' });
      }

      // (A) 「連携_年度イベント日程」シートの読込＆自動生成
      let evSheet = ss.getSheetByName(SHEET_EVENTS);
      const remoteEventRows = [];
      if (!evSheet) {
        evSheet = ss.insertSheet(SHEET_EVENTS);
      } else if (evSheet.getLastRow() > 1) {
        const rows = evSheet.getRange(2, 1, evSheet.getLastRow() - 1, 9).getValues();
        for (const r of rows) {
          if (!r[0]) continue;
          remoteEventRows.push({
            eventKey: String(r[0]).trim(),
            eventCategory: String(r[1] || 'OFFICIAL').trim(),
            name: String(r[2] || '').trim(),
            target: String(r[3] || 'ALL').trim(),
            date: formatDateCell(r[4]) || null,
            time: String(r[5] || '').trim() || null,
            calendarDisplay: String(r[6]).toUpperCase() !== 'FALSE',
            notes: String(r[7] || '').trim(),
            updatedAt: String(r[8] || '').trim()
          });
        }
      }

      // (B) 「連携_学生進捗・日付修正」シートの読込＆自動生成
      let progSheet = ss.getSheetByName(SHEET_PROGRESS);
      const remoteProgressRows = [];
      if (!progSheet) {
        progSheet = ss.insertSheet(SHEET_PROGRESS);
      } else if (progSheet.getLastRow() > 1) {
        const rows = progSheet.getRange(2, 1, progSheet.getLastRow() - 1, 12).getValues();
        for (const r of rows) {
          if (!r[0]) continue;
          remoteProgressRows.push({
            progressId: String(r[0]).trim(),
            studentId: String(r[1]).trim(),
            taskId: String(r[4]).trim(),
            status: String(r[7] || 'NOT_STARTED').trim(),
            personalTargetDate: formatDateCell(r[8]) || null,
            comment: String(r[10] || '').trim(),
            updatedAt: String(r[11] || '').trim()
          });
        }
      }

      // Webアプリ側から渡された最新データ（またはマージ後データ）でシートを綺麗に整形・書き込み
      if (body.writeBack && Array.isArray(body.events)) {
        evSheet.clearContents();
        const evHeader = [['イベントキー(変更不可)', '区分(OFFICIAL/CLASS/LAB_EVENT)', '★予定・イベント名(編集可)', '対象(M1/M2/ALL)', '★日付 YYYY-MM-DD(編集可)', '★時刻(編集可)', 'Calendar同期(TRUE/FALSE)', '★備考・場所(編集可)', '最終更新日時(自動)']];
        evSheet.getRange(1, 1, 1, 9).setValues(evHeader).setBackground('#0B1F3A').setFontColor('#FFFFFF').setFontWeight('bold');
        const evData = body.events.map(ev => [
          ev.eventKey,
          ev.eventCategory || 'OFFICIAL',
          ev.name,
          ev.target || 'ALL',
          ev.date || '',
          ev.time || '',
          ev.calendarDisplay !== false,
          ev.notes || '',
          ev.updatedAt || new Date().toISOString()
        ]);
        if (evData.length > 0) {
          evSheet.getRange(2, 1, evData.length, 9).setValues(evData);
        }
      }

      if (body.writeBack && Array.isArray(body.progressRows)) {
        progSheet.clearContents();
        const progHeader = [['進捗ID(変更不可)', '学生ID', '学生氏名', '学年', 'タスクID', 'カテゴリ', 'タスク名', '★状態(NOT_STARTED/IN_PROGRESS/COMPLETED/ON_HOLD)', '★個人目標日 YYYY-MM-DD(編集可)', '共通期限日(自動計算)', '★研究メモ・コメント(編集可)', '最終更新日時(自動)']];
        progSheet.getRange(1, 1, 1, 12).setValues(progHeader).setBackground('#0B1F3A').setFontColor('#FFFFFF').setFontWeight('bold');
        const progData = body.progressRows.map(p => [
          p.progressId,
          p.studentId,
          p.studentName || '',
          p.historicalGrade,
          p.taskId,
          p.category,
          p.title,
          p.status,
          p.personalTargetDate || '',
          p.commonDueDate || '',
          p.comment || '',
          p.updatedAt || new Date().toISOString()
        ]);
        if (progData.length > 0) {
          progSheet.getRange(2, 1, progData.length, 12).setValues(progData);
        }
      }

      return jsonResponse({
        ok: true,
        spreadsheetUrl: ss.getUrl(),
        remoteEventRows: remoteEventRows,
        remoteProgressRows: remoteProgressRows
      });
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
