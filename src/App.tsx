/**
 * 大学院研究進捗管理Webアプリ — メインアプリケーション
 * MASTER_SPEC.md に基づく認証・初回PW変更強制・兼務ユーザーの学生/管理者画面切替・権限制御を統括
 */

import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  GraduationCap,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';
import type {
  AcademicEvent,
  AuditLog,
  EnrollmentStatus,
  MasterGrade,
  ProgressRecord,
  ProgressStatus,
  Student,
  UserProfile,
} from './types/domain';
import {
  DEFAULT_ACADEMIC_EVENTS_2026,
  INITIAL_ROADMAP_TASKS,
} from './data/roadmapSeed';
import {
  buildInitialDemoProgress,
  DEMO_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_STUDENTS,
} from './data/demoSeed';
import {
  calculateCommonDueDate,
  getTokyoDateString,
  promoteStudentToM2,
  resolveAppliedDueDate,
} from './lib/progressUtils';
import {
  ForcePasswordChangeView,
  LoginView,
} from './features/auth/LoginView';
import { StudentDashboard } from './features/student/StudentDashboard';
import { AdminDashboard } from './features/admin/AdminDashboard';

export const App: React.FC = () => {
  const todayTokyo = useMemo(() => getTokyoDateString(), []);

  // アカウント・マスター・進捗ステート
  const [usersMap, setUsersMap] = useState(() => ({ ...DEMO_USERS }));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'STUDENT' | 'ADMIN'>(
    'STUDENT'
  );

  const [students, setStudents] = useState<Student[]>(() => [
    ...INITIAL_STUDENTS,
  ]);
  const [academicEvents, setAcademicEvents] = useState<AcademicEvent[]>(() => [
    ...DEFAULT_ACADEMIC_EVENTS_2026,
  ]);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>(() =>
    buildInitialDemoProgress()
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => [
    ...INITIAL_AUDIT_LOGS,
  ]);

  const userProfilesList = useMemo(
    () => Object.values(usersMap).map((u) => u.profile),
    [usersMap]
  );

  // ログイン処理 (#7〜#9, #12, #16)
  const handleLogin = async (
    email: string,
    password: string
  ): Promise<string | null> => {
    const key = email.toLowerCase();
    const matched = usersMap[key];
    if (!matched || matched.password !== password) {
      return 'メールアドレスまたはパスワードが正しくありません。';
    }
    if (!matched.profile.active) {
      return 'このアカウントは現在利用停止されています。管理者へお問い合わせください。';
    }

    const nowIso = new Date().toISOString();
    const updatedProfile: UserProfile = {
      ...matched.profile,
      lastLoginAt: nowIso,
      updatedAt: nowIso,
    };

    setUsersMap((prev) => ({
      ...prev,
      [key]: { ...matched, profile: updatedProfile },
    }));
    setCurrentUser(updatedProfile);

    // 管理者専任ならADMIN画面、学生または兼務ならまず適切な初期画面へ
    if (updatedProfile.roles.admin && !updatedProfile.roles.student) {
      setActiveViewMode('ADMIN');
    } else {
      setActiveViewMode('STUDENT');
    }
    return null;
  };

  // 初回パスワード変更完了処理 (#12: mustChangePassword = TRUE -> FALSE)
  const handleForcePasswordChange = async (
    newPassword: string
  ): Promise<string | null> => {
    if (!currentUser) return '未ログイン状態です。';
    const key = currentUser.email.toLowerCase();
    const entry = usersMap[key];
    if (!entry) return 'ユーザー情報が見つかりません。';

    const nowIso = new Date().toISOString();
    const updatedProfile: UserProfile = {
      ...currentUser,
      mustChangePassword: false,
      updatedAt: nowIso,
    };

    setUsersMap((prev) => ({
      ...prev,
      [key]: {
        password: newPassword,
        profile: updatedProfile,
      },
    }));
    setCurrentUser(updatedProfile);
    return null;
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // 進捗レコード更新 (#35, #36, #43)
  const handleUpdateProgress = (
    progressId: string,
    updates: {
      status: ProgressStatus;
      personalTargetDate: string | null;
      comment: string;
    }
  ) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();

    setProgressRecords((prev) =>
      prev.map((rec) => {
        if (rec.progressId !== progressId) return rec;

        // 学生モードの場合、他人の進捗は絶対に変更不可 (#17, #73)
        if (
          activeViewMode === 'STUDENT' &&
          rec.studentId !== currentUser.studentId
        ) {
          return rec;
        }

        const { appliedDueDate, dueSource } = resolveAppliedDueDate(
          updates.personalTargetDate,
          rec.commonDueDate
        );

        // #35 COMPLETEDへ変更した時 completedAt が空ならサーバー時刻で自動入力、完了から別状態へ戻す場合は completedAt をクリア
        let completedAt = rec.completedAt;
        if (updates.status === 'COMPLETED' && !completedAt) {
          completedAt = nowIso;
        } else if (updates.status !== 'COMPLETED') {
          completedAt = null;
        }

        return {
          ...rec,
          status: updates.status,
          personalTargetDate: updates.personalTargetDate,
          appliedDueDate,
          dueSource,
          completedAt,
          comment: updates.comment,
          updatedAt: nowIso,
          updatedByUid: currentUser.uid,
        };
      })
    );
  };

  // 管理者：新規学生作成 (#50, #51, #70)
  const handleCreateStudent = (input: {
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
  }): string | null => {
    if (!currentUser?.roles.admin) {
      return '管理者権限が必要です。';
    }
    if (students.some((s) => s.studentId === input.studentId)) {
      return `学生ID ${input.studentId} は既に存在します。`;
    }
    const emailKey = input.email.toLowerCase();
    if (usersMap[emailKey]) {
      return `メールアドレス ${input.email} は既に登録されています。`;
    }

    const nowIso = new Date().toISOString();
    const newUid = `uid-${input.studentId.toLowerCase()}`;

    const newProfile: UserProfile = {
      uid: newUid,
      email: input.email,
      displayName: input.name,
      studentId: input.studentId,
      roles: {
        student: true,
        admin: input.isAdminAlso,
      },
      mustChangePassword: true,
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: null,
    };

    const newStudent: Student = {
      studentId: input.studentId,
      name: input.name,
      email: input.email,
      course: 'MASTER',
      currentGrade: input.currentGrade,
      enrollmentYear: input.enrollmentYear,
      supervisor: input.supervisor,
      enrollmentStatus: input.enrollmentStatus,
      notificationEnabled: input.notificationEnabled,
      notes: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const gradeTasks = INITIAL_ROADMAP_TASKS.filter(
      (t) => t.grade === input.currentGrade && t.active
    );
    const createdProgress: ProgressRecord[] = gradeTasks.map((task) => {
      const commonDueDate = calculateCommonDueDate(task, academicEvents);
      const { appliedDueDate, dueSource } = resolveAppliedDueDate(
        null,
        commonDueDate
      );
      return {
        progressId: `${input.studentId}_${task.taskId}`,
        studentId: input.studentId,
        taskId: task.taskId,
        historicalGrade: input.currentGrade,
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
        updatedByUid: currentUser.uid,
      };
    });

    setUsersMap((prev) => ({
      ...prev,
      [emailKey]: { password: input.initialPassword, profile: newProfile },
    }));
    setStudents((prev) => [...prev, newStudent]);
    setProgressRecords((prev) => [...prev, ...createdProgress]);
    setAuditLogs((prev) => [
      {
        auditId: `audit-${Date.now()}`,
        action: 'CREATE_STUDENT',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: input.studentId,
        details: { currentGrade: input.currentGrade },
        createdAt: nowIso,
      },
      ...prev,
    ]);

    return null;
  };

  // 管理者：M1→M2進級処理 (#33)
  const handlePromoteToM2 = (studentId: string) => {
    if (!currentUser?.roles.admin) return;
    const target = students.find((s) => s.studentId === studentId);
    if (!target || target.currentGrade !== 'M1') return;

    const nowIso = new Date().toISOString();
    const { updatedStudent, mergedProgress } = promoteStudentToM2(
      target,
      progressRecords.filter((p) => p.studentId === studentId),
      INITIAL_ROADMAP_TASKS,
      academicEvents,
      currentUser.uid,
      nowIso
    );

    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? updatedStudent : s))
    );
    setProgressRecords((prev) => [
      ...prev.filter((p) => p.studentId !== studentId),
      ...mergedProgress,
    ]);
    setAuditLogs((prev) => [
      {
        auditId: `audit-${Date.now()}`,
        action: 'PROMOTE_GRADE',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: studentId,
        details: { from: 'M1', to: 'M2' },
        createdAt: nowIso,
      },
      ...prev,
    ]);
  };

  // 管理者：アカウント利用停止 / 再開 (#52)
  const handleToggleAccountActive = (studentId: string, active: boolean) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    setUsersMap((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(next)) {
        if (v.profile.studentId === studentId) {
          next[k] = {
            ...v,
            profile: { ...v.profile, active, updatedAt: nowIso },
          };
        }
      }
      return next;
    });

    setAuditLogs((prev) => [
      {
        auditId: `audit-${Date.now()}`,
        action: active ? 'ACTIVATE_STUDENT' : 'DEACTIVATE_STUDENT',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: studentId,
        details: { active },
        createdAt: nowIso,
      },
      ...prev,
    ]);
  };

  // 管理者：パスワードリセット (#53: mustChangePassword = TRUE)
  const handleResetPassword = (studentId: string, tempPassword: string) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    setUsersMap((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(next)) {
        if (v.profile.studentId === studentId) {
          next[k] = {
            password: tempPassword,
            profile: {
              ...v.profile,
              mustChangePassword: true,
              updatedAt: nowIso,
            },
          };
        }
      }
      return next;
    });

    setAuditLogs((prev) => [
      {
        auditId: `audit-${Date.now()}`,
        action: 'RESET_PASSWORD',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: studentId,
        details: { mustChangePassword: true },
        createdAt: nowIso,
      },
      ...prev,
    ]);
  };

  // 管理者：年度イベント更新と共通期限の自動再計算 (#28, #30, #36)
  const handleUpdateAcademicEvent = (
    eventKey: string,
    updates: Partial<AcademicEvent>
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const nextEvents = academicEvents.map((ev) =>
      ev.eventKey === eventKey ? { ...ev, ...updates } : ev
    );
    setAcademicEvents(nextEvents);

    const taskMap = new Map(INITIAL_ROADMAP_TASKS.map((t) => [t.taskId, t]));
    setProgressRecords((prev) =>
      prev.map((rec) => {
        const task = taskMap.get(rec.taskId);
        if (!task || task.baseEventKey !== eventKey) return rec;
        const newCommonDue = calculateCommonDueDate(task, nextEvents);
        const { appliedDueDate, dueSource } = resolveAppliedDueDate(
          rec.personalTargetDate,
          newCommonDue
        );
        return {
          ...rec,
          commonDueDate: newCommonDue,
          appliedDueDate,
          dueSource,
          updatedAt: nowIso,
        };
      })
    );

    setAuditLogs((prev) => [
      {
        auditId: `audit-${Date.now()}`,
        action: 'UPDATE_ACADEMIC_YEAR',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'academicEvent',
        targetId: eventKey,
        details: updates,
        createdAt: nowIso,
      },
      ...prev,
    ]);
  };

  // 1. 未ログイン時はシンプルなログイン画面を表示 (#7)
  if (!currentUser) {
    return <LoginView onLogin={handleLogin} isDemoMode={true} />;
  }

  // 2. 初回パスワード変更フラグが TRUE の場合はパスワード変更画面を強制表示 (#12)
  if (currentUser.mustChangePassword) {
    return (
      <ForcePasswordChangeView
        userEmail={currentUser.email}
        onChangePassword={handleForcePasswordChange}
        onLogout={handleLogout}
      />
    );
  }

  const isDualRole =
    currentUser.roles.student === true && currentUser.roles.admin === true;
  const currentStudentRecord = students.find(
    (s) => s.studentId === currentUser.studentId
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* トップナビゲーションバー（Navy #0B1F3A 基調 #54） */}
      <header className="sticky top-0 z-40 bg-[#0B1F3A] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide sm:text-lg">
                大学院研究進捗管理
              </h1>
              <p className="text-[11px] text-slate-300">
                基準日 (Asia/Tokyo): {todayTokyo}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* #16 兼務ユーザーのみ「学生画面 ⇄ 管理者画面」切替UIを表示（一般学生には一切表示しない） */}
            {isDualRole && (
              <div className="inline-flex items-center rounded-xl bg-slate-800/90 p-1">
                <button
                  type="button"
                  onClick={() => setActiveViewMode('STUDENT')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeViewMode === 'STUDENT'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  学生画面
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('ADMIN')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeViewMode === 'ADMIN'
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  管理者画面
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl bg-slate-800/70 px-3 py-1.5 text-xs">
              {activeViewMode === 'ADMIN' ? (
                <ShieldCheck className="h-4 w-4 text-blue-400" />
              ) : (
                <User className="h-4 w-4 text-blue-400" />
              )}
              <span className="font-medium">{currentUser.displayName}</span>
              {isDualRole && (
                <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                  <ArrowLeftRight className="h-3 w-3" />
                  兼務
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ領域 */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {activeViewMode === 'ADMIN' && currentUser.roles.admin ? (
          <AdminDashboard
            students={students}
            userProfiles={userProfilesList}
            progressRecords={progressRecords}
            roadmapTasks={INITIAL_ROADMAP_TASKS}
            academicYear={2026}
            academicEvents={academicEvents}
            auditLogs={auditLogs}
            todayTokyo={todayTokyo}
            onCreateStudent={handleCreateStudent}
            onPromoteToM2={handlePromoteToM2}
            onToggleAccountActive={handleToggleAccountActive}
            onResetPassword={handleResetPassword}
            onAdminUpdateProgress={handleUpdateProgress}
            onUpdateAcademicEvent={handleUpdateAcademicEvent}
          />
        ) : currentStudentRecord ? (
          <StudentDashboard
            student={currentStudentRecord}
            progressRecords={progressRecords.filter(
              // #73 学生は自分自身の studentId に紐づくデータのみ参照可能
              (p) => p.studentId === currentStudentRecord.studentId
            )}
            roadmapTasks={INITIAL_ROADMAP_TASKS}
            todayTokyo={todayTokyo}
            onUpdateProgress={handleUpdateProgress}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">
              学生プロフィールが紐付けられていません。管理者画面へ切り替えてください。
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
