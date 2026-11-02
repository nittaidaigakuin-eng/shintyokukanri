/**
 * 学生画面（ホーム画面＋進捗一覧画面）
 * MASTER_SPEC.md #32〜#44 に完全準拠
 * - 現在の研究進捗率（現在学年のみ）
 * - 今の段階 / 次にやること（1件強調） / 次の期限＋残り日数 / 期限超過警告 / 直近予定(3〜5件) / カテゴリ別進捗
 * - 進捗更新（状態・個人目標日・コメント）、完了から別状態へ戻す際の確認ダイアログ表示
 * - M2学生の場合はM1履歴タブも閲覧可能
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  Filter,
  History,
  Save,
} from 'lucide-react';
import type {
  MasterGrade,
  ProgressRecord,
  ProgressStatus,
  RoadmapTask,
  Student,
} from '../../types/domain';
import { PROGRESS_STATUS_LABELS } from '../../types/domain';
import {
  calculateGradeProgressSummary,
  evaluateDeadlineState,
  resolveAppliedDueDate,
} from '../../lib/progressUtils';
import { DeadlineBadge, StatusBadge } from '../../components/Badges';

type StudentFilterType =
  | 'ALL'
  | 'INCOMPLETE'
  | 'IN_PROGRESS'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'COMPLETED';

interface StudentDashboardProps {
  student: Student;
  progressRecords: ProgressRecord[];
  roadmapTasks: RoadmapTask[];
  todayTokyo: string;
  onUpdateProgress: (
    progressId: string,
    updates: {
      status: ProgressStatus;
      personalTargetDate: string | null;
      comment: string;
    }
  ) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  progressRecords,
  roadmapTasks,
  todayTokyo,
  onUpdateProgress,
}) => {
  const [selectedGradeTab, setSelectedGradeTab] = useState<MasterGrade>(
    student.currentGrade
  );
  const [filter, setFilter] = useState<StudentFilterType>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<ProgressStatus>('NOT_STARTED');
  const [editPersonalDate, setEditPersonalDate] = useState<string>('');
  const [editComment, setEditComment] = useState<string>('');
  const [confirmRevertRecord, setConfirmRevertRecord] =
    useState<ProgressRecord | null>(null);

  const taskMap = useMemo(
    () => new Map(roadmapTasks.map((t) => [t.taskId, t])),
    [roadmapTasks]
  );

  // 現在学年の進捗サマリー (#38)
  const summary = useMemo(
    () =>
      calculateGradeProgressSummary(
        student.currentGrade,
        progressRecords,
        todayTokyo
      ),
    [student.currentGrade, progressRecords, todayTokyo]
  );

  const currentGradeRecords = useMemo(
    () =>
      progressRecords
        .filter((p) => p.historicalGrade === student.currentGrade)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [progressRecords, student.currentGrade]
  );

  // 期限超過タスク一覧
  const overdueRecords = useMemo(
    () =>
      currentGradeRecords.filter(
        (p) =>
          p.status !== 'COMPLETED' &&
          evaluateDeadlineState(p.status, p.appliedDueDate, todayTokyo).label ===
            '期限超過'
      ),
    [currentGradeRecords, todayTokyo]
  );

  // 次にやること（1件強調）：期限超過 > 進行中 > 未着手の順で最優先の1件を抽出 (#42)
  const nextActionRecord = useMemo(() => {
    const incomplete = currentGradeRecords.filter(
      (p) => p.status !== 'COMPLETED'
    );
    if (incomplete.length === 0) return null;

    if (overdueRecords.length > 0) {
      return overdueRecords[0];
    }
    const inProgress = incomplete.filter((p) => p.status === 'IN_PROGRESS');
    if (inProgress.length > 0) {
      return inProgress[0];
    }
    return incomplete[0];
  }, [currentGradeRecords, overdueRecords]);

  // 直近予定（3〜5件）(#42)
  const upcomingRecords = useMemo(() => {
    return currentGradeRecords
      .filter((p) => p.status !== 'COMPLETED')
      .sort((a, b) => {
        if (a.appliedDueDate && b.appliedDueDate) {
          return a.appliedDueDate.localeCompare(b.appliedDueDate);
        }
        if (a.appliedDueDate) return -1;
        if (b.appliedDueDate) return 1;
        return a.displayOrder - b.displayOrder;
      })
      .slice(0, 4);
  }, [currentGradeRecords]);

  // カテゴリ別進捗 (#42)
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const r of currentGradeRecords) {
      const entry = map.get(r.category) ?? { total: 0, completed: 0 };
      entry.total += 1;
      if (r.status === 'COMPLETED') entry.completed += 1;
      map.set(r.category, entry);
    }
    return Array.from(map.entries()).map(([category, counts]) => ({
      category,
      ...counts,
      pct:
        counts.total === 0
          ? 0
          : Math.round((counts.completed / counts.total) * 100),
    }));
  }, [currentGradeRecords]);

  // 表示対象学年タブのフィルタ済みリスト (#44)
  const displayedRecords = useMemo(() => {
    const base = progressRecords
      .filter((p) => p.historicalGrade === selectedGradeTab)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return base.filter((p) => {
      const state = evaluateDeadlineState(
        p.status,
        p.appliedDueDate,
        todayTokyo
      );
      switch (filter) {
        case 'INCOMPLETE':
          return p.status !== 'COMPLETED';
        case 'IN_PROGRESS':
          return p.status === 'IN_PROGRESS';
        case 'DUE_SOON':
          return state.label === 'まもなく' || state.label === '本日';
        case 'OVERDUE':
          return state.label === '期限超過';
        case 'COMPLETED':
          return p.status === 'COMPLETED';
        default:
          return true;
      }
    });
  }, [progressRecords, selectedGradeTab, filter, todayTokyo]);

  const startEdit = (record: ProgressRecord) => {
    setEditingId(record.progressId);
    setEditStatus(record.status);
    setEditPersonalDate(record.personalTargetDate ?? '');
    setEditComment(record.comment);
  };

  const handleSaveRow = (record: ProgressRecord) => {
    // #35 完了から別状態へ戻す場合、確認画面を表示し、completedAtをクリア
    if (record.status === 'COMPLETED' && editStatus !== 'COMPLETED') {
      setConfirmRevertRecord(record);
      return;
    }
    commitSave(record);
  };

  const commitSave = (record: ProgressRecord) => {
    onUpdateProgress(record.progressId, {
      status: editStatus,
      personalTargetDate: editPersonalDate.trim() || null,
      comment: editComment.trim(),
    });
    setEditingId(null);
    setConfirmRevertRecord(null);
  };

  const nextTaskMeta = nextActionRecord
    ? taskMap.get(nextActionRecord.taskId)
    : null;
  const nextDeadlineEval = nextActionRecord
    ? evaluateDeadlineState(
        nextActionRecord.status,
        nextActionRecord.appliedDueDate,
        todayTokyo
      )
    : null;

  return (
    <div className="space-y-6">
      {/* 1. 期限超過アラートバナー (#42) */}
      {overdueRecords.length > 0 && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-bold">
                期限を超過している研究タスクが {overdueRecords.length} 件あります
              </p>
              <p className="mt-0.5 text-xs text-red-700">
                最優先：「{overdueRecords[0].title}」（適用期限:{' '}
                {overdueRecords[0].appliedDueDate}）の状態更新または個人目標日の見直しを行ってください。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedGradeTab(student.currentGrade);
              setFilter('OVERDUE');
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            期限超過を確認
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. 学生ホーム：研究進捗率・今の段階・次にやること (#42) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* 現在の研究進捗率カード */}
        <div className=" rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-2.5 py-1 text-xs font-bold text-white">
              {student.currentGrade} 研究進捗率
            </span>
            <span className="text-xs text-slate-500">
              指導教員: {student.supervisor}
            </span>
          </div>

          <div className="mt-5 flex items-baseline justify-between">
            <div>
              <span className="text-4xl font-extrabold tracking-tight text-[#0B1F3A]">
                {summary.percentage}%
              </span>
              <span className="ml-2 text-xs font-medium text-slate-500">
                完了 ({summary.completedManagedTasks} /{' '}
                {summary.totalManagedTasks} 項目)
              </span>
            </div>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
              style={{ width: `${summary.percentage}%` }}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-xs text-slate-500">進行中</p>
              <p className="mt-0.5 text-lg font-bold text-blue-700">
                {summary.inProgressTasks}件
              </p>
            </div>
            <div className="rounded-xl bg-amber-50/70 p-2.5">
              <p className="text-xs text-amber-800">7日以内期限</p>
              <p className="mt-0.5 text-lg font-bold text-amber-700">
                {summary.dueWithin7DaysTasks}件
              </p>
            </div>
            <div className="rounded-xl bg-red-50/70 p-2.5">
              <p className="text-xs text-red-800">期限超過</p>
              <p className="mt-0.5 text-lg font-bold text-red-700">
                {summary.overdueTasks}件
              </p>
            </div>
          </div>
        </div>

        {/* 今の段階 & 次にやること（1件強調）カード */}
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/40 p-6 shadow-xs lg:col-span-7">
          {nextActionRecord && nextDeadlineEval ? (
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-[#2563EB]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
                      今の段階：{nextActionRecord.category}
                    </span>
                  </div>
                  <DeadlineBadge
                    label={nextDeadlineEval.label}
                    remainingDays={nextDeadlineEval.remainingDays}
                  />
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-500">
                    次にやること（最優先タスク）
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[#0B1F3A] sm:text-xl">
                    {nextActionRecord.title}
                  </h2>
                  {nextTaskMeta && (
                    <p className="mt-1.5 text-sm text-slate-600">
                      {nextTaskMeta.studentAction}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4">
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    次の期限:{' '}
                    <strong className="text-slate-900">
                      {nextActionRecord.appliedDueDate ?? '未設定（目標日を設定してください）'}
                    </strong>
                    {nextActionRecord.dueSource === 'PERSONAL' && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800">
                        個人目標日
                      </span>
                    )}
                    {nextActionRecord.dueSource === 'COMMON' && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        共通公式期限
                      </span>
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedGradeTab(student.currentGrade);
                    startEdit(nextActionRecord);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  このタスクを更新する
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="mt-2 text-base font-bold text-slate-800">
                現在学年のすべての研究タスクが完了しています
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. 直近予定 (3〜5件) & カテゴリ別進捗 (#42) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <h3 className="text-sm font-bold text-[#0B1F3A]">
            直近の予定・取り組むタスク（上位4件）
          </h3>
          <div className="mt-3 divide-y divide-slate-100">
            {upcomingRecords.map((item) => {
              const dl = evaluateDeadlineState(
                item.status,
                item.appliedDueDate,
                todayTokyo
              );
              return (
                <div
                  key={item.progressId}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">
                        {item.taskId}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900">
                      {item.title}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {item.appliedDueDate ?? '期限未設定'}
                    </span>
                    <DeadlineBadge
                      label={dl.label}
                      remainingDays={dl.remainingDays}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
          <h3 className="text-sm font-bold text-[#0B1F3A]">カテゴリ別進捗</h3>
          <div className="mt-3 space-y-3">
            {categoryBreakdown.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    {cat.category}
                  </span>
                  <span className="font-semibold text-slate-600">
                    {cat.completed}/{cat.total} ({cat.pct}%)
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 研究進捗一覧・更新セクション (#43, #44) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#0B1F3A]" />
            <h3 className="text-base font-bold text-[#0B1F3A]">
              研究ロードマップ進捗一覧
            </h3>
          </div>

          {/* M2学生の場合はM1過去履歴も切り替え閲覧可能 (#32, #33) */}
          <div className="flex flex-wrap items-center gap-2">
            {student.currentGrade === 'M2' && (
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setSelectedGradeTab('M2')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedGradeTab === 'M2'
                      ? 'bg-[#0B1F3A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  現在学年 (M2: 44件)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGradeTab('M1')}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedGradeTab === 'M1'
                      ? 'bg-[#0B1F3A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  M1履歴 (17件)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* フィルタバー (#44: すべて / 未完了 / 進行中 / 期限接近 / 期限超過 / 完了) */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            絞り込み:
          </span>
          {(
            [
              ['ALL', 'すべて'],
              ['INCOMPLETE', '未完了'],
              ['IN_PROGRESS', '進行中'],
              ['DUE_SOON', '期限接近'],
              ['OVERDUE', '期限超過'],
              ['COMPLETED', '完了'],
            ] as Array<[StudentFilterType, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                filter === key
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* タスク一覧（PC・スマホ両対応カード＆行リスト） */}
        <div className="mt-4 divide-y divide-slate-200">
          {displayedRecords.map((record) => {
            const task = taskMap.get(record.taskId);
            const isEditing = editingId === record.progressId;
            const dl = evaluateDeadlineState(
              record.status,
              record.appliedDueDate,
              todayTokyo
            );

            return (
              <div key={record.progressId} className="py-4">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {record.taskId}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {record.category}
                      </span>
                      <StatusBadge status={record.status} />
                      <DeadlineBadge
                        label={dl.label}
                        remainingDays={dl.remainingDays}
                      />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {record.title}
                    </h4>
                    {task && (
                      <p className="text-xs text-slate-500">
                        行動目安: {task.studentAction}（時期目安:{' '}
                        {task.guideline}）
                      </p>
                    )}
                    {record.comment && !isEditing && (
                      <p className="mt-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                        メモ: {record.comment}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">
                        適用期限:{' '}
                        <strong className="text-slate-800">
                          {record.appliedDueDate ?? '未設定'}
                        </strong>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        個人目標: {record.personalTargetDate ?? '未設定'} / 共通:{' '}
                        {record.commonDueDate ?? 'なし'}
                      </div>
                    </div>

                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(record)}
                        className="rounded-xl border border-blue-600 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        状態・目標日を更新
                      </button>
                    )}
                  </div>
                </div>

                {/* インライン編集フォーム (#43: 状態・個人目標日・コメント) */}
                {isEditing && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          進捗状態
                        </label>
                        <select
                          value={editStatus}
                          onChange={(e) =>
                            setEditStatus(e.target.value as ProgressStatus)
                          }
                          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                        >
                          {(
                            Object.keys(
                              PROGRESS_STATUS_LABELS
                            ) as ProgressStatus[]
                          ).map((st) => (
                            <option key={st} value={st}>
                              {PROGRESS_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          個人目標日（共通期限より優先されます）
                        </label>
                        <input
                          type="date"
                          value={editPersonalDate}
                          onChange={(e) => setEditPersonalDate(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        />
                        {record.commonDueDate && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            共通期限: {record.commonDueDate}（新適用期限:{' '}
                            {resolveAppliedDueDate(
                              editPersonalDate || null,
                              record.commonDueDate
                            ).appliedDueDate ?? '未設定'}
                            ）
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          コメント・進捗メモ（※患者等の個人情報は入力禁止）
                        </label>
                        <input
                          type="text"
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          placeholder="指導教員との相談状況や次回の予定など"
                          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveRow(record)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <Save className="h-3.5 w-3.5" />
                        保存する
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* #35 完了状態から別状態へ戻す際の確認ダイアログ */}
      {confirmRevertRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  完了状態を解除しますか？
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  「{confirmRevertRecord.title}」を完了から「
                  {PROGRESS_STATUS_LABELS[editStatus]}
                  」へ戻すと、記録されていた完了日（
                  {confirmRevertRecord.completedAt?.slice(0, 10) ?? '記録済'}
                  ）がクリアされます。よろしいですか？
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRevertRecord(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => commitSave(confirmRevertRecord)}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                完了日をクリアして変更する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
