/**
 * 管理者画面（ダッシュボード・問題学生抽出・学生一覧・在籍状態変更・学生詳細・新規登録・年度別設定・ロードマップ追加/削除/編集・リマインド通知・監査ログ）
 * MASTER_SPEC.md #45〜#53, #57〜#71 に完全準拠
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Calendar,
  Clock,
  Cloud,
  Edit3,
  FileSpreadsheet,
  KeyRound,
  Mail,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import type {
  AcademicEvent,
  AcademicYear,
  AuditLog,
  DeadlineRule,
  DeadlineType,
  EnrollmentStatus,
  MasterGrade,
  ProgressRecord,
  ProgressStatus,
  RoadmapTask,
  Student,
  UserProfile,
} from '../../types/domain';
import { PROGRESS_STATUS_LABELS } from '../../types/domain';
import {
  buildNotificationId,
  calculateGradeProgressSummary,
  calculateRemainingDays,
  evaluateDeadlineState,
} from '../../lib/progressUtils';
import { SYSTEM_REMINDER_SENDER_EMAIL } from '../../data/demoSeed';
import { DeadlineBadge, StatusBadge } from '../../components/Badges';
import {
  getActiveFirebaseConfig,
  saveRuntimeFirebaseConfig,
} from '../../lib/firebase/syncStore';

type AdminSubTab =
  | 'OVERVIEW'
  | 'STUDENTS'
  | 'STUDENT_DETAIL'
  | 'ACADEMIC_YEAR'
  | 'ROADMAP'
  | 'NOTIFICATIONS'
  | 'AUDIT';

interface AdminDashboardProps {
  students: Student[];
  userProfiles: UserProfile[];
  progressRecords: ProgressRecord[];
  roadmapTasks: RoadmapTask[];
  academicYearsMap: Record<number, AcademicYear>;
  selectedAcademicYear: number;
  auditLogs: AuditLog[];
  todayTokyo: string;
  isCloudConnected: boolean;
  onSelectAcademicYear: (year: number) => void;
  onAddAcademicYear: (year: number) => void;
  onCreateStudent: (input: {
    studentId: string;
    name: string;
    email: string;
    currentGrade: MasterGrade;
    enrollmentYear: number;
    supervisor: string;
    enrollmentStatus: EnrollmentStatus;
    notificationEnabled: boolean;
    initialPassword: string;
    isAdminAlso: boolean;
  }) => Promise<string | null>;
  onUpdateStudentMeta: (
    studentId: string,
    updates: Partial<
      Pick<
        Student,
        | 'enrollmentStatus'
        | 'currentGrade'
        | 'supervisor'
        | 'name'
        | 'notificationEnabled'
        | 'notes'
      >
    >
  ) => void;
  onPromoteToM2: (studentId: string) => void;
  onToggleAccountActive: (studentId: string, active: boolean) => void;
  onResetPassword: (studentId: string, tempPassword: string) => Promise<void>;
  onAdminUpdateProgress: (
    progressId: string,
    updates: {
      status: ProgressStatus;
      personalTargetDate: string | null;
      comment: string;
    }
  ) => void;
  onUpdateAcademicEvent: (
    year: number,
    eventKey: string,
    updates: Partial<AcademicEvent>
  ) => void;
  onAddRoadmapTask: (input: {
    grade: MasterGrade;
    category: string;
    title: string;
    studentAction: string;
    guideline: string;
    deadlineType: DeadlineType;
    baseEventKey: string | null;
    offsetDays: number | null;
    deadlineRule: DeadlineRule;
  }) => void;
  onUpdateRoadmapTask: (taskId: string, updates: Partial<RoadmapTask>) => void;
  onDeleteRoadmapTask: (taskId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  userProfiles,
  progressRecords,
  roadmapTasks,
  academicYearsMap,
  selectedAcademicYear,
  auditLogs,
  todayTokyo,
  isCloudConnected,
  onSelectAcademicYear,
  onAddAcademicYear,
  onCreateStudent,
  onUpdateStudentMeta,
  onPromoteToM2,
  onToggleAccountActive,
  onResetPassword,
  onAdminUpdateProgress,
  onUpdateAcademicEvent,
  onAddRoadmapTask,
  onUpdateRoadmapTask,
  onDeleteRoadmapTask,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('OVERVIEW');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );

  // 学生一覧フィルタ・検索 (#48)
  const [gradeFilter, setGradeFilter] = useState<'ALL' | MasterGrade>('ALL');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EnrollmentStatus>(
    'ALL'
  );
  const [alertFilter, setAlertFilter] = useState<
    'ALL' | 'OVERDUE' | 'DUE_SOON' | 'NO_TARGET' | 'STALE'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 新規学生作成モーダル (#50)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState('S001');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGrade, setNewGrade] = useState<MasterGrade>('M1');
  const [newEnrollmentYear, setNewEnrollmentYear] =
    useState(selectedAcademicYear);
  const [newSupervisor, setNewSupervisor] = useState('');
  const [newEnrollmentStatus, setNewEnrollmentStatus] =
    useState<EnrollmentStatus>('在籍');
  const [newNotificationEnabled, setNewNotificationEnabled] = useState(true);
  const [newInitialPassword, setNewInitialPassword] = useState('');
  const [newIsAdminAlso, setNewIsAdminAlso] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 年度追加用
  const [newYearInput, setNewYearInput] = useState<number>(
    selectedAcademicYear + 1
  );

  // タスク追加・編集モーダル用
  const [roadmapGradeFilter, setRoadmapGradeFilter] = useState<
    'ALL' | MasterGrade
  >('ALL');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskGrade, setTaskGrade] = useState<MasterGrade>('M1');
  const [taskCategory, setTaskCategory] = useState('01_研究計画');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAction, setTaskAction] = useState('');
  const [taskGuideline, setTaskGuideline] = useState('随時');
  const [taskDeadlineType, setTaskDeadlineType] =
    useState<DeadlineType>('PERSONAL');
  const [taskBaseEventKey, setTaskBaseEventKey] = useState<string>('');
  const [taskOffsetDays, setTaskOffsetDays] = useState<number>(0);
  const [taskDeadlineRule, setTaskDeadlineRule] =
    useState<DeadlineRule>('MANUAL');

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskCategory, setEditTaskCategory] = useState('');
  const [editTaskAction, setEditTaskAction] = useState('');
  const [editTaskGuideline, setEditTaskGuideline] = useState('');

  // Firebaseクラウド接続モーダル用
  const [showCloudModal, setShowCloudModal] = useState(false);
  const existingCfg = getActiveFirebaseConfig();
  const [fbApiKey, setFbApiKey] = useState(existingCfg?.apiKey ?? '');
  const [fbProjectId, setFbProjectId] = useState(existingCfg?.projectId ?? '');
  const [fbAuthDomain, setFbAuthDomain] = useState(
    existingCfg?.authDomain ?? ''
  );

  // パスワードリセットモーダル (#53)
  const [resetTargetStudentId, setResetTargetStudentId] = useState<
    string | null
  >(null);
  const [tempPassword, setTempPassword] = useState('');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const availableYears = useMemo(
    () =>
      Object.keys(academicYearsMap)
        .map(Number)
        .sort((a, b) => a - b),
    [academicYearsMap]
  );

  const currentYearObj =
    academicYearsMap[selectedAcademicYear] ??
    Object.values(academicYearsMap)[0];
  const academicEvents = useMemo(
    () => currentYearObj?.events ?? [],
    [currentYearObj]
  );

  const activeRoadmapTasks = useMemo(
    () =>
      roadmapTasks
        .filter((t) => t.active)
        .sort((a, b) => {
          if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
          return a.displayOrder - b.displayOrder;
        }),
    [roadmapTasks]
  );

  const m1TaskCount = useMemo(
    () => activeRoadmapTasks.filter((t) => t.grade === 'M1').length,
    [activeRoadmapTasks]
  );
  const m2TaskCount = useMemo(
    () => activeRoadmapTasks.filter((t) => t.grade === 'M2').length,
    [activeRoadmapTasks]
  );

  // 学生ごとの集計メトリクス計算 (#45, #46, #47)
  const studentAnalytics = useMemo(() => {
    return students.map((student) => {
      const studentProg = progressRecords.filter(
        (p) => p.studentId === student.studentId
      );
      const summary = calculateGradeProgressSummary(
        student.currentGrade,
        studentProg,
        todayTokyo
      );

      const currentGradeIncomplete = studentProg
        .filter(
          (p) =>
            p.historicalGrade === student.currentGrade &&
            p.status !== 'COMPLETED'
        )
        .sort((a, b) => {
          if (a.appliedDueDate && b.appliedDueDate) {
            return a.appliedDueDate.localeCompare(b.appliedDueDate);
          }
          if (a.appliedDueDate) return -1;
          if (b.appliedDueDate) return 1;
          return a.displayOrder - b.displayOrder;
        });

      const nextDueRecord = currentGradeIncomplete.find(
        (p) => p.appliedDueDate !== null
      );

      // 長期間更新なし判定（最終更新から30日以上経過）
      const lastUpdatedDateStr = student.updatedAt.slice(0, 10);
      const daysSinceUpdate =
        calculateRemainingDays(todayTokyo, lastUpdatedDateStr) ?? 0;
      const isStale =
        student.enrollmentStatus === '在籍' && daysSinceUpdate >= 30;

      // 個人目標日未設定（現在学年の未完了タスクのうち、適用期限がないものが3件以上）
      const hasMissingTarget =
        student.enrollmentStatus === '在籍' &&
        summary.unconfiguredPersonalTargetTasks >= 3;

      const profile = userProfiles.find(
        (u) => u.studentId === student.studentId
      );

      return {
        student,
        profile,
        summary,
        nextDueDate: nextDueRecord?.appliedDueDate ?? null,
        nextDueTitle: nextDueRecord?.title ?? null,
        daysSinceUpdate,
        isStale,
        hasMissingTarget,
        hasOverdue:
          student.enrollmentStatus === '在籍' && summary.overdueTasks > 0,
        hasDueSoon:
          student.enrollmentStatus === '在籍' &&
          summary.dueWithin7DaysTasks > 0,
      };
    });
  }, [students, userProfiles, progressRecords, todayTokyo]);

  // 管理者ダッシュボードKPI集計 (#46)
  const kpiCounts = useMemo(() => {
    const overdueStudents = studentAnalytics.filter((s) => s.hasOverdue);
    const dueSoonStudents = studentAnalytics.filter((s) => s.hasDueSoon);
    const missingTargetStudents = studentAnalytics.filter(
      (s) => s.hasMissingTarget
    );
    const staleStudents = studentAnalytics.filter((s) => s.isStale);

    const m1List = studentAnalytics.filter(
      (s) =>
        s.student.currentGrade === 'M1' &&
        s.student.enrollmentStatus === '在籍'
    );
    const m2List = studentAnalytics.filter(
      (s) =>
        s.student.currentGrade === 'M2' &&
        s.student.enrollmentStatus === '在籍'
    );

    const m1Avg =
      m1List.length === 0
        ? 0
        : Math.round(
            m1List.reduce((acc, cur) => acc + cur.summary.percentage, 0) /
              m1List.length
          );
    const m2Avg =
      m2List.length === 0
        ? 0
        : Math.round(
            m2List.reduce((acc, cur) => acc + cur.summary.percentage, 0) /
              m2List.length
          );

    return {
      overdueStudents,
      dueSoonStudents,
      missingTargetStudents,
      staleStudents,
      m1Avg,
      m2Avg,
      m1Count: m1List.length,
      m2Count: m2List.length,
    };
  }, [studentAnalytics]);

  // 問題のある学生（要フォロー学生）を優先度順で抽出 (#45)
  const attentionNeededStudents = useMemo(() => {
    return studentAnalytics
      .filter(
        (s) =>
          s.hasOverdue || s.hasDueSoon || s.hasMissingTarget || s.isStale
      )
      .sort((a, b) => {
        if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
        if (a.hasDueSoon !== b.hasDueSoon) return a.hasDueSoon ? -1 : 1;
        return b.daysSinceUpdate - a.daysSinceUpdate;
      });
  }, [studentAnalytics]);

  const supervisors = useMemo(
    () =>
      Array.from(
        new Set(students.map((s) => s.supervisor).filter((v) => v.length > 0))
      ),
    [students]
  );

  // フィルタ済み学生一覧 (#47, #48)
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studentAnalytics.filter((item) => {
      const { student } = item;
      if (gradeFilter !== 'ALL' && student.currentGrade !== gradeFilter)
        return false;
      if (
        supervisorFilter !== 'ALL' &&
        student.supervisor !== supervisorFilter
      )
        return false;
      if (
        statusFilter !== 'ALL' &&
        student.enrollmentStatus !== statusFilter
      )
        return false;
      if (alertFilter === 'OVERDUE' && !item.hasOverdue) return false;
      if (alertFilter === 'DUE_SOON' && !item.hasDueSoon) return false;
      if (alertFilter === 'NO_TARGET' && !item.hasMissingTarget) return false;
      if (alertFilter === 'STALE' && !item.isStale) return false;

      if (q) {
        const hit =
          student.name.toLowerCase().includes(q) ||
          student.studentId.toLowerCase().includes(q) ||
          student.email.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    studentAnalytics,
    gradeFilter,
    supervisorFilter,
    statusFilter,
    alertFilter,
    searchQuery,
  ]);

  // 学生別リマインド通知プレビュー計算 (#57〜#62)
  const studentNotificationQueue = useMemo(() => {
    const taskMap = new Map(activeRoadmapTasks.map((t) => [t.taskId, t]));
    const items: Array<{
      notificationId: string;
      student: Student;
      record: ProgressRecord;
      remainingDays: number;
      isTriggerDay: boolean;
    }> = [];

    for (const student of students) {
      if (
        student.enrollmentStatus !== '在籍' ||
        !student.notificationEnabled
      ) {
        continue;
      }
      const studentProgs = progressRecords.filter(
        (p) =>
          p.studentId === student.studentId &&
          p.historicalGrade === student.currentGrade &&
          p.status !== 'COMPLETED' &&
          p.appliedDueDate !== null
      );

      for (const rec of studentProgs) {
        const rem = calculateRemainingDays(rec.appliedDueDate, todayTokyo);
        if (rem === null) continue;
        const task = taskMap.get(rec.taskId);
        const pattern = task?.reminderPattern ?? [14, 7, 3, 0];
        const isTriggerDay = pattern.includes(rem);
        if (rem <= 14) {
          items.push({
            notificationId: buildNotificationId(
              student.studentId,
              rec.taskId,
              rec.appliedDueDate!,
              rem
            ),
            student,
            record: rec,
            remainingDays: rem,
            isTriggerDay,
          });
        }
      }
    }
    return items.sort((a, b) => a.remainingDays - b.remainingDays);
  }, [students, progressRecords, activeRoadmapTasks, todayTokyo]);

  const openStudentDetail = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSubTab('STUDENT_DETAIL');
  };

  const openCreateModalWithNextId = () => {
    const nextNum = students.length + 1;
    setNewStudentId(`S${String(nextNum).padStart(3, '0')}`);
    setNewEnrollmentYear(selectedAcademicYear);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const err = await onCreateStudent({
      studentId: newStudentId.trim(),
      name: newName.trim(),
      email: newEmail.trim(),
      currentGrade: newGrade,
      enrollmentYear: newEnrollmentYear,
      supervisor: newSupervisor.trim() || '未設定',
      enrollmentStatus: newEnrollmentStatus,
      notificationEnabled: newNotificationEnabled,
      initialPassword: newInitialPassword,
      isAdminAlso: newIsAdminAlso,
    });
    if (err) {
      setCreateError(err);
      return;
    }
    setShowCreateModal(false);
    setBannerMessage(
      `学生「${newName} (${newStudentId})」を登録し、${newGrade}用ロードマップ進捗を初期生成しました。`
    );
    setNewName('');
    setNewEmail('');
    setNewInitialPassword('');
  };

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddRoadmapTask({
      grade: taskGrade,
      category: taskCategory.trim() || 'その他',
      title: taskTitle.trim(),
      studentAction: taskAction.trim() || taskTitle.trim(),
      guideline: taskGuideline.trim() || '随時',
      deadlineType: taskDeadlineType,
      baseEventKey:
        taskDeadlineType === 'COMMON_EVENT' && taskBaseEventKey
          ? taskBaseEventKey
          : null,
      offsetDays:
        taskDeadlineType === 'COMMON_EVENT' ? Number(taskOffsetDays) : null,
      deadlineRule:
        taskDeadlineType === 'COMMON_EVENT' ? taskDeadlineRule : 'MANUAL',
    });
    setShowAddTaskModal(false);
    setBannerMessage(
      `${taskGrade}ロードマップに新規タスク「${taskTitle}」を追加し、該当学年の学生進捗リストへ反映しました。`
    );
    setTaskTitle('');
    setTaskAction('');
  };

  const startEditTask = (t: RoadmapTask) => {
    setEditingTaskId(t.taskId);
    setEditTaskTitle(t.title);
    setEditTaskCategory(t.category);
    setEditTaskAction(t.studentAction);
    setEditTaskGuideline(t.guideline);
  };

  const saveEditTask = (taskId: string) => {
    onUpdateRoadmapTask(taskId, {
      title: editTaskTitle.trim(),
      category: editTaskCategory.trim(),
      studentAction: editTaskAction.trim(),
      guideline: editTaskGuideline.trim(),
    });
    setEditingTaskId(null);
    setBannerMessage(
      `タスク (${taskId}) の内容を更新し、全学生の進捗表示へ反映しました。`
    );
  };

  const selectedDetail = useMemo(
    () =>
      studentAnalytics.find(
        (s) => s.student.studentId === selectedStudentId
      ) ?? null,
    [studentAnalytics, selectedStudentId]
  );

  const displayedRoadmapTasks = useMemo(
    () =>
      activeRoadmapTasks.filter(
        (t) => roadmapGradeFilter === 'ALL' || t.grade === roadmapGradeFilter
      ),
    [activeRoadmapTasks, roadmapGradeFilter]
  );

  return (
    <div className="space-y-6">
      {/* 管理者サブナビゲーション */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['OVERVIEW', '要対応・ダッシュボード'],
              ['STUDENTS', `学生一覧 (${students.length}名)`],
              ['ACADEMIC_YEAR', `年度別設定 (${selectedAcademicYear}年度)`],
              [
                'ROADMAP',
                `ロードマップ管理 (${activeRoadmapTasks.length}件)`,
              ],
              ['NOTIFICATIONS', '通知・リマインド設定'],
              ['AUDIT', '監査ログ'],
            ] as Array<[AdminSubTab, string]>
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setSubTab(tabKey)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                subTab === tabKey ||
                (subTab === 'STUDENT_DETAIL' && tabKey === 'STUDENTS')
                  ? 'bg-[#0B1F3A] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCloudModal(true)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
              isCloudConnected
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
            {isCloudConnected
              ? 'Firebaseクラウド同期中'
              : '同一端末保存モード（クラウド接続設定）'}
          </button>

          <button
            type="button"
            onClick={openCreateModalWithNextId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            新規学生登録
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold text-green-800">
          <span>{bannerMessage}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-green-700 underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB 1: 管理者ダッシュボード（問題のある学生を最優先表示 #45, #46）
         ===================================================================== */}
      {subTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* 主要4指標カード */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                setAlertFilter('OVERDUE');
                setSubTab('STUDENTS');
              }}
              className="flex items-start justify-between rounded-2xl border border-red-200 bg-white p-5 text-left shadow-xs transition hover:border-red-400"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  期限超過の学生
                </span>
                <p className="mt-2 text-3xl font-extrabold text-red-700">
                  {kpiCounts.overdueStudents.length}
                  <span className="ml-1 text-sm font-medium text-slate-500">
                    名
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  最優先で状況確認が必要
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-red-500" />
            </button>

            <button
              type="button"
              onClick={() => {
                setAlertFilter('DUE_SOON');
                setSubTab('STUDENTS');
              }}
              className="flex items-start justify-between rounded-2xl border border-amber-200 bg-white p-5 text-left shadow-xs transition hover:border-amber-400"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <Clock className="h-4 w-4" />
                  7日以内の期限到来
                </span>
                <p className="mt-2 text-3xl font-extrabold text-amber-700">
                  {kpiCounts.dueSoonStudents.length}
                  <span className="ml-1 text-sm font-medium text-slate-500">
                    名
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  直近提出・発表対象
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-amber-600" />
            </button>

            <button
              type="button"
              onClick={() => {
                setAlertFilter('NO_TARGET');
                setSubTab('STUDENTS');
              }}
              className="flex items-start justify-between rounded-2xl border border-blue-200 bg-white p-5 text-left shadow-xs transition hover:border-blue-400"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-800">
                  <Calendar className="h-4 w-4" />
                  個人目標日未設定
                </span>
                <p className="mt-2 text-3xl font-extrabold text-[#0B1F3A]">
                  {kpiCounts.missingTargetStudents.length}
                  <span className="ml-1 text-sm font-medium text-slate-500">
                    名
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  M1研究計画等の目標日未入力
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-blue-600" />
            </button>

            <button
              type="button"
              onClick={() => {
                setAlertFilter('STALE');
                setSubTab('STUDENTS');
              }}
              className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition hover:border-slate-400"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  長期間更新なし (30日+)
                </span>
                <p className="mt-2 text-3xl font-extrabold text-[#0B1F3A]">
                  {kpiCounts.staleStudents.length}
                  <span className="ml-1 text-sm font-medium text-slate-500">
                    名
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  進捗停滞フォロー対象
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* 要フォロー学生リスト（最優先表示 #45） */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">
                  今フォロー・対応が必要な学生（優先順）
                </h2>
                <p className="text-xs text-slate-500">
                  期限超過・7日以内期限・個人目標日未設定・30日以上更新がない学生を自動抽出しています
                </p>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-bold text-slate-700">
                  まだ学生が登録されていません
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  右上の「新規学生登録」ボタンから学生アカウントを作成してください。
                </p>
                <button
                  type="button"
                  onClick={openCreateModalWithNextId}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <UserPlus className="h-4 w-4" />
                  最初の学生を登録する
                </button>
              </div>
            ) : attentionNeededStudents.length === 0 ? (
              <p className="mt-4 py-6 text-center text-xs text-slate-500">
                現在、期限超過や長期未更新などの要対応学生はいません。
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {attentionNeededStudents.map((item) => (
                  <div
                    key={item.student.studentId}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#0B1F3A] px-2 py-0.5 text-xs font-bold text-white">
                          {item.student.currentGrade}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {item.student.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({item.student.studentId} / {item.student.supervisor})
                        </span>
                        {item.hasOverdue && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            期限超過 {item.summary.overdueTasks}件
                          </span>
                        )}
                        {item.hasDueSoon && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            <Clock className="h-3 w-3" />
                            7日以内期限 {item.summary.dueWithin7DaysTasks}件
                          </span>
                        )}
                        {item.hasMissingTarget && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            個人目標日未設定 (
                            {item.summary.unconfiguredPersonalTargetTasks}件)
                          </span>
                        )}
                        {item.isStale && (
                          <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {item.daysSinceUpdate}日間更新なし
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        現在進捗率: <strong>{item.summary.percentage}%</strong>{' '}
                        / 次の期限: {item.nextDueDate ?? '未設定'}{' '}
                        {item.nextDueTitle ? `（${item.nextDueTitle}）` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openStudentDetail(item.student.studentId)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
                    >
                      詳細・進捗確認
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 学年別進捗 & 次の公式イベント (#46) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-5">
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                学年別平均研究進捗率（在籍学生）
              </h3>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>
                      M1（{kpiCounts.m1Count}名 / {m1TaskCount}項目基準）
                    </span>
                    <span>{kpiCounts.m1Avg}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#2563EB]"
                      style={{ width: `${kpiCounts.m1Avg}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>
                      M2（{kpiCounts.m2Count}名 / {m2TaskCount}項目基準）
                    </span>
                    <span>{kpiCounts.m2Avg}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#0B1F3A]"
                      style={{ width: `${kpiCounts.m2Avg}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#0B1F3A]">
                    {selectedAcademicYear}年度 公式イベント（Source of Truth）
                  </h3>
                  <select
                    value={selectedAcademicYear}
                    onChange={(e) =>
                      onSelectAcademicYear(Number(e.target.value))
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}年度
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab('ACADEMIC_YEAR')}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  年度別日程を編集 →
                </button>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {academicEvents.map((ev) => (
                  <div
                    key={ev.eventKey}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                        {ev.target}
                      </span>
                      <span className="font-medium text-slate-900">
                        {ev.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-800">
                        {ev.date ?? '未定'} {ev.time ?? ''}
                      </span>
                      {ev.calendarDisplay && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          Calendar同期対象
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: 学生一覧・在籍状態変更・フィルタ・検索 (#23, #47, #48)
         ===================================================================== */}
      {subTab === 'STUDENTS' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#0B1F3A]" />
              <h2 className="text-base font-bold text-[#0B1F3A]">
                学生一覧（{filteredStudents.length}名）
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="氏名・studentId・メール検索"
                  className="rounded-xl border border-slate-300 py-1.5 pl-8 pr-3 text-xs"
                />
              </div>

              <select
                value={gradeFilter}
                onChange={(e) =>
                  setGradeFilter(e.target.value as 'ALL' | MasterGrade)
                }
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="ALL">全学年</option>
                <option value="M1">M1</option>
                <option value="M2">M2</option>
              </select>

              <select
                value={supervisorFilter}
                onChange={(e) => setSupervisorFilter(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="ALL">全指導教員</option>
                {supervisors.map((sup) => (
                  <option key={sup} value={sup}>
                    {sup}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'ALL' | EnrollmentStatus)
                }
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="ALL">全在籍状態（在籍・休学・修了・退学）</option>
                <option value="在籍">在籍のみ</option>
                <option value="休学">休学のみ</option>
                <option value="修了">修了のみ</option>
                <option value="退学">退学のみ</option>
              </select>

              <select
                value={alertFilter}
                onChange={(e) =>
                  setAlertFilter(
                    e.target.value as
                      | 'ALL'
                      | 'OVERDUE'
                      | 'DUE_SOON'
                      | 'NO_TARGET'
                      | 'STALE'
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
              >
                <option value="ALL">全期限状態</option>
                <option value="OVERDUE">期限超過あり</option>
                <option value="DUE_SOON">7日以内期限あり</option>
                <option value="NO_TARGET">個人目標日未設定</option>
                <option value="STALE">長期未更新 (30日+)</option>
              </select>
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              該当する学生がいません。右上の「新規学生登録」から追加してください。
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 font-bold text-slate-600">
                    <th className="px-3 py-3">氏名 / ID / 通知先メール</th>
                    <th className="px-3 py-3">学年</th>
                    <th className="px-3 py-3">在籍状態（変更可）</th>
                    <th className="px-3 py-3">進捗率</th>
                    <th className="px-3 py-3">次の期限</th>
                    <th className="px-3 py-3">期限超過数</th>
                    <th className="px-3 py-3">最終更新</th>
                    <th className="px-3 py-3">指導教員</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((item) => {
                    const { student, summary } = item;
                    return (
                      <tr
                        key={student.studentId}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-3.5">
                          <div className="font-bold text-slate-900">
                            {student.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {student.studentId} / {student.email}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="rounded bg-[#0B1F3A] px-2 py-0.5 font-bold text-white">
                            {student.currentGrade}
                          </span>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {student.enrollmentYear}年度入学
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          {/* 在籍・休学・修了・退学を一覧上でいつでも変更可能 */}
                          <select
                            value={student.enrollmentStatus}
                            onChange={(e) => {
                              const nextStatus = e.target
                                .value as EnrollmentStatus;
                              onUpdateStudentMeta(student.studentId, {
                                enrollmentStatus: nextStatus,
                              });
                              setBannerMessage(
                                `${student.name} の在籍状態を「${nextStatus}」に変更しました。`
                              );
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                          >
                            <option value="在籍">在籍</option>
                            <option value="休学">休学</option>
                            <option value="修了">修了</option>
                            <option value="退学">退学</option>
                          </select>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="font-bold text-slate-900">
                            {summary.percentage}% (
                            {summary.completedManagedTasks}/
                            {summary.totalManagedTasks})
                          </div>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#2563EB]"
                              style={{ width: `${summary.percentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          {item.nextDueDate ? (
                            <div>
                              <div className="font-semibold text-slate-800">
                                {item.nextDueDate}
                              </div>
                              <div className="max-w-44 truncate text-[11px] text-slate-500">
                                {item.nextDueTitle}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">未設定</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          {summary.overdueTasks > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 font-bold text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {summary.overdueTasks}件
                            </span>
                          ) : (
                            <span className="text-slate-500">0件</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-slate-600">
                          {student.updatedAt.slice(0, 16).replace('T', ' ')}
                        </td>
                        <td className="px-3 py-3.5 text-slate-700">
                          {student.supervisor}
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => openStudentDetail(student.studentId)}
                            className="rounded-lg border border-blue-600 px-3 py-1.5 font-semibold text-blue-600 hover:bg-blue-50"
                          >
                            詳細・進捗編集
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: 学生詳細（在籍状態変更・M1/M2進捗・M1→M2進級・PWリセット・無効化 #49, #52, #53）
         ===================================================================== */}
      {subTab === 'STUDENT_DETAIL' && selectedDetail && (
        <StudentDetailPanel
          detail={selectedDetail}
          progressRecords={progressRecords.filter(
            (p) => p.studentId === selectedDetail.student.studentId
          )}
          todayTokyo={todayTokyo}
          onBack={() => setSubTab('STUDENTS')}
          onUpdateStudentMeta={(updates) => {
            onUpdateStudentMeta(selectedDetail.student.studentId, updates);
            setBannerMessage(
              `${selectedDetail.student.name} の学生情報を更新しました。`
            );
          }}
          onPromoteToM2={() => {
            onPromoteToM2(selectedDetail.student.studentId);
            setBannerMessage(
              `${selectedDetail.student.name} を M1 → M2 へ進級しました（M1履歴は保持されたまま、M2用タスクが生成されました）。`
            );
          }}
          onToggleActive={(active) => {
            onToggleAccountActive(selectedDetail.student.studentId, active);
            setBannerMessage(
              `${selectedDetail.student.name} のアカウント状態を「${
                active ? '有効' : '利用停止'
              }」に更新しました。`
            );
          }}
          onOpenResetModal={() =>
            setResetTargetStudentId(selectedDetail.student.studentId)
          }
          onAdminUpdateProgress={onAdminUpdateProgress}
        />
      )}

      {/* =====================================================================
          TAB 4: 年度別設定（年度切替・新規年度追加・共通公式予定更新 #29, #30, #63〜#68）
         ===================================================================== */}
      {subTab === 'ACADEMIC_YEAR' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-base font-bold text-[#0B1F3A]">
                年度別 公式イベント設定（共通期限・Google Calendar Source of Truth）
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                年度ごとに公式イベント日程を管理できます。日程を更新すると、現在対象となるロードマップタスクの共通期限（直前月曜ルール含む）が自動再計算されます。
              </p>
            </div>

            {/* 年度切り替え・新規年度作成バー */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-bold text-slate-700">
                対象年度:
              </label>
              <select
                value={selectedAcademicYear}
                onChange={(e) => onSelectAcademicYear(Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#0B1F3A]"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}年度
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    onAddAcademicYear(newYearInput);
                    setBannerMessage(
                      `${newYearInput}年度の公式イベント設定を作成し、切り替えました。`
                    );
                    setNewYearInput(newYearInput + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  年度を追加
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-200">
            {academicEvents.map((ev) => (
              <div
                key={ev.eventKey}
                className="grid grid-cols-1 items-center gap-3 py-4 sm:grid-cols-12"
              >
                <div className="sm:col-span-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#0B1F3A] px-2 py-0.5 text-xs font-bold text-white">
                      {ev.target}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {ev.eventKey}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {ev.name}
                  </p>
                  <p className="text-xs text-slate-500">{ev.notes}</p>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    {selectedAcademicYear}年度 公式日付
                  </label>
                  <input
                    type="date"
                    value={ev.date ?? ''}
                    onChange={(e) =>
                      onUpdateAcademicEvent(selectedAcademicYear, ev.eventKey, {
                        date: e.target.value || null,
                      })
                    }
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    時刻
                  </label>
                  <input
                    type="time"
                    value={ev.time ?? ''}
                    onChange={(e) =>
                      onUpdateAcademicEvent(selectedAcademicYear, ev.eventKey, {
                        time: e.target.value || null,
                      })
                    }
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={ev.calendarDisplay}
                      onChange={(e) =>
                        onUpdateAcademicEvent(
                          selectedAcademicYear,
                          ev.eventKey,
                          {
                            calendarDisplay: e.target.checked,
                          }
                        )
                      }
                      className="rounded border-slate-300 text-blue-600"
                    />
                    Calendar同期
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: 修士ロードマップ管理（タスクの追加・編集・削除）
         ===================================================================== */}
      {subTab === 'ROADMAP' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#0B1F3A]" />
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">
                  修士課程 共通研究ロードマップ管理（現在有効: 合計
                  {activeRoadmapTasks.length}件 / M1={m1TaskCount}件, M2=
                  {m2TaskCount}件）
                </h2>
                <p className="text-xs text-slate-500">
                  タスクの追加・編集・削除を行うと、該当学年の全学生の進捗リストへ即座に反映されます。
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {(['ALL', 'M1', 'M2'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setRoadmapGradeFilter(g)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold ${
                      roadmapGradeFilter === g
                        ? 'bg-[#0B1F3A] text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    {g === 'ALL' ? 'すべて' : g}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAddTaskModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新規タスクを追加
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-[650px] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">taskId</th>
                  <th className="px-3 py-2.5">学年</th>
                  <th className="px-3 py-2.5">カテゴリ</th>
                  <th className="px-3 py-2.5">項目名 / 学生アクション</th>
                  <th className="px-3 py-2.5">時期目安</th>
                  <th className="px-3 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRoadmapTasks.map((t) => {
                  const isEditingThis = editingTaskId === t.taskId;
                  return (
                    <tr key={t.taskId} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                        {t.taskId}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-bold">
                          {t.grade}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={editTaskCategory}
                            onChange={(e) =>
                              setEditTaskCategory(e.target.value)
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          t.category
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditingThis ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editTaskTitle}
                              onChange={(e) => setEditTaskTitle(e.target.value)}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={editTaskAction}
                              onChange={(e) =>
                                setEditTaskAction(e.target.value)
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-slate-900">
                              {t.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {t.studentAction}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={editTaskGuideline}
                            onChange={(e) =>
                              setEditTaskGuideline(e.target.value)
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          t.guideline
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isEditingThis ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => saveEditTask(t.taskId)}
                              className="rounded bg-[#2563EB] px-2.5 py-1 font-semibold text-white"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTaskId(null)}
                              className="rounded border border-slate-300 px-2 py-1 text-slate-600"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditTask(t)}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-100"
                            >
                              <Edit3 className="h-3 w-3" />
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteRoadmapTask(t.taskId);
                                setBannerMessage(
                                  `タスク「${t.title} (${t.taskId})」を削除しました。`
                                );
                              }}
                              className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              削除
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: 通知・リマインド設定確認 (#57〜#62)
         ===================================================================== */}
      {subTab === 'NOTIFICATIONS' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 text-[#2563EB]" />
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A]">
                  学生別リマインドメール送信仕様・設定確認
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  各学生が設定した「個人目標日」（または「共通公式期限」）に対して、
                  <strong>14日前・7日前・3日前・当日（朝8:00 Asia/Tokyo）</strong>
                  に、その学生固有の未完了タスクのみを個別に通知します。
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs sm:grid-cols-3">
              <div>
                <span className="font-semibold text-slate-500">
                  リマインド送信元（From / 管理者連絡先）
                </span>
                <p className="mt-1 flex items-center gap-1.5 font-mono font-bold text-[#0B1F3A]">
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                  {SYSTEM_REMINDER_SENDER_EMAIL}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-500">
                  送信先（To）の決定ルール
                </span>
                <p className="mt-1 font-bold text-slate-800">
                  学生ごとに登録された個別メールアドレス (`student.email`)
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-500">
                  重複送信防止キー (`notificationId`)
                </span>
                <p className="mt-1 font-mono text-slate-700">
                  studentId_taskId_dueDate_remindDays
                </p>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-bold text-[#0B1F3A]">
              現在の学生別 通知対象タスク（14日以内期限・期限超過）
            </h3>
            {studentNotificationQueue.length === 0 ? (
              <p className="mt-3 py-6 text-center text-xs text-slate-500">
                現在、14日以内に期限が到来する未完了タスクはありません。
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs">
                {studentNotificationQueue.map((item) => (
                  <div
                    key={item.notificationId}
                    className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        宛先: {item.student.name} ({item.student.email})
                      </span>
                      <span className="ml-2 text-slate-500">
                        送信元: {SYSTEM_REMINDER_SENDER_EMAIL}
                      </span>
                      <p className="mt-0.5 font-medium text-slate-700">
                        対象タスク: [{item.record.taskId}] {item.record.title}
                        （期限: {item.record.appliedDueDate}）
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">
                        {item.notificationId}
                      </span>
                      {item.isTriggerDay ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-800">
                          本日通知対象（残り{item.remainingDays}日）
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">
                          残り{item.remainingDays}日
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: 監査ログ (#70, #71)
         ===================================================================== */}
      {subTab === 'AUDIT' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-bold text-[#0B1F3A]">
            監査ログ（重要管理操作履歴）
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            学生作成・在籍変更・進級・パスワードリセット・年度設定変更・タスク増減等の操作を自動記録します。
          </p>
          {auditLogs.length === 0 ? (
            <p className="mt-4 py-6 text-center text-xs text-slate-500">
              まだ管理操作の履歴はありません。
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.auditId}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-bold text-[#0B1F3A]">
                      {log.action}
                    </span>
                    <span className="ml-2 font-semibold text-slate-800">
                      対象: {log.targetType} ({log.targetId})
                    </span>
                    <span className="ml-2 text-slate-500">
                      実行者: {log.actorEmail}
                    </span>
                  </div>
                  <span className="text-slate-400">
                    {log.createdAt.replace('T', ' ').slice(0, 19)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 新規ロードマップタスク追加モーダル */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0B1F3A]">
              ロードマップへ新規タスクを追加
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              追加したタスクは、対象学年（M1またはM2）の全学生の進捗一覧にも自動的に追加されます。
            </p>

            <form
              className="mt-4 space-y-3 text-xs"
              onSubmit={handleAddTaskSubmit}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">対象学年</label>
                  <select
                    value={taskGrade}
                    onChange={(e) =>
                      setTaskGrade(e.target.value as MasterGrade)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="M1">M1</option>
                    <option value="M2">M2</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">カテゴリ名</label>
                  <input
                    type="text"
                    required
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value)}
                    placeholder="例: 03_研究計画"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">
                  タスク項目名（タイトル）
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="例: 中間発表スライドの指導教員チェック"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">
                  学生が取るべき行動（説明）
                </label>
                <input
                  type="text"
                  value={taskAction}
                  onChange={(e) => setTaskAction(e.target.value)}
                  placeholder="例: 発表7日前までに指導教員へスライド案を提出し確認を受ける"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">時期目安</label>
                  <input
                    type="text"
                    value={taskGuideline}
                    onChange={(e) => setTaskGuideline(e.target.value)}
                    placeholder="例: 7月上旬"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">期限種別</label>
                  <select
                    value={taskDeadlineType}
                    onChange={(e) =>
                      setTaskDeadlineType(e.target.value as DeadlineType)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="PERSONAL">個人目標日中心</option>
                    <option value="COMMON_EVENT">年度公式イベント基準</option>
                  </select>
                </div>
              </div>

              {taskDeadlineType === 'COMMON_EVENT' && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3">
                  <div>
                    <label className="font-bold text-slate-700">
                      基準イベント
                    </label>
                    <select
                      value={taskBaseEventKey}
                      onChange={(e) => setTaskBaseEventKey(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                    >
                      <option value="">選択してください</option>
                      {academicEvents.map((ev) => (
                        <option key={ev.eventKey} value={ev.eventKey}>
                          {ev.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">
                      相対日数 (offset)
                    </label>
                    <input
                      type="number"
                      value={taskOffsetDays}
                      onChange={(e) =>
                        setTaskOffsetDays(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">算出規則</label>
                    <select
                      value={taskDeadlineRule}
                      onChange={(e) =>
                        setTaskDeadlineRule(e.target.value as DeadlineRule)
                      }
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                    >
                      <option value="EXACT">指定日そのまま</option>
                      <option value="PREVIOUS_MONDAY">直前月曜</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  タスクを追加する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Firebaseクラウド接続設定モーダル */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0B1F3A]">
              別PC・スマホ間のリアルタイム共有（Firebase Cloud Firestore 接続）
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              同一PC・同一ブラウザ内の別タブ間では現在もリアルタイムに連動しますが、
              <strong>
                学生のスマートフォンや別PCからの更新を先生のPCへインターネット越しにリアルタイム反映
              </strong>
              するには、Firebase Consoleのウェブアプリ設定値（またはCloudflare
              Pagesの環境変数 `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_PROJECT_ID`）を入力してください。
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">
                  Firebase Project ID (`projectId`)
                </label>
                <input
                  type="text"
                  value={fbProjectId}
                  onChange={(e) => setFbProjectId(e.target.value)}
                  placeholder="例: shintyokukanri-dev"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">
                  Firebase Web API Key (`apiKey`)
                </label>
                <input
                  type="text"
                  value={fbApiKey}
                  onChange={(e) => setFbApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700">
                  Auth Domain (`authDomain`・省略時は自動補完)
                </label>
                <input
                  type="text"
                  value={fbAuthDomain}
                  onChange={(e) => setFbAuthDomain(e.target.value)}
                  placeholder="例: shintyokukanri-dev.firebaseapp.com"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloudModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fbApiKey.trim() && fbProjectId.trim()) {
                    saveRuntimeFirebaseConfig({
                      apiKey: fbApiKey.trim(),
                      projectId: fbProjectId.trim(),
                      authDomain:
                        fbAuthDomain.trim() ||
                        `${fbProjectId.trim()}.firebaseapp.com`,
                    });
                    window.location.reload();
                  }
                }}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                保存してクラウド接続を有効化
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規学生作成モーダル (#50, #51) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0B1F3A]">
              新規学生アカウント登録
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              登録と同時に初期パスワード設定（初回ログイン時変更強制 `mustChangePassword = TRUE`）および現在学年のロードマップ進捗を自動生成します。
            </p>

            {createError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {createError}
              </div>
            )}

            <form className="mt-4 space-y-3 text-xs" onSubmit={handleCreateSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">
                    学生ID (studentId)
                  </label>
                  <input
                    type="text"
                    required
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">氏名</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">
                    学生メールアドレス（ログインID・通知宛先）
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">
                    初期パスワード（8文字以上）
                  </label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={newInitialPassword}
                    onChange={(e) => setNewInitialPassword(e.target.value)}
                    placeholder="8文字以上の初期パスワード"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">学年</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value as MasterGrade)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="M1">M1 ({m1TaskCount}件生成)</option>
                    <option value="M2">M2 ({m2TaskCount}件生成)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">入学年度</label>
                  <input
                    type="number"
                    required
                    value={newEnrollmentYear}
                    onChange={(e) =>
                      setNewEnrollmentYear(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">在籍状態</label>
                  <select
                    value={newEnrollmentStatus}
                    onChange={(e) =>
                      setNewEnrollmentStatus(e.target.value as EnrollmentStatus)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="在籍">在籍</option>
                    <option value="休学">休学</option>
                    <option value="修了">修了</option>
                    <option value="退学">退学</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">指導教員</label>
                <input
                  type="text"
                  value={newSupervisor}
                  onChange={(e) => setNewSupervisor(e.target.value)}
                  placeholder="指導教員名（任意）"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={newNotificationEnabled}
                    onChange={(e) =>
                      setNewNotificationEnabled(e.target.checked)
                    }
                  />
                  期限リマインド通知を有効にする
                </label>
                <label className="inline-flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={newIsAdminAlso}
                    onChange={(e) => setNewIsAdminAlso(e.target.checked)}
                  />
                  管理者権限も付与（兼務）
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  学生アカウントを作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* パスワードリセットモーダル (#53) */}
      {resetTargetStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0B1F3A]">
              仮パスワードのリセット ({resetTargetStudentId})
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              新しい仮パスワードを設定します。リセット後、対象学生の `mustChangePassword` は自動的に `TRUE` となり、次回ログイン時に本人による新パスワード設定が強制されます。
            </p>
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700">
                新しい仮パスワード（8文字以上）
              </label>
              <input
                type="text"
                minLength={8}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="8文字以上の仮パスワード"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTargetStudentId(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={tempPassword.length < 8}
                onClick={async () => {
                  await onResetPassword(resetTargetStudentId, tempPassword);
                  setBannerMessage(
                    `学生 (${resetTargetStudentId}) の仮パスワードを設定し、初回パスワード変更フラグ (mustChangePassword = TRUE) を有効化しました。`
                  );
                  setResetTargetStudentId(null);
                  setTempPassword('');
                }}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                仮パスワードを設定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StudentDetailPanelProps {
  detail: {
    student: Student;
    profile: UserProfile | undefined;
    summary: ReturnType<typeof calculateGradeProgressSummary>;
  };
  progressRecords: ProgressRecord[];
  todayTokyo: string;
  onBack: () => void;
  onUpdateStudentMeta: (
    updates: Partial<
      Pick<
        Student,
        | 'enrollmentStatus'
        | 'currentGrade'
        | 'supervisor'
        | 'name'
        | 'notificationEnabled'
        | 'notes'
      >
    >
  ) => void;
  onPromoteToM2: () => void;
  onToggleActive: (active: boolean) => void;
  onOpenResetModal: () => void;
  onAdminUpdateProgress: (
    progressId: string,
    updates: {
      status: ProgressStatus;
      personalTargetDate: string | null;
      comment: string;
    }
  ) => void;
}

const StudentDetailPanel: React.FC<StudentDetailPanelProps> = ({
  detail,
  progressRecords,
  todayTokyo,
  onBack,
  onUpdateStudentMeta,
  onPromoteToM2,
  onToggleActive,
  onOpenResetModal,
  onAdminUpdateProgress,
}) => {
  const { student, profile, summary } = detail;
  const [gradeTab, setGradeTab] = useState<MasterGrade>(student.currentGrade);

  const recordsForTab = useMemo(
    () =>
      progressRecords
        .filter((p) => p.historicalGrade === gradeTab)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [progressRecords, gradeTab]
  );

  const isActive = profile?.active !== false;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              ← 学生一覧へ戻る
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-[#0B1F3A] px-2.5 py-1 text-xs font-bold text-white">
                {student.currentGrade}
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {student.name}（{student.studentId}）
              </h2>

              {/* 在籍状態の即時変更セレクター (#23) */}
              <div className="inline-flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-500">在籍状態:</span>
                <select
                  value={student.enrollmentStatus}
                  onChange={(e) =>
                    onUpdateStudentMeta({
                      enrollmentStatus: e.target.value as EnrollmentStatus,
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 font-bold text-[#0B1F3A]"
                >
                  <option value="在籍">在籍</option>
                  <option value="休学">休学</option>
                  <option value="修了">修了</option>
                  <option value="退学">退学</option>
                </select>
              </div>

              {!isActive && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                  アカウント利用停止中
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              通知宛先メール: {student.email} / 指導教員: {student.supervisor} /
              入学年度: {student.enrollmentYear}年 / 最終更新:{' '}
              {student.updatedAt.slice(0, 16).replace('T', ' ')} / 最終ログイン:{' '}
              {profile?.lastLoginAt?.slice(0, 16).replace('T', ' ') ??
                '未ログイン'}
              {profile?.mustChangePassword ? '（初回PW変更待ち）' : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {student.currentGrade === 'M1' && (
              <button
                type="button"
                onClick={onPromoteToM2}
                className="rounded-xl bg-[#0B1F3A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                M2へ進級処理（M1履歴保持＋M2生成）
              </button>
            )}
            <button
              type="button"
              onClick={onOpenResetModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <KeyRound className="h-3.5 w-3.5" />
              PWリセット
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(!isActive)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold ${
                isActive
                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {isActive ? (
                <>
                  <UserX className="h-3.5 w-3.5" />
                  利用停止にする
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  利用再開する
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <span>
              現在学年 ({student.currentGrade}) 進捗率:{' '}
              <strong className="text-base text-[#0B1F3A]">
                {summary.percentage}%
              </strong>{' '}
              ({summary.completedManagedTasks}/{summary.totalManagedTasks})
            </span>
            <span>期限超過: {summary.overdueTasks}件</span>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setGradeTab('M1')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                gradeTab === 'M1'
                  ? 'bg-[#0B1F3A] text-white'
                  : 'text-slate-600'
              }`}
            >
              M1 進捗履歴
            </button>
            <button
              type="button"
              onClick={() => setGradeTab('M2')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                gradeTab === 'M2'
                  ? 'bg-[#0B1F3A] text-white'
                  : 'text-slate-600'
              }`}
            >
              M2 進捗
            </button>
          </div>
        </div>

        {recordsForTab.length === 0 ? (
          <p className="mt-6 py-8 text-center text-xs text-slate-500">
            {gradeTab} の進捗レコードはまだ生成されていません。
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {recordsForTab.map((rec) => {
              const dl = evaluateDeadlineState(
                rec.status,
                rec.appliedDueDate,
                todayTokyo
              );
              return (
                <div
                  key={rec.progressId}
                  className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {rec.taskId}
                      </span>
                      <StatusBadge status={rec.status} />
                      <DeadlineBadge
                        label={dl.label}
                        remainingDays={dl.remainingDays}
                      />
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-900">
                      {rec.title}
                    </p>
                    {rec.comment && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        コメント: {rec.comment}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select
                      value={rec.status}
                      onChange={(e) =>
                        onAdminUpdateProgress(rec.progressId, {
                          status: e.target.value as ProgressStatus,
                          personalTargetDate: rec.personalTargetDate,
                          comment: rec.comment,
                        })
                      }
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
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

                    <input
                      type="date"
                      value={rec.personalTargetDate ?? ''}
                      onChange={(e) =>
                        onAdminUpdateProgress(rec.progressId, {
                          status: rec.status,
                          personalTargetDate: e.target.value || null,
                          comment: rec.comment,
                        })
                      }
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
