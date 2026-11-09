/**
 * 大学院研究進捗管理Webアプリ — ドメイン型定義
 * MASTER_SPEC.md および研究室からの追加意見（①学生間共有、②管理体制分担、③Googleカレンダー双方向連携・行事管理、④研究プロセス記録蓄積、⑤メール送信機能）に完全準拠
 */

export type CourseType = 'MASTER' | 'DOCTOR';

export type MasterGrade = 'M1' | 'M2';
export type GradeType = MasterGrade | 'D1' | 'D2' | 'D3';

export type EnrollmentStatus = '在籍' | '休学' | '修了' | '退学';

export type ProgressStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD';

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  NOT_STARTED: '未着手',
  IN_PROGRESS: '進行中',
  COMPLETED: '完了',
  ON_HOLD: '保留',
};

export type DueSource = 'PERSONAL' | 'COMMON' | 'NONE';

export type DeadlineStateLabel =
  | '期限なし'
  | '予定'
  | 'まもなく'
  | '本日'
  | '期限超過'
  | '完了';

export interface UserRoles {
  student: boolean;
  admin: boolean;
  teacher?: boolean;
}

/**
 * 19. userProfiles Collection (Document ID: uid)
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  studentId: string | null;
  roles: UserRoles;
  mustChangePassword: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

/**
 * 20. students Collection (Document ID: studentId, e.g., S001)
 */
export interface Student {
  studentId: string;
  name: string;
  email: string;
  course: CourseType;
  currentGrade: MasterGrade;
  enrollmentYear: number;
  supervisor: string;
  enrollmentStatus: EnrollmentStatus;
  notificationEnabled: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type DeadlineType = 'PERSONAL' | 'COMMON_EVENT' | 'COMMON_FIXED' | 'NONE';
export type DeadlineRule = 'EXACT' | 'PREVIOUS_MONDAY' | 'MANUAL' | 'NONE';

/**
 * 24. roadmapTasks Collection (Document ID: taskId)
 */
export interface RoadmapTask {
  taskId: string;
  grade: MasterGrade;
  category: string;
  title: string;
  studentAction: string;
  requirement: string;
  deadlineType: DeadlineType;
  baseEventKey: string | null;
  offsetDays: number | null;
  deadlineRule: DeadlineRule;
  guideline: string;
  progressManaged: boolean;
  adminOnlyEdit?: boolean;
  reminderPattern: number[];
  calendarDisplay: boolean;
  displayOrder: number;
  notes: string;
  active: boolean;
}

/**
 * ③ Googleカレンダー双方向連携に対応する予定種別
 * - OFFICIAL: 公式研究日程（中間発表・論文提出など共通期限の基準）
 * - CLASS: 授業・ゼミ日程
 * - LAB_EVENT: 研究室行事・ミーティング・学会等
 */
export type ScheduleEventCategory = 'OFFICIAL' | 'CLASS' | 'LAB_EVENT';

export const SCHEDULE_EVENT_CATEGORY_LABELS: Record<
  ScheduleEventCategory,
  string
> = {
  OFFICIAL: '公式研究日程',
  CLASS: '授業・ゼミ',
  LAB_EVENT: '研究室行事',
};

/**
 * 29-30. academicYears/{year}/events/{eventKey}
 * 双方向同期（Webアプリ ⇄ Google Calendar）に対応
 */
export interface AcademicEvent {
  eventKey: string;
  name: string;
  eventCategory?: ScheduleEventCategory;
  target: MasterGrade | 'ALL';
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  reminderDays: number[];
  calendarDisplay: boolean;
  notes: string;
  googleCalendarEventId?: string | null;
  syncOrigin?: 'WEB_APP' | 'GOOGLE_CALENDAR';
  updatedAt?: string;
}

export interface AcademicYear {
  year: number;
  isCurrent: boolean;
  updatedAt: string;
  events: AcademicEvent[];
}

/**
 * ④ 研究プロセスの記録・振り返り用ログエントリ
 * 単なる現在の状態表示だけでなく、研究がどのような過程で進んできたかを時系列で蓄積する
 */
export interface ResearchProcessLogEntry {
  logId: string;
  studentId: string;
  taskId: string;
  taskTitle: string;
  category: string;
  grade: MasterGrade;
  previousStatus: ProgressStatus;
  newStatus: ProgressStatus;
  personalTargetDate: string | null;
  comment: string;
  recordedAt: string; // ISO timestamp
  recordedByName: string;
}

/**
 * 31. progress Collection (Document ID: {studentId}_{taskId})
 */
export interface ProgressRecord {
  progressId: string; // `${studentId}_${taskId}`
  studentId: string;
  taskId: string;
  historicalGrade: MasterGrade;
  category: string;
  title: string;
  displayOrder: number;
  progressManaged: boolean;
  personalTargetDate: string | null; // YYYY-MM-DD
  commonDueDate: string | null; // YYYY-MM-DD
  appliedDueDate: string | null; // YYYY-MM-DD
  dueSource: DueSource;
  status: ProgressStatus;
  completedAt: string | null; // ISO timestamp
  comment: string;
  updatedAt: string; // ISO timestamp
  updatedByUid: string;
}

/**
 * ②・④ 来年度の管理体制および研究室運用ルール設定
 */
export interface LabOperationConfig {
  academicYear: number;
  primaryAdminName: string; // 主管理者（教員または全体管理者）
  studentAdminNames: string; // 学生管理担当（例：菊水・立山）
  scheduleManagerName: string; // 年間スケジュール・カレンダー登録担当
  taskManagerName: string; // タスク更新・情報修正担当
  updateTimingRule: string; // 学生が進捗を更新するタイミング（例：毎週のゼミ前日までに更新）
  reviewMethodRule: string; // 研究室全体での進捗確認方法（例：週次ゼミ冒頭で「研究室メンバーの進捗」画面を共有）
  googleCalendarId: string; // 連携先GoogleカレンダーID (例: nittai.daigakuin@gmail.com)
  googleSpreadsheetUrl?: string; // 連携先GoogleスプレッドシートURL（既存スプレッドシートに連携用シートを自動生成・双方向同期）
  gasBridgeWebhookUrl: string; // メール送信＆Googleカレンダー＆スプレッドシート双方向同期用GAS WebアプリURL
  updatedAt: string;
}

/**
 * 61. notificationLogs Collection (Document ID: {studentId}_{taskId}_{dueDate}_{remindDays})
 */
export interface NotificationLog {
  notificationId: string;
  progressId: string;
  studentId: string;
  taskId: string;
  dueDate: string;
  remindDays: number;
  recipientEmail: string;
  sentAt: string;
  result: 'SUCCESS' | 'FAILED';
  errorMessage: string | null;
}

/**
 * 67. calendarSync Collection (Document ID: syncKey = {year}_{eventKey})
 */
export interface CalendarSyncRecord {
  syncKey: string;
  year: number;
  eventKey: string;
  calendarEventId: string | null;
  lastSyncedAt: string;
  result: 'SUCCESS' | 'DELETED' | 'FAILED';
  errorMessage: string | null;
}

/**
 * 70. auditLogs Collection
 */
export type AuditAction =
  | 'CREATE_STUDENT'
  | 'DEACTIVATE_STUDENT'
  | 'ACTIVATE_STUDENT'
  | 'PROMOTE_GRADE'
  | 'CHANGE_ROLE'
  | 'RESET_PASSWORD'
  | 'UPDATE_ACADEMIC_YEAR'
  | 'UPDATE_ROADMAP'
  | 'ADMIN_UPDATE_PROGRESS'
  | 'SEND_REMINDER_EMAIL'
  | 'SYNC_GOOGLE_CALENDAR'
  | 'SYNC_GOOGLE_SPREADSHEET'
  | 'UPDATE_OPERATION_CONFIG';

export interface AuditLog {
  auditId: string;
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}
