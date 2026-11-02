/**
 * 旧システム（Spreadsheet CSV/JSON）からのデータ移行検証ユーティリティ (#90〜#92)
 */

import type { ProgressRecord, RoadmapTask, Student } from '../../src/types/domain';
import { isValidDateString, resolveAppliedDueDate } from '../../src/lib/progressUtils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MigrationValidationResult {
  valid: boolean;
  errors: string[];
  stats: {
    m1TasksCount: number;
    m2TasksCount: number;
    totalTasksCount: number;
    studentsCount: number;
    progressCount: number;
  };
}

/**
 * #92 移行データの整合性検証
 * 1. M1 = 17, M2 = 44, 合計 = 61
 * 2. studentId 重複なし
 * 3. メール形式確認
 * 4. progress 件数・M1履歴 (historicalGrade) 確認
 * 5. 期限優先ロジック確認
 */
export function validateMigrationDataset(params: {
  roadmapTasks: RoadmapTask[];
  students: Student[];
  progress: ProgressRecord[];
}): MigrationValidationResult {
  const errors: string[] = [];
  const { roadmapTasks, students, progress } = params;

  const m1Tasks = roadmapTasks.filter((t) => t.grade === 'M1');
  const m2Tasks = roadmapTasks.filter((t) => t.grade === 'M2');

  if (m1Tasks.length !== 17) {
    errors.push(`M1ロードマップ件数が不正です: 期待値 17, 実際 ${m1Tasks.length}`);
  }
  if (m2Tasks.length !== 44) {
    errors.push(`M2ロードマップ件数が不正です: 期待値 44, 実際 ${m2Tasks.length}`);
  }
  if (roadmapTasks.length !== 61) {
    errors.push(`ロードマップ合計件数が不正です: 期待値 61, 実際 ${roadmapTasks.length}`);
  }

  const seenStudentIds = new Set<string>();
  const seenEmails = new Set<string>();

  for (const s of students) {
    if (!s.studentId) {
      errors.push('空の studentId が存在します');
    } else if (seenStudentIds.has(s.studentId)) {
      errors.push(`studentId の重複が検出されました: ${s.studentId}`);
    } else {
      seenStudentIds.add(s.studentId);
    }

    if (!EMAIL_REGEX.test(s.email)) {
      errors.push(`不正なメールアドレス形式 (${s.studentId}): ${s.email}`);
    } else if (seenEmails.has(s.email.toLowerCase())) {
      errors.push(`メールアドレスの重複が検出されました: ${s.email}`);
    } else {
      seenEmails.add(s.email.toLowerCase());
    }
  }

  const taskMap = new Map(roadmapTasks.map((t) => [t.taskId, t]));

  for (const p of progress) {
    const task = taskMap.get(p.taskId);
    if (!task) {
      errors.push(`未定義の taskId を参照する進捗が存在します: ${p.progressId}`);
      continue;
    }
    // #32 historicalGrade がタスク本来の学年と一致しているか検証
    if (p.historicalGrade !== task.grade) {
      errors.push(
        `historicalGrade 不整合 (${p.progressId}): タスク学年=${task.grade}, 進捗学年=${p.historicalGrade}`
      );
    }
    // #36 期限優先ロジックの整合性確認
    const expected = resolveAppliedDueDate(
      isValidDateString(p.personalTargetDate) ? p.personalTargetDate : null,
      isValidDateString(p.commonDueDate) ? p.commonDueDate : null
    );
    if (
      p.appliedDueDate !== expected.appliedDueDate ||
      p.dueSource !== expected.dueSource
    ) {
      errors.push(
        `適用期限ロジック不整合 (${p.progressId}): applied=${p.appliedDueDate} (期待値 ${expected.appliedDueDate}), source=${p.dueSource} (期待値 ${expected.dueSource})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      m1TasksCount: m1Tasks.length,
      m2TasksCount: m2Tasks.length,
      totalTasksCount: roadmapTasks.length,
      studentsCount: students.length,
      progressCount: progress.length,
    },
  };
}
