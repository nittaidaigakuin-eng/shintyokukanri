/**
 * 日付・期限・残日数・進捗計算の共通ドメインユーティリティ
 * MASTER_SPEC.md #32〜#40, #60, #67 に完全準拠
 */

import type {
  AcademicEvent,
  DeadlineStateLabel,
  DueSource,
  MasterGrade,
  NotificationLog,
  ProgressRecord,
  ProgressStatus,
  RoadmapTask,
  Student,
} from '../types/domain';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * YYYY-MM-DD 形式かどうかを検証する
 */
export function isValidDateString(dateStr: string | null | undefined): dateStr is string {
  if (!dateStr || !DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Date オブジェクトまたは現在時刻を Asia/Tokyo 基準の YYYY-MM-DD 文字列に変換する (#40)
 */
export function getTokyoDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * YYYY-MM-DD を UTC 正午のミリ秒に変換する（タイムゾーンずれ防止）
 */
function parseDateToUtcDays(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * UTC日数から YYYY-MM-DD 文字列へ戻す
 */
function formatUtcDaysToDate(utcDays: number): string {
  const dt = new Date(utcDays * 86_400_000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 指定された YYYY-MM-DD に日数を加算・減算する
 */
export function addDaysToDateString(dateStr: string, offsetDays: number): string {
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  const baseDays = parseDateToUtcDays(dateStr);
  return formatUtcDaysToDate(baseDays + offsetDays);
}

/**
 * #37 「直前月曜」の計算
 * 定義：対象日の直前の月曜日。
 * 対象日そのものが月曜日の場合は、7日前の月曜日を使用する。
 */
export function getPreviousMonday(targetDateStr: string): string {
  if (!isValidDateString(targetDateStr)) {
    throw new Error(`Invalid date string: ${targetDateStr}`);
  }
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfWeek = dt.getUTCDay();
  let daysToSubtract: number;
  if (dayOfWeek === 1) {
    // 対象日そのものが月曜日の場合は7日前の月曜日
    daysToSubtract = 7;
  } else if (dayOfWeek === 0) {
    // 日曜日の場合は6日前の月曜日
    daysToSubtract = 6;
  } else {
    // 火曜(2)〜土曜(6)の場合は (dayOfWeek - 1) 日前
    daysToSubtract = dayOfWeek - 1;
  }
  return addDaysToDateString(targetDateStr, -daysToSubtract);
}

/**
 * 年度イベントとロードマップ定義から共通期限 (commonDueDate) を算出する (#28, #30, #37)
 */
export function calculateCommonDueDate(
  task: Pick<RoadmapTask, 'deadlineType' | 'baseEventKey' | 'offsetDays' | 'deadlineRule'>,
  events: AcademicEvent[]
): string | null {
  if (task.deadlineType !== 'COMMON_EVENT' || !task.baseEventKey) {
    return null;
  }
  const baseEvent = events.find((e) => e.eventKey === task.baseEventKey);
  if (!baseEvent || !isValidDateString(baseEvent.date)) {
    return null;
  }

  let calculated = baseEvent.date;
  if (typeof task.offsetDays === 'number' && task.offsetDays !== 0) {
    calculated = addDaysToDateString(calculated, task.offsetDays);
  }
  if (task.deadlineRule === 'PREVIOUS_MONDAY') {
    calculated = getPreviousMonday(calculated);
  }
  return calculated;
}

/**
 * #36 個人目標日と共通期限の適用ルール
 * 最優先は個人目標日 (personalTargetDate)
 */
export function resolveAppliedDueDate(
  personalTargetDate: string | null | undefined,
  commonDueDate: string | null | undefined
): { appliedDueDate: string | null; dueSource: DueSource } {
  if (isValidDateString(personalTargetDate)) {
    return {
      appliedDueDate: personalTargetDate,
      dueSource: 'PERSONAL',
    };
  }
  if (isValidDateString(commonDueDate)) {
    return {
      appliedDueDate: commonDueDate,
      dueSource: 'COMMON',
    };
  }
  return {
    appliedDueDate: null,
    dueSource: 'NONE',
  };
}

/**
 * #40 残日数の計算（Asia/Tokyo基準の今日の日付 YYYY-MM-DD と appliedDueDate の差分日数）
 * - 正の値: 期限まであと N 日
 * - 0: 本日期限
 * - 負の値: 期限超過（|N| 日超過）
 * - null: 期限なし
 */
export function calculateRemainingDays(
  appliedDueDate: string | null | undefined,
  todayTokyoStr: string = getTokyoDateString()
): number | null {
  if (!isValidDateString(appliedDueDate)) {
    return null;
  }
  if (!isValidDateString(todayTokyoStr)) {
    throw new Error(`Invalid today date string: ${todayTokyoStr}`);
  }
  return parseDateToUtcDays(appliedDueDate) - parseDateToUtcDays(todayTokyoStr);
}

/**
 * #39 期限状態ラベルの判定
 * 値: '期限なし' | '予定' | 'まもなく' | '本日' | '期限超過' | '完了'
 * ※ まもなく = 残り1日〜7日以内
 */
export function evaluateDeadlineState(
  status: ProgressStatus,
  appliedDueDate: string | null | undefined,
  todayTokyoStr: string = getTokyoDateString(),
  soonThresholdDays = 7
): { label: DeadlineStateLabel; remainingDays: number | null } {
  const remainingDays = calculateRemainingDays(appliedDueDate, todayTokyoStr);

  if (status === 'COMPLETED') {
    return { label: '完了', remainingDays };
  }
  if (remainingDays === null) {
    return { label: '期限なし', remainingDays: null };
  }
  if (remainingDays < 0) {
    return { label: '期限超過', remainingDays };
  }
  if (remainingDays === 0) {
    return { label: '本日', remainingDays: 0 };
  }
  if (remainingDays <= soonThresholdDays) {
    return { label: 'まもなく', remainingDays };
  }
  return { label: '予定', remainingDays };
}

/**
 * #38 進捗率の計算
 * 現在学年 (currentGrade) の progressManaged = true のタスクのみを対象とする。
 * 例: M2学生の場合、M2の44タスクを基準にし、M1履歴は進捗率へ含めない。
 */
export interface GradeProgressSummary {
  grade: MasterGrade;
  totalManagedTasks: number;
  completedManagedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  dueWithin7DaysTasks: number;
  unconfiguredPersonalTargetTasks: number;
  percentage: number; // 0 - 100 (整数丸め)
}

export function calculateGradeProgressSummary(
  currentGrade: MasterGrade,
  allStudentProgress: ProgressRecord[],
  todayTokyoStr: string = getTokyoDateString()
): GradeProgressSummary {
  const currentGradeRecords = allStudentProgress.filter(
    (p) => p.historicalGrade === currentGrade
  );
  const managedRecords = currentGradeRecords.filter((p) => p.progressManaged);

  const totalManagedTasks = managedRecords.length;
  const completedManagedTasks = managedRecords.filter(
    (p) => p.status === 'COMPLETED'
  ).length;

  let inProgressTasks = 0;
  let overdueTasks = 0;
  let dueWithin7DaysTasks = 0;
  let unconfiguredPersonalTargetTasks = 0;

  for (const record of currentGradeRecords) {
    if (record.status === 'IN_PROGRESS') {
      inProgressTasks++;
    }
    if (record.status !== 'COMPLETED') {
      const { label, remainingDays } = evaluateDeadlineState(
        record.status,
        record.appliedDueDate,
        todayTokyoStr
      );
      if (label === '期限超過') {
        overdueTasks++;
      } else if (
        remainingDays !== null &&
        remainingDays >= 0 &&
        remainingDays <= 7
      ) {
        dueWithin7DaysTasks++;
      }
      if (!isValidDateString(record.personalTargetDate) && !isValidDateString(record.commonDueDate)) {
        unconfiguredPersonalTargetTasks++;
      }
    }
  }

  const percentage =
    totalManagedTasks === 0
      ? 0
      : Math.round((completedManagedTasks / totalManagedTasks) * 100);

  return {
    grade: currentGrade,
    totalManagedTasks,
    completedManagedTasks,
    inProgressTasks,
    overdueTasks,
    dueWithin7DaysTasks,
    unconfiguredPersonalTargetTasks,
    percentage,
  };
}

/**
 * #33 M1→M2 進級処理時の新規progress生成ロジック（純粋関数）
 * - students.currentGrade を M1 -> M2 へ変更
 * - M1 の progress は一切削除・変更しない（historicalGrade = 'M1' のまま維持）
 * - M2 用の progress を新規生成して追加する
 */
export function promoteStudentToM2(
  student: Student,
  existingProgress: ProgressRecord[],
  roadmapTasks: RoadmapTask[],
  academicEvents: AcademicEvent[],
  actorUid: string,
  nowIso: string = new Date().toISOString()
): { updatedStudent: Student; mergedProgress: ProgressRecord[]; addedCount: number } {
  const updatedStudent: Student = {
    ...student,
    currentGrade: 'M2',
    updatedAt: nowIso,
  };

  // M1 の historicalGrade が書き換わらないようコピーを保護
  const preservedProgress = existingProgress.map((p) => ({ ...p }));
  const existingIds = new Set(preservedProgress.map((p) => p.progressId));

  const m2Tasks = roadmapTasks
    .filter((t) => t.grade === 'M2' && t.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const newM2Progress: ProgressRecord[] = [];

  for (const task of m2Tasks) {
    const progressId = `${student.studentId}_${task.taskId}`;
    if (existingIds.has(progressId)) {
      continue;
    }
    const commonDueDate = calculateCommonDueDate(task, academicEvents);
    const { appliedDueDate, dueSource } = resolveAppliedDueDate(null, commonDueDate);

    newM2Progress.push({
      progressId,
      studentId: student.studentId,
      taskId: task.taskId,
      historicalGrade: 'M2',
      category: task.category,
      title: task.title,
      displayOrder: task.displayOrder,
      progressManaged: task.progressManaged,
      personalTargetDate: null,
      commonDueDate,
      appliedDueDate,
      dueSource,
      status: 'NOT_STARTED',
      completedAt: null,
      comment: '',
      updatedAt: nowIso,
      updatedByUid: actorUid,
    });
  }

  return {
    updatedStudent,
    mergedProgress: [...preservedProgress, ...newM2Progress],
    addedCount: newM2Progress.length,
  };
}

/**
 * #60 通知重複防止キーの生成と送信可否判定
 * notificationId = studentId_taskId_dueDate_remindDays
 * SUCCESS済みなら再送しない。FAILEDなら再試行可能。
 */
export function buildNotificationId(
  studentId: string,
  taskId: string,
  dueDate: string,
  remindDays: number
): string {
  return `${studentId}_${taskId}_${dueDate}_${remindDays}`;
}

export function shouldSendNotification(
  notificationId: string,
  existingLogs: Pick<NotificationLog, 'notificationId' | 'result'>[]
): boolean {
  const matched = existingLogs.filter(
    (log) => log.notificationId === notificationId
  );
  // 1件でも SUCCESS があれば再送しない
  if (matched.some((log) => log.result === 'SUCCESS')) {
    return false;
  }
  return true;
}

/**
 * #67, #68 Calendar 同期アクション判定
 * - calendarDisplay = true かつ date あり -> 既存 calendarEventId があれば UPDATE、なければ CREATE
 * - calendarDisplay = false または date 削除 -> 既存 calendarEventId があれば DELETE、なければ NOOP
 */
export type CalendarSyncAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'NOOP';

export function determineCalendarSyncAction(
  event: Pick<AcademicEvent, 'calendarDisplay' | 'date'>,
  existingCalendarEventId: string | null | undefined
): CalendarSyncAction {
  const shouldBeOnCalendar =
    event.calendarDisplay === true && isValidDateString(event.date);

  if (shouldBeOnCalendar) {
    return existingCalendarEventId ? 'UPDATE' : 'CREATE';
  } else {
    return existingCalendarEventId ? 'DELETE' : 'NOOP';
  }
}

/**
 * ③ Googleカレンダーとの双方向同期（Webアプリ ⇄ Google Calendar）マージロジック
 * - Webアプリで登録・更新された予定は Google Calendar 側へ送信 (outbound)
 * - Google Calendar 側で新規追加・変更された予定（授業・研究室行事・公式日程）は Webアプリ側へ反映 (inbound)
 * - 双方で同じイベントが更新された場合は updatedAt が新しい方を採用する
 */
export interface ExternalGoogleCalendarEvent {
  googleCalendarEventId: string;
  eventKey?: string | null;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm
  category?: 'OFFICIAL' | 'CLASS' | 'LAB_EVENT';
  notes?: string;
  updatedAt: string; // ISO
}

export function mergeBidirectionalCalendarEvents(
  localEvents: AcademicEvent[],
  remoteCalendarEvents: ExternalGoogleCalendarEvent[]
): {
  mergedEvents: AcademicEvent[];
  importedCount: number;
  updatedFromGoogleCount: number;
} {
  const mergedMap = new Map<string, AcademicEvent>();
  for (const ev of localEvents) {
    mergedMap.set(ev.eventKey, { ...ev });
  }

  let importedCount = 0;
  let updatedFromGoogleCount = 0;

  for (const remote of remoteCalendarEvents) {
    if (!isValidDateString(remote.date)) continue;

    // 既存イベントを eventKey または googleCalendarEventId で検索
    let matchedKey: string | null = null;
    if (remote.eventKey && mergedMap.has(remote.eventKey)) {
      matchedKey = remote.eventKey;
    } else {
      for (const [k, v] of mergedMap.entries()) {
        if (
          v.googleCalendarEventId &&
          v.googleCalendarEventId === remote.googleCalendarEventId
        ) {
          matchedKey = k;
          break;
        }
      }
    }

    if (matchedKey) {
      const existing = mergedMap.get(matchedKey)!;
      const localUpdated = existing.updatedAt ?? '1970-01-01T00:00:00.000Z';
      if (remote.updatedAt > localUpdated) {
        mergedMap.set(matchedKey, {
          ...existing,
          name: remote.title || existing.name,
          date: remote.date,
          time: remote.time ?? existing.time,
          notes: remote.notes ?? existing.notes,
          googleCalendarEventId: remote.googleCalendarEventId,
          syncOrigin: 'GOOGLE_CALENDAR',
          updatedAt: remote.updatedAt,
        });
        updatedFromGoogleCount++;
      }
    } else {
      const newKey =
        remote.eventKey || `GCAL_${remote.googleCalendarEventId}`;
      mergedMap.set(newKey, {
        eventKey: newKey,
        name: remote.title,
        eventCategory: remote.category ?? 'LAB_EVENT',
        target: 'ALL',
        date: remote.date,
        time: remote.time ?? null,
        reminderDays: [7, 3, 0],
        calendarDisplay: true,
        notes: remote.notes ?? 'Googleカレンダーから取込',
        googleCalendarEventId: remote.googleCalendarEventId,
        syncOrigin: 'GOOGLE_CALENDAR',
        updatedAt: remote.updatedAt,
      });
      importedCount++;
    }
  }

  return {
    mergedEvents: Array.from(mergedMap.values()).sort((a, b) =>
      (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99')
    ),
    importedCount,
    updatedFromGoogleCount,
  };
}

