/**
 * 大学院研究進捗管理Webアプリ — ドメイン型定義
 * MASTER_SPEC.md および DATA_MODEL.md に完全準拠
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
 * M1: 17件, M2: 44件, 合計: 61件
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
 * 29-30. academicYears/{year}/events/{eventKey}
 */
export interface AcademicEvent {
  eventKey: string;
  name: string;
  target: MasterGrade | 'ALL';
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  reminderDays: number[];
  calendarDisplay: boolean;
  notes: string;
}

export interface AcademicYear {
  year: number;
  isCurrent: boolean;
  updatedAt: string;
  events: AcademicEvent[];
}

/**
 * 31. progress Collection (Document ID: {studentId}_{taskId})
 * 注意: historicalGrade はタスクが属する歴史的学年（M1→M2進級時もM1のhistoricalGradeはM1のまま保持）
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
  | 'ADMIN_UPDATE_PROGRESS';

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
