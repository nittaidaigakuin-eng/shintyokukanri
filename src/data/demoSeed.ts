/**
 * デモ・初期検証用データセット
 * Firebase 接続前またはローカル検証時に、学生画面・管理者画面・兼務切替・初回PW変更・M1/M2進級等すべての仕様を即座にテスト可能にする
 */

import type {
  AuditLog,
  ProgressRecord,
  Student,
  UserProfile,
} from '../types/domain';
import {
  DEFAULT_ACADEMIC_EVENTS_2026,
  INITIAL_ROADMAP_TASKS,
} from './roadmapSeed';
import {
  calculateCommonDueDate,
  resolveAppliedDueDate,
} from '../lib/progressUtils';

export const DEMO_USERS: Record<
  string,
  { password: string; profile: UserProfile }
> = {
  's001@nittai.ac.jp': {
    password: 'password123',
    profile: {
      uid: 'uid-s001',
      email: 's001@nittai.ac.jp',
      displayName: '青木 健太',
      studentId: 'S001',
      roles: { student: true, admin: false },
      mustChangePassword: false,
      active: true,
      createdAt: '2025-04-01T09:00:00.000Z',
      updatedAt: '2026-10-28T09:00:00.000Z',
      lastLoginAt: '2026-11-02T10:30:00.000Z',
    },
  },
  's002@nittai.ac.jp': {
    password: 'initpass123',
    profile: {
      uid: 'uid-s002',
      email: 's002@nittai.ac.jp',
      displayName: '高橋 美咲',
      studentId: 'S002',
      roles: { student: true, admin: false },
      // #12 初回ログイン時パスワード変更要求のテスト用アカウント
      mustChangePassword: true,
      active: true,
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
      lastLoginAt: null,
    },
  },
  'admin@nittai.ac.jp': {
    password: 'adminpassword',
    profile: {
      uid: 'uid-admin',
      email: 'admin@nittai.ac.jp',
      displayName: '佐藤 誠一（専攻主任・管理者）',
      studentId: null,
      roles: { student: false, admin: true },
      mustChangePassword: false,
      active: true,
      createdAt: '2025-04-01T09:00:00.000Z',
      updatedAt: '2026-11-01T09:00:00.000Z',
      lastLoginAt: '2026-11-03T00:10:00.000Z',
    },
  },
  'dual@nittai.ac.jp': {
    password: 'dualpassword',
    profile: {
      uid: 'uid-dual-s003',
      email: 'dual@nittai.ac.jp',
      displayName: '井上 翔太（TA・兼務）',
      studentId: 'S003',
      // #16 兼務ユーザー（学生画面 ⇄ 管理者画面 切替可能）
      roles: { student: true, admin: true },
      mustChangePassword: false,
      active: true,
      createdAt: '2025-04-01T09:00:00.000Z',
      updatedAt: '2026-11-01T09:00:00.000Z',
      lastLoginAt: '2026-11-02T18:00:00.000Z',
    },
  },
};

export const INITIAL_STUDENTS: Student[] = [
  {
    studentId: 'S001',
    name: '青木 健太',
    email: 's001@nittai.ac.jp',
    course: 'MASTER',
    currentGrade: 'M2',
    enrollmentYear: 2025,
    supervisor: '佐藤 誠一 教授',
    enrollmentStatus: '在籍',
    notificationEnabled: true,
    notes: 'M2本解析完了、論文初稿執筆フェーズ',
    createdAt: '2025-04-01T09:00:00.000Z',
    updatedAt: '2026-10-30T12:00:00.000Z',
  },
  {
    studentId: 'S002',
    name: '高橋 美咲',
    email: 's002@nittai.ac.jp',
    course: 'MASTER',
    currentGrade: 'M1',
    enrollmentYear: 2026,
    supervisor: '鈴木 健二 教授',
    enrollmentStatus: '在籍',
    notificationEnabled: true,
    notes: '倫理審査承認済み、予備実験準備中（一部個人目標日未設定）',
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: '2026-09-10T09:00:00.000Z', // 長期間更新なし検出対象
  },
  {
    studentId: 'S003',
    name: '井上 翔太',
    email: 'dual@nittai.ac.jp',
    course: 'MASTER',
    currentGrade: 'M2',
    enrollmentYear: 2025,
    supervisor: '佐藤 誠一 教授',
    enrollmentStatus: '在籍',
    notificationEnabled: true,
    notes: 'TA兼務アカウント',
    createdAt: '2025-04-01T09:00:00.000Z',
    updatedAt: '2026-11-01T15:00:00.000Z',
  },
  {
    studentId: 'S004',
    name: '渡辺 陽菜',
    email: 's004@nittai.ac.jp',
    course: 'MASTER',
    currentGrade: 'M1',
    enrollmentYear: 2026,
    supervisor: '田中 美穂 准教授',
    enrollmentStatus: '在籍',
    notificationEnabled: true,
    notes: '順調に進行中',
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: '2026-11-01T11:00:00.000Z',
  },
];

export function buildInitialDemoProgress(): ProgressRecord[] {
  const records: ProgressRecord[] = [];

  for (const student of INITIAL_STUDENTS) {
    // M2学生はM1履歴(17件) + M2現在進捗(44件) の両方を保持 (#32, #33)
    const gradesToGenerate: Array<'M1' | 'M2'> =
      student.currentGrade === 'M2' ? ['M1', 'M2'] : ['M1'];

    for (const grade of gradesToGenerate) {
      const gradeTasks = INITIAL_ROADMAP_TASKS.filter((t) => t.grade === grade);

      for (const task of gradeTasks) {
        const commonDueDate = calculateCommonDueDate(
          task,
          DEFAULT_ACADEMIC_EVENTS_2026
        );
        let personalTargetDate: string | null = null;
        let status: ProgressRecord['status'] = 'NOT_STARTED';
        let completedAt: string | null = null;
        let comment = '';
        let updatedAt = student.updatedAt;

        if (student.studentId === 'S001') {
          if (grade === 'M1') {
            status = 'COMPLETED';
            personalTargetDate = '2025-12-15';
            completedAt = '2026-03-15T10:00:00.000Z';
            comment = 'M1年度内に完了';
          } else {
            // M2: 44件中 19件完了、M2-20が期限超過、M2-21が進行中(7日以内期限)、M2-22が題目届
            if (task.displayOrder <= 19) {
              status = 'COMPLETED';
              completedAt = '2026-10-15T10:00:00.000Z';
            } else if (task.displayOrder === 20) {
              status = 'IN_PROGRESS';
              personalTargetDate = '2026-10-31'; // 期限超過（今日が 2026-11-03 想定）
              comment = '指導教員レビュー待ち（第3章構成の微修正中）';
            } else if (task.displayOrder === 21) {
              status = 'IN_PROGRESS';
              personalTargetDate = '2026-11-08'; // 5日後（まもなく）
              comment = '英文題目のネイティブチェック確認中';
            } else if (task.displayOrder === 23) {
              status = 'NOT_STARTED';
              personalTargetDate = '2026-11-20';
            }
          }
        } else if (student.studentId === 'S002') {
          // M1: 9件完了、10件目が期限超過、11件目以降の個人目標日が未設定、かつ最終更新が9月10日で長期未更新
          if (task.displayOrder <= 9) {
            status = 'COMPLETED';
            personalTargetDate = '2026-09-01';
            completedAt = '2026-09-10T09:00:00.000Z';
          } else if (task.displayOrder === 10) {
            status = 'IN_PROGRESS';
            personalTargetDate = '2026-10-20'; // 期限超過
            comment = '測定機器の校正日程を調整中';
          }
          updatedAt = '2026-09-10T09:00:00.000Z';
        } else if (student.studentId === 'S003') {
          if (grade === 'M1') {
            status = 'COMPLETED';
            completedAt = '2026-03-20T10:00:00.000Z';
          } else {
            if (task.displayOrder <= 21) {
              status = 'COMPLETED';
              completedAt = '2026-10-28T10:00:00.000Z';
            } else if (task.displayOrder === 22) {
              status = 'IN_PROGRESS';
            } else if (task.displayOrder === 23) {
              personalTargetDate = '2026-11-18';
              status = 'IN_PROGRESS';
            }
          }
        } else if (student.studentId === 'S004') {
          if (task.displayOrder <= 11) {
            status = 'COMPLETED';
            personalTargetDate = '2026-10-25';
            completedAt = '2026-10-25T10:00:00.000Z';
          } else if (task.displayOrder === 12) {
            status = 'IN_PROGRESS';
            personalTargetDate = '2026-12-10';
          } else {
            personalTargetDate = '2027-01-20';
          }
        }

        const { appliedDueDate, dueSource } = resolveAppliedDueDate(
          personalTargetDate,
          commonDueDate
        );

        records.push({
          progressId: `${student.studentId}_${task.taskId}`,
          studentId: student.studentId,
          taskId: task.taskId,
          historicalGrade: grade,
          category: task.category,
          title: task.title,
          displayOrder: task.displayOrder,
          progressManaged: task.progressManaged,
          personalTargetDate,
          commonDueDate,
          appliedDueDate,
          dueSource,
          status,
          completedAt,
          comment,
          updatedAt,
          updatedByUid: 'uid-admin',
        });
      }
    }
  }

  return records;
}

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    auditId: 'audit-001',
    action: 'CREATE_STUDENT',
    actorUid: 'uid-admin',
    actorEmail: 'admin@nittai.ac.jp',
    targetType: 'student',
    targetId: 'S001',
    details: { currentGrade: 'M2', enrollmentYear: 2025 },
    createdAt: '2026-04-01T09:10:00.000Z',
  },
  {
    auditId: 'audit-002',
    action: 'UPDATE_ACADEMIC_YEAR',
    actorUid: 'uid-admin',
    actorEmail: 'admin@nittai.ac.jp',
    targetType: 'academicYear',
    targetId: '2026',
    details: { updatedEventsCount: 6 },
    createdAt: '2026-04-05T10:00:00.000Z',
  },
];
