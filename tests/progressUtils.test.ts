/**
 * ロジック単体テスト (#96)
 * - 個人目標日優先 (#36)
 * - 共通期限 (#28, #30)
 * - 直前月曜 (#37)
 * - M1→M2 進級処理 (#33)
 * - M2進捗率 (#38)
 * - M1履歴保持 (#32)
 * - 通知重複防止 (#60)
 * - Calendar重複防止 (#67, #68)
 * - ロードマップ件数検証 (M1=17, M2=44, 合計=61) (#25, #92)
 */

import { describe, expect, it } from 'vitest';
import {
  buildNotificationId,
  calculateCommonDueDate,
  calculateGradeProgressSummary,
  calculateRemainingDays,
  determineCalendarSyncAction,
  evaluateDeadlineState,
  getPreviousMonday,
  mergeBidirectionalCalendarEvents,
  mergeBidirectionalSpreadsheetData,
  promoteStudentToM2,
  resolveAppliedDueDate,
  shouldSendNotification,
} from '../src/lib/progressUtils';
import {
  DEFAULT_ACADEMIC_EVENTS_2026,
  INITIAL_ROADMAP_TASKS,
} from '../src/data/roadmapSeed';
import type { ProgressRecord, Student } from '../src/types/domain';

describe('Roadmap Seed Integrity (#25, #92)', () => {
  it('contains exactly 17 M1 tasks and 44 M2 tasks (61 total)', () => {
    const m1 = INITIAL_ROADMAP_TASKS.filter((t) => t.grade === 'M1');
    const m2 = INITIAL_ROADMAP_TASKS.filter((t) => t.grade === 'M2');
    expect(m1).toHaveLength(17);
    expect(m2).toHaveLength(44);
    expect(INITIAL_ROADMAP_TASKS).toHaveLength(61);

    const uniqueTaskIds = new Set(INITIAL_ROADMAP_TASKS.map((t) => t.taskId));
    expect(uniqueTaskIds.size).toBe(61);
  });
});

describe('getPreviousMonday (#37 直前月曜)', () => {
  it('returns the Monday of the same week if target date is Tuesday..Sunday', () => {
    // 2026-07-18 is Saturday -> previous Monday is 2026-07-13
    expect(getPreviousMonday('2026-07-18')).toBe('2026-07-13');
    // 2026-07-19 is Sunday -> previous Monday is 2026-07-13
    expect(getPreviousMonday('2026-07-19')).toBe('2026-07-13');
    // 2026-07-14 is Tuesday -> previous Monday is 2026-07-13
    expect(getPreviousMonday('2026-07-14')).toBe('2026-07-13');
  });

  it('returns 7 days prior Monday when target date itself is Monday', () => {
    // 2026-07-13 is Monday -> 7 days prior is 2026-07-06
    expect(getPreviousMonday('2026-07-13')).toBe('2026-07-06');
  });
});

describe('resolveAppliedDueDate & calculateCommonDueDate (#36 個人目標日優先・共通期限)', () => {
  it('prioritizes personalTargetDate over commonDueDate', () => {
    const result = resolveAppliedDueDate('2026-06-15', '2026-06-30');
    expect(result).toEqual({
      appliedDueDate: '2026-06-15',
      dueSource: 'PERSONAL',
    });
  });

  it('falls back to commonDueDate when personalTargetDate is null', () => {
    const result = resolveAppliedDueDate(null, '2026-06-30');
    expect(result).toEqual({
      appliedDueDate: '2026-06-30',
      dueSource: 'COMMON',
    });
  });

  it('returns NONE when neither date exists', () => {
    const result = resolveAppliedDueDate(null, null);
    expect(result).toEqual({
      appliedDueDate: null,
      dueSource: 'NONE',
    });
  });

  it('calculates commonDueDate from academic year events and PREVIOUS_MONDAY rule', () => {
    // M2-08: 中間発表抄録（要旨）の提出 -> M2_MIDTERM_PRESENTATION (2026-07-18 Sat) の直前月曜 = 2026-07-13
    const task = INITIAL_ROADMAP_TASKS.find((t) => t.taskId === 'M2-08')!;
    const commonDue = calculateCommonDueDate(task, DEFAULT_ACADEMIC_EVENTS_2026);
    expect(commonDue).toBe('2026-07-13');
  });
});

describe('evaluateDeadlineState & calculateRemainingDays (#39, #40)', () => {
  const today = '2026-11-03';

  it('evaluates overdue, today, soon, scheduled, none, and completed states accurately', () => {
    expect(calculateRemainingDays('2026-11-01', today)).toBe(-2);
    expect(evaluateDeadlineState('IN_PROGRESS', '2026-11-01', today).label).toBe('期限超過');
    expect(evaluateDeadlineState('IN_PROGRESS', '2026-11-03', today).label).toBe('本日');
    expect(evaluateDeadlineState('IN_PROGRESS', '2026-11-10', today).label).toBe('まもなく');
    expect(evaluateDeadlineState('IN_PROGRESS', '2026-11-15', today).label).toBe('予定');
    expect(evaluateDeadlineState('NOT_STARTED', null, today).label).toBe('期限なし');
    expect(evaluateDeadlineState('COMPLETED', '2026-11-01', today).label).toBe('完了');
  });
});

describe('M1 -> M2 Promotion, Historical Grade Preservation & M2 Progress Rate (#32, #33, #38)', () => {
  const sampleStudent: Student = {
    studentId: 'S001',
    name: '山田 太郎',
    email: 's001@example.ac.jp',
    course: 'MASTER',
    currentGrade: 'M1',
    enrollmentYear: 2025,
    supervisor: '佐藤 教授',
    enrollmentStatus: '在籍',
    notificationEnabled: true,
    notes: '',
    createdAt: '2025-04-01T00:00:00.000Z',
    updatedAt: '2025-04-01T00:00:00.000Z',
  };

  // M1の17件がすべてCOMPLETEDの状態を作る
  const m1Progress: ProgressRecord[] = INITIAL_ROADMAP_TASKS.filter(
    (t) => t.grade === 'M1'
  ).map((t) => ({
    progressId: `S001_${t.taskId}`,
    studentId: 'S001',
    taskId: t.taskId,
    historicalGrade: 'M1',
    category: t.category,
    title: t.title,
    displayOrder: t.displayOrder,
    progressManaged: t.progressManaged,
    personalTargetDate: '2025-10-01',
    commonDueDate: null,
    appliedDueDate: '2025-10-01',
    dueSource: 'PERSONAL',
    status: 'COMPLETED',
    completedAt: '2025-10-01T09:00:00.000Z',
    comment: 'M1完了',
    updatedAt: '2025-10-01T09:00:00.000Z',
    updatedByUid: 'admin-uid',
  }));

  it('preserves all 17 M1 records with historicalGrade="M1" and generates 44 M2 records on promotion', () => {
    const { updatedStudent, mergedProgress, addedCount } = promoteStudentToM2(
      sampleStudent,
      m1Progress,
      INITIAL_ROADMAP_TASKS,
      DEFAULT_ACADEMIC_EVENTS_2026,
      'admin-uid',
      '2026-04-01T00:00:00.000Z'
    );

    expect(updatedStudent.currentGrade).toBe('M2');
    expect(addedCount).toBe(44);
    expect(mergedProgress).toHaveLength(61);

    const m1RecordsAfter = mergedProgress.filter((p) => p.historicalGrade === 'M1');
    const m2RecordsAfter = mergedProgress.filter((p) => p.historicalGrade === 'M2');
    expect(m1RecordsAfter).toHaveLength(17);
    expect(m2RecordsAfter).toHaveLength(44);

    // M2進捗率はM2の44タスクのみを基準とし、M1完了分を含めない (#38)
    const m2SummaryInitial = calculateGradeProgressSummary(
      'M2',
      mergedProgress,
      '2026-04-15'
    );
    expect(m2SummaryInitial.totalManagedTasks).toBe(44);
    expect(m2SummaryInitial.completedManagedTasks).toBe(0);
    expect(m2SummaryInitial.percentage).toBe(0);

    // M2の44件のうち11件（25%）を完了にした場合
    for (let i = 0; i < 11; i++) {
      m2RecordsAfter[i].status = 'COMPLETED';
    }
    const m2SummaryQuarter = calculateGradeProgressSummary(
      'M2',
      mergedProgress,
      '2026-06-01'
    );
    expect(m2SummaryQuarter.completedManagedTasks).toBe(11);
    expect(m2SummaryQuarter.percentage).toBe(25);

    // M1履歴の進捗率を参照すれば100%のまま維持されている
    const m1HistorySummary = calculateGradeProgressSummary(
      'M1',
      mergedProgress,
      '2026-06-01'
    );
    expect(m1HistorySummary.totalManagedTasks).toBe(17);
    expect(m1HistorySummary.completedManagedTasks).toBe(17);
    expect(m1HistorySummary.percentage).toBe(100);
  });
});

describe('Notification & Calendar Deduplication (#60, #67, #68)', () => {
  it('prevents duplicate notification if SUCCESS exists, but allows retry if FAILED', () => {
    const notifId = buildNotificationId('S001', 'M2-08', '2026-07-13', 7);
    expect(notifId).toBe('S001_M2-08_2026-07-13_7');

    // 未送信なら true
    expect(shouldSendNotification(notifId, [])).toBe(true);

    // FAILED のみなら再試行可能 (true)
    expect(
      shouldSendNotification(notifId, [
        { notificationId: notifId, result: 'FAILED' },
      ])
    ).toBe(true);

    // SUCCESS 済みなら再送しない (false)
    expect(
      shouldSendNotification(notifId, [
        { notificationId: notifId, result: 'FAILED' },
        { notificationId: notifId, result: 'SUCCESS' },
      ])
    ).toBe(false);
  });

  it('determines CREATE, UPDATE, DELETE, NOOP for Google Calendar sync', () => {
    expect(
      determineCalendarSyncAction({ calendarDisplay: true, date: '2026-07-18' }, null)
    ).toBe('CREATE');

    expect(
      determineCalendarSyncAction(
        { calendarDisplay: true, date: '2026-07-18' },
        'cal_event_123'
      )
    ).toBe('UPDATE');

    expect(
      determineCalendarSyncAction(
        { calendarDisplay: false, date: '2026-07-18' },
        'cal_event_123'
      )
    ).toBe('DELETE');

    expect(
      determineCalendarSyncAction(
        { calendarDisplay: true, date: null },
        'cal_event_123'
      )
    ).toBe('DELETE');

    expect(
      determineCalendarSyncAction({ calendarDisplay: false, date: null }, null)
    ).toBe('NOOP');
  });

  it('merges bidirectional Google Calendar events (Google -> Web new import & update)', () => {
    const localEvents = [
      {
        eventKey: 'M2_MIDTERM_PRESENTATION',
        name: 'M2中間発表日',
        eventCategory: 'OFFICIAL' as const,
        target: 'M2' as const,
        date: '2026-07-18',
        time: '09:00',
        reminderDays: [14, 7, 3, 0],
        calendarDisplay: true,
        notes: '初期メモ',
        googleCalendarEventId: 'gcal-100',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ];
    const remoteEvents = [
      {
        googleCalendarEventId: 'gcal-100',
        eventKey: 'M2_MIDTERM_PRESENTATION',
        title: 'M2中間発表日（変更後）',
        date: '2026-07-25',
        time: '13:00',
        category: 'OFFICIAL' as const,
        notes: 'Googleカレンダー側で日程変更',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      {
        googleCalendarEventId: 'gcal-200',
        title: '【授業】後期合同ゼミ',
        date: '2026-10-05',
        time: '10:00',
        category: 'CLASS' as const,
        notes: '全員出席',
        updatedAt: '2026-05-02T00:00:00.000Z',
      },
    ];

    const res = mergeBidirectionalCalendarEvents(localEvents, remoteEvents);

    expect(res.updatedFromGoogleCount).toBe(1);
    expect(res.importedCount).toBe(1);
    expect(res.mergedEvents).toHaveLength(2);
    expect(res.mergedEvents[0].date).toBe('2026-07-25');
    expect(res.mergedEvents[1].eventCategory).toBe('CLASS');
    expect(res.mergedEvents[1].syncOrigin).toBe('GOOGLE_CALENDAR');
  });

  it('merges bidirectional Google Spreadsheet edits (event dates & student progress) and recalculates common due dates', () => {
    const localEvents = [
      {
        eventKey: 'M2_MIDTERM_PRESENTATION',
        name: 'M2中間発表日',
        eventCategory: 'OFFICIAL' as const,
        target: 'M2' as const,
        date: '2026-07-18',
        time: '09:00',
        reminderDays: [14, 7, 3, 0],
        calendarDisplay: true,
        notes: '初期',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ];
    const localProgress: ProgressRecord[] = [
      {
        progressId: 'S001_M2-08',
        studentId: 'S001',
        taskId: 'M2-08',
        historicalGrade: 'M2',
        category: '04_中間発表',
        title: '中間発表抄録（要旨）の提出',
        displayOrder: 8,
        progressManaged: true,
        personalTargetDate: null,
        commonDueDate: '2026-07-13',
        appliedDueDate: '2026-07-13',
        dueSource: 'COMMON',
        status: 'NOT_STARTED',
        completedAt: null,
        comment: '',
        updatedAt: '2026-04-01T00:00:00.000Z',
        updatedByUid: 'uid-admin',
      },
    ];

    const res = mergeBidirectionalSpreadsheetData({
      localEvents,
      localProgress,
      roadmapTasks: INITIAL_ROADMAP_TASKS,
      remoteEventRows: [
        {
          eventKey: 'M2_MIDTERM_PRESENTATION',
          name: 'M2中間発表日',
          date: '2026-07-25', // Saturday -> previous Monday is 2026-07-20
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      remoteProgressRows: [
        {
          progressId: 'S001_M2-08',
          studentId: 'S001',
          taskId: 'M2-08',
          status: 'IN_PROGRESS',
          personalTargetDate: '2026-07-15',
          comment: 'スプレッドシート上で目標日を設定',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      nowIso: '2026-05-02T00:00:00.000Z',
    });

    expect(res.updatedEventCount).toBe(1);
    expect(res.updatedProgressCount).toBe(1);
    expect(res.mergedEvents[0].date).toBe('2026-07-25');
    expect(res.mergedProgress[0].commonDueDate).toBe('2026-07-20');
    expect(res.mergedProgress[0].personalTargetDate).toBe('2026-07-15');
    expect(res.mergedProgress[0].appliedDueDate).toBe('2026-07-15');
    expect(res.mergedProgress[0].status).toBe('IN_PROGRESS');
  });
});
