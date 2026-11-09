/**
 * 学生画面（自分の進捗 / 研究室メンバーの進捗共有 / 研究プロセス記録タイムライン / 研究室スケジュール＆Googleカレンダー）
 * MASTER_SPEC.md および研究室追加要望（①学生間の進捗共有、③カレンダー・行事一元管理、④研究プロセスの記録・振り返り）に完全準拠
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  Filter,
  History,
  Info,
  Save,
  Users,
} from 'lucide-react';
import type {
  AcademicEvent,
  LabOperationConfig,
  MasterGrade,
  ProgressRecord,
  ProgressStatus,
  ResearchProcessLogEntry,
  RoadmapTask,
  Student,
} from '../../types/domain';
import {
  PROGRESS_STATUS_LABELS,
  SCHEDULE_EVENT_CATEGORY_LABELS,
} from '../../types/domain';
import {
  calculateGradeProgressSummary,
  evaluateDeadlineState,
  resolveAppliedDueDate,
} from '../../lib/progressUtils';
import { DeadlineBadge, StatusBadge } from '../../components/Badges';

type StudentTopSection =
  | 'MY_PROGRESS'
  | 'LAB_PEERS'
  | 'PROCESS_HISTORY'
  | 'LAB_SCHEDULE';

type StudentFilterType =
  | 'ALL'
  | 'INCOMPLETE'
  | 'IN_PROGRESS'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'COMPLETED';

interface StudentDashboardProps {
  student: Student;
  allStudents: Student[];
  allProgressRecords: ProgressRecord[];
  processLogs: ResearchProcessLogEntry[];
  roadmapTasks: RoadmapTask[];
  academicYear: number;
  academicEvents: AcademicEvent[];
  operationConfig: LabOperationConfig;
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
  allStudents,
  allProgressRecords,
  processLogs,
  roadmapTasks,
  academicYear,
  academicEvents,
  operationConfig,
  todayTokyo,
  onUpdateProgress,
}) => {
  const [topSection, setTopSection] =
    useState<StudentTopSection>('MY_PROGRESS');
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

  // ① 他学生進捗閲覧用ステート
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  // ④ 研究プロセス履歴フィルタ用
  const [processFilterStudentId, setProcessFilterStudentId] = useState<string>(
    student.studentId
  );

  // 自分自身の進捗レコード
  const myProgressRecords = useMemo(
    () =>
      allProgressRecords.filter((p) => p.studentId === student.studentId),
    [allProgressRecords, student.studentId]
  );

  const taskMap = useMemo(
    () => new Map(roadmapTasks.map((t) => [t.taskId, t])),
    [roadmapTasks]
  );

  // 現在学年の進捗サマリー (#38)
  const summary = useMemo(
    () =>
      calculateGradeProgressSummary(
        student.currentGrade,
        myProgressRecords,
        todayTokyo
      ),
    [student.currentGrade, myProgressRecords, todayTokyo]
  );

  const currentGradeRecords = useMemo(
    () =>
      myProgressRecords
        .filter((p) => p.historicalGrade === student.currentGrade)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [myProgressRecords, student.currentGrade]
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
    const base = myProgressRecords
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
  }, [myProgressRecords, selectedGradeTab, filter, todayTokyo]);

  // ① 研究室メンバー一覧の集計
  const peerSummaries = useMemo(() => {
    return allStudents
      .filter((s) => s.enrollmentStatus === '在籍')
      .map((peer) => {
        const peerProg = allProgressRecords.filter(
          (p) => p.studentId === peer.studentId
        );
        const peerSum = calculateGradeProgressSummary(
          peer.currentGrade,
          peerProg,
          todayTokyo
        );
        const activeTask =
          peerProg.find(
            (p) =>
              p.historicalGrade === peer.currentGrade &&
              p.status === 'IN_PROGRESS'
          ) ??
          peerProg.find(
            (p) =>
              p.historicalGrade === peer.currentGrade &&
              p.status !== 'COMPLETED'
          );
        return {
          peer,
          summary: peerSum,
          currentFocusTitle: activeTask?.title ?? '全項目完了',
          currentFocusCategory: activeTask?.category ?? '-',
          recentComment:
            peerProg
              .filter((p) => p.comment.trim().length > 0)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
              ?.comment ?? '',
        };
      });
  }, [allStudents, allProgressRecords, todayTokyo]);

  const selectedPeer = useMemo(
    () => allStudents.find((s) => s.studentId === selectedPeerId) ?? null,
    [allStudents, selectedPeerId]
  );

  const selectedPeerRecords = useMemo(() => {
    if (!selectedPeer) return [];
    return allProgressRecords
      .filter(
        (p) =>
          p.studentId === selectedPeer.studentId &&
          p.historicalGrade === selectedPeer.currentGrade
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [allProgressRecords, selectedPeer]);

  const filteredProcessLogs = useMemo(() => {
    if (processFilterStudentId === 'ALL') return processLogs;
    return processLogs.filter((l) => l.studentId === processFilterStudentId);
  }, [processLogs, processFilterStudentId]);

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
      {/* 学生画面トップナビゲーションタブ（①自分の進捗 / 研究室メンバーの進捗共有 / ④研究プロセス記録 / ③研究室スケジュール） */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTopSection('MY_PROGRESS')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              topSection === 'MY_PROGRESS'
                ? 'bg-[#0B1F3A] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            自分の研究進捗・更新
          </button>

          <button
            type="button"
            onClick={() => setTopSection('LAB_PEERS')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              topSection === 'LAB_PEERS'
                ? 'bg-[#0B1F3A] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            研究室メンバーの進捗状況 ({peerSummaries.length}名)
          </button>

          <button
            type="button"
            onClick={() => setTopSection('PROCESS_HISTORY')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              topSection === 'PROCESS_HISTORY'
                ? 'bg-[#0B1F3A] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            研究プロセスの記録・振り返り ({processLogs.length}件)
          </button>

          <button
            type="button"
            onClick={() => setTopSection('LAB_SCHEDULE')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              topSection === 'LAB_SCHEDULE'
                ? 'bg-[#0B1F3A] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            研究室スケジュール・行事 ({academicYear}年度)
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="h-3.5 w-3.5 text-blue-600" />
          <span>更新ルール: {operationConfig.updateTimingRule}</span>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: 自分の研究進捗・更新
         ===================================================================== */}
      {topSection === 'MY_PROGRESS' && (
        <>
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
                    期限を超過している研究タスクが {overdueRecords.length}{' '}
                    件あります
                  </p>
                  <p className="mt-0.5 text-xs text-red-700">
                    最優先：「{overdueRecords[0].title}」（適用期限:{' '}
                    {overdueRecords[0].appliedDueDate}
                    ）の状態更新または個人目標日の見直しを行ってください。
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
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
                          {nextActionRecord.appliedDueDate ??
                            '未設定（目標日を設定してください）'}
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
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                カテゴリ別進捗
              </h3>
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
                  自分の研究ロードマップ進捗一覧
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
                      現在学年 (M2)
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
                      M1履歴
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

            {/* タスク一覧 */}
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
                            研究経過メモ: {record.comment}
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
                            個人目標: {record.personalTargetDate ?? '未設定'} /
                            共通: {record.commonDueDate ?? 'なし'}
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
                              onChange={(e) =>
                                setEditPersonalDate(e.target.value)
                              }
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
                              研究経過メモ・コメント（※プロセス履歴にも自動記録されます）
                            </label>
                            <input
                              type="text"
                              value={editComment}
                              onChange={(e) => setEditComment(e.target.value)}
                              placeholder="実施内容や指導教員との相談メモ"
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
                            保存してプロセス記録に残す
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          SECTION 2: ① 研究室メンバーの進捗状況共有（学生間閲覧 Read-Only）
         ===================================================================== */}
      {topSection === 'LAB_PEERS' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">
                  研究室メンバーの進捗状況一覧（情報共有・閲覧専用）
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  同じ研究室に所属する学生間で、互いの研究段階・進捗率・直近の取り組み状況を共有できます（※他学生のデータを書き換えることはできません）。
                </p>
              </div>
              <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
                確認方法: {operationConfig.reviewMethodRule}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {peerSummaries.map((item) => {
                const isMe = item.peer.studentId === student.studentId;
                return (
                  <div
                    key={item.peer.studentId}
                    className={`rounded-2xl border p-5 transition ${
                      selectedPeerId === item.peer.studentId
                        ? 'border-blue-600 bg-blue-50/30'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#0B1F3A] px-2 py-0.5 text-xs font-bold text-white">
                          {item.peer.currentGrade}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {item.peer.name}
                        </h3>
                        {isMe && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                            あなた
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        最終更新: {item.peer.updatedAt.slice(0, 10)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-[#0B1F3A]">
                        {item.summary.percentage}%
                      </span>
                      <span className="text-xs text-slate-500">
                        完了 {item.summary.completedManagedTasks} /{' '}
                        {item.summary.totalManagedTasks} 項目（進行中:{' '}
                        {item.summary.inProgressTasks}件）
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#2563EB]"
                        style={{ width: `${item.summary.percentage}%` }}
                      />
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs">
                      <p className="font-semibold text-slate-500">
                        現在の重点段階 ({item.currentFocusCategory}):
                      </p>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {item.currentFocusTitle}
                      </p>
                      {item.recentComment && (
                        <p className="mt-1 text-slate-600">
                          最新メモ: 「{item.recentComment}」
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPeerId(
                            selectedPeerId === item.peer.studentId
                              ? null
                              : item.peer.studentId
                          )
                        }
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {selectedPeerId === item.peer.studentId
                          ? '詳細を閉じる'
                          : 'ロードマップ詳細を見る →'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedPeer && (
              <div className="mt-6 rounded-2xl border border-blue-200 bg-slate-50/70 p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-[#0B1F3A]">
                    {selectedPeer.name}（{selectedPeer.currentGrade}）のタスク進捗詳細（閲覧専用）
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedPeerId(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    閉じる
                  </button>
                </div>
                <div className="mt-3 max-h-96 divide-y divide-slate-200 overflow-y-auto text-xs">
                  {selectedPeerRecords.map((rec) => {
                    const dl = evaluateDeadlineState(
                      rec.status,
                      rec.appliedDueDate,
                      todayTokyo
                    );
                    return (
                      <div
                        key={rec.progressId}
                        className="flex flex-col justify-between gap-2 py-2.5 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-600">
                              {rec.taskId}
                            </span>
                            <StatusBadge status={rec.status} />
                            <span className="font-bold text-slate-900">
                              {rec.title}
                            </span>
                          </div>
                          {rec.comment && (
                            <p className="mt-0.5 text-slate-600">
                              メモ: {rec.comment}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">
                            目標/期限: {rec.appliedDueDate ?? '未設定'}
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
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 3: ④ 研究プロセスの記録・振り返りタイムライン
         ===================================================================== */}
      {topSection === 'PROCESS_HISTORY' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-[#0B1F3A]">
                研究プロセスの記録・振り返り（タイムライン履歴）
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                現在の進捗率だけでなく、「いつ・どのタスクを・どのように進めたか（試行錯誤やコメントの変遷）」が自動的に蓄積され、後から研究の歩みを振り返ることができます。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">
                表示対象:
              </label>
              <select
                value={processFilterStudentId}
                onChange={(e) => setProcessFilterStudentId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold"
              >
                <option value={student.studentId}>
                  自分の研究プロセス履歴のみ
                </option>
                <option value="ALL">研究室全員のプロセス履歴</option>
                {allStudents.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name} ({s.currentGrade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredProcessLogs.length === 0 ? (
            <p className="mt-6 py-10 text-center text-xs text-slate-500">
              まだ研究プロセスの更新記録がありません。「自分の研究進捗・更新」タブでタスクの状態やコメントを保存すると、ここに時系列で記録が蓄積されます。
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {filteredProcessLogs.map((log) => (
                <div
                  key={log.logId}
                  className="relative rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#0B1F3A] px-2 py-0.5 font-bold text-white">
                        {log.grade}
                      </span>
                      <span className="font-bold text-slate-900">
                        {log.recordedByName}
                      </span>
                      <span className="font-mono text-slate-500">
                        [{log.taskId}] {log.category}
                      </span>
                    </div>
                    <span className="text-slate-500">
                      {log.recordedAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>

                  <p className="mt-1.5 text-sm font-bold text-[#0B1F3A]">
                    {log.taskTitle}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">状態変更:</span>
                    <StatusBadge status={log.previousStatus} />
                    <span>→</span>
                    <StatusBadge status={log.newStatus} />
                    {log.personalTargetDate && (
                      <span className="ml-2 text-slate-600">
                        個人目標日: <strong>{log.personalTargetDate}</strong>
                      </span>
                    )}
                  </div>

                  {log.comment && (
                    <div className="mt-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-slate-800">
                      <strong>研究経過メモ:</strong> {log.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 4: ③ 研究室スケジュール・行事・Googleカレンダー一元確認
         ===================================================================== */}
      {topSection === 'LAB_SCHEDULE' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-[#0B1F3A]">
              {academicYear}年度 研究室スケジュール一覧（公式研究日程・授業・研究室行事）
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              研究に関する公式予定だけでなく、授業・ゼミや研究室全体の行事もGoogleカレンダーと双方向連携して一元管理されています。
            </p>

            <div className="mt-4 divide-y divide-slate-100 text-xs">
              {academicEvents.map((ev) => {
                const cat = ev.eventCategory ?? 'OFFICIAL';
                return (
                  <div
                    key={ev.eventKey}
                    className="flex flex-col justify-between gap-2 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 font-bold ${
                          cat === 'OFFICIAL'
                            ? 'bg-[#0B1F3A] text-white'
                            : cat === 'CLASS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {SCHEDULE_EVENT_CATEGORY_LABELS[cat]}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                        対象: {ev.target}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {ev.name}
                      </span>
                      {ev.notes && (
                        <span className="text-slate-500">（{ev.notes}）</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold text-[#0B1F3A]">
                        {ev.date ?? '日程調整中'} {ev.time ?? ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {operationConfig.googleCalendarId && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h3 className="mb-3 text-xs font-bold text-slate-700">
                  研究室 Googleカレンダー（{operationConfig.googleCalendarId}）
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <iframe
                    title="研究室Googleカレンダー"
                    src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
                      operationConfig.googleCalendarId
                    )}&ctz=Asia%2FTokyo`}
                    className="h-[500px] w-full border-0"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
