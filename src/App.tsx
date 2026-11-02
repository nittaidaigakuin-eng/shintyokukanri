/**
 * 大学院研究進捗管理Webアプリ — メインアプリケーション
 * MASTER_SPEC.md に基づく認証・初回PW変更強制・兼務ユーザーの学生/管理者画面切替・年度別管理・タスク増減・在籍状態変更・リアルタイム同期を統括
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  GraduationCap,
  LogOut,
  ShieldCheck,
  User,
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
} from './types/domain';
import {
  DEFAULT_ACADEMIC_EVENTS_2026,
  INITIAL_ROADMAP_TASKS,
} from './data/roadmapSeed';
import {
  buildInitialDemoProgress,
  INITIAL_ACADEMIC_YEARS,
  INITIAL_AUDIT_LOGS,
  INITIAL_STUDENTS,
  INITIAL_USERS,
  sha256Hex,
  type StoredAccount,
} from './data/demoSeed';
import {
  calculateCommonDueDate,
  getTokyoDateString,
  promoteStudentToM2,
  resolveAppliedDueDate,
} from './lib/progressUtils';
import {
  getActiveFirebaseConfig,
  pushSharedAppState,
  subscribeSharedAppState,
  type SharedAppState,
} from './lib/firebase/syncStore';
import {
  ForcePasswordChangeView,
  LoginView,
} from './features/auth/LoginView';
import { StudentDashboard } from './features/student/StudentDashboard';
import { AdminDashboard } from './features/admin/AdminDashboard';

const STORAGE_KEYS = {
  users: 'shintyokukanri_v2_users',
  students: 'shintyokukanri_v2_students',
  roadmapTasks: 'shintyokukanri_v2_roadmap_tasks',
  academicYears: 'shintyokukanri_v2_academic_years',
  selectedYear: 'shintyokukanri_v2_selected_year',
  progress: 'shintyokukanri_v2_progress',
  audit: 'shintyokukanri_v2_audit',
};

function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const App: React.FC = () => {
  const todayTokyo = useMemo(() => getTokyoDateString(), []);
  const isApplyingRemoteRef = useRef(false);

  // アカウント・マスター・ロードマップ・年度別設定・進捗ステート
  const [usersMap, setUsersMap] = useState<Record<string, StoredAccount>>(() =>
    loadPersisted(STORAGE_KEYS.users, { ...INITIAL_USERS })
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'STUDENT' | 'ADMIN'>(
    'STUDENT'
  );

  const [students, setStudents] = useState<Student[]>(() =>
    loadPersisted(STORAGE_KEYS.students, [...INITIAL_STUDENTS])
  );
  const [roadmapTasks, setRoadmapTasks] = useState<RoadmapTask[]>(() =>
    loadPersisted(STORAGE_KEYS.roadmapTasks, [...INITIAL_ROADMAP_TASKS])
  );
  const [academicYearsMap, setAcademicYearsMap] = useState<
    Record<number, AcademicYear>
  >(() =>
    loadPersisted(STORAGE_KEYS.academicYears, { ...INITIAL_ACADEMIC_YEARS })
  );
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(() =>
    loadPersisted(STORAGE_KEYS.selectedYear, 2026)
  );
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>(() =>
    loadPersisted(STORAGE_KEYS.progress, buildInitialDemoProgress())
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    loadPersisted(STORAGE_KEYS.audit, [...INITIAL_AUDIT_LOGS])
  );

  const isCloudConnected = useMemo(
    () => Boolean(getActiveFirebaseConfig()),
    []
  );

  // 1. 同一ブラウザ別タブ間のリアルタイム同期 (storage イベント監視)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return;
      try {
        if (e.key === STORAGE_KEYS.users) {
          setUsersMap(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.students) {
          setStudents(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.roadmapTasks) {
          setRoadmapTasks(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.academicYears) {
          setAcademicYearsMap(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.selectedYear) {
          setSelectedAcademicYear(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.progress) {
          setProgressRecords(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.audit) {
          setAuditLogs(JSON.parse(e.newValue));
        }
      } catch {
        // ignore parse errors
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 2. Cloud Firestore が設定されている場合は全端末リアルタイム同期 (onSnapshot)
  useEffect(() => {
    const unsub = subscribeSharedAppState((remote: SharedAppState) => {
      isApplyingRemoteRef.current = true;
      if (remote.usersMap) setUsersMap(remote.usersMap);
      if (remote.students) setStudents(remote.students);
      if (remote.roadmapTasks) setRoadmapTasks(remote.roadmapTasks);
      if (remote.academicYearsMap) setAcademicYearsMap(remote.academicYearsMap);
      if (remote.selectedAcademicYear)
        setSelectedAcademicYear(remote.selectedAcademicYear);
      if (remote.progressRecords) setProgressRecords(remote.progressRecords);
      if (remote.auditLogs) setAuditLogs(remote.auditLogs);
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 50);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 変更時のローカル保存 & Firestore クラウドへの自動Push
  const syncToCloud = useCallback(
    (next: Partial<SharedAppState>) => {
      if (isApplyingRemoteRef.current) return;
      void pushSharedAppState({
        usersMap: next.usersMap ?? usersMap,
        students: next.students ?? students,
        roadmapTasks: next.roadmapTasks ?? roadmapTasks,
        academicYearsMap: next.academicYearsMap ?? academicYearsMap,
        selectedAcademicYear: next.selectedAcademicYear ?? selectedAcademicYear,
        progressRecords: next.progressRecords ?? progressRecords,
        auditLogs: next.auditLogs ?? auditLogs,
        updatedAt: new Date().toISOString(),
      });
    },
    [
      usersMap,
      students,
      roadmapTasks,
      academicYearsMap,
      selectedAcademicYear,
      progressRecords,
      auditLogs,
    ]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(usersMap));
    } catch {
      // ignore
    }
  }, [usersMap]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students));
    } catch {
      // ignore
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.roadmapTasks,
        JSON.stringify(roadmapTasks)
      );
    } catch {
      // ignore
    }
  }, [roadmapTasks]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.academicYears,
        JSON.stringify(academicYearsMap)
      );
    } catch {
      // ignore
    }
  }, [academicYearsMap]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.selectedYear,
        JSON.stringify(selectedAcademicYear)
      );
    } catch {
      // ignore
    }
  }, [selectedAcademicYear]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.progress,
        JSON.stringify(progressRecords)
      );
    } catch {
      // ignore
    }
  }, [progressRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(auditLogs));
    } catch {
      // ignore
    }
  }, [auditLogs]);

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
    const inputHash = await sha256Hex(password);

    if (!matched || matched.passwordHash !== inputHash) {
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

    const nextUsers = {
      ...usersMap,
      [key]: { ...matched, profile: updatedProfile },
    };
    setUsersMap(nextUsers);
    setCurrentUser(updatedProfile);
    syncToCloud({ usersMap: nextUsers });

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

    const newHash = await sha256Hex(newPassword);
    const nowIso = new Date().toISOString();
    const updatedProfile: UserProfile = {
      ...currentUser,
      mustChangePassword: false,
      updatedAt: nowIso,
    };

    const nextUsers = {
      ...usersMap,
      [key]: {
        passwordHash: newHash,
        profile: updatedProfile,
      },
    };
    setUsersMap(nextUsers);
    setCurrentUser(updatedProfile);
    syncToCloud({ usersMap: nextUsers });
    return null;
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // 進捗レコード更新 (#35, #36, #43) — 学生が更新した際に students.updatedAt も自動更新して管理画面へ即反映！
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
    let targetStudentId: string | null = null;

    const nextProgress = progressRecords.map((rec) => {
      if (rec.progressId !== progressId) return rec;

      // 学生モードの場合、他人の進捗は絶対に変更不可 (#17, #73)
      if (
        activeViewMode === 'STUDENT' &&
        rec.studentId !== currentUser.studentId
      ) {
        return rec;
      }

      targetStudentId = rec.studentId;

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
    });

    const nextStudents = targetStudentId
      ? students.map((s) =>
          s.studentId === targetStudentId ? { ...s, updatedAt: nowIso } : s
        )
      : students;

    setProgressRecords(nextProgress);
    setStudents(nextStudents);
    syncToCloud({ progressRecords: nextProgress, students: nextStudents });
  };

  // 管理者：学生の在籍状態（在籍・休学・修了・退学）や指導教員等の変更 (#23)
  const handleUpdateStudentMeta = (
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
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const nextStudents = students.map((s) =>
      s.studentId === studentId ? { ...s, ...updates, updatedAt: nowIso } : s
    );
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'CHANGE_ROLE',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: studentId,
        details: updates as Record<string, unknown>,
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setStudents(nextStudents);
    setAuditLogs(nextAudit);
    syncToCloud({ students: nextStudents, auditLogs: nextAudit });
  };

  // 管理者：新規学生作成 (#50, #51, #70)
  const handleCreateStudent = async (input: {
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
  }): Promise<string | null> => {
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

    const passwordHash = await sha256Hex(input.initialPassword);
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

    const yearEvents =
      academicYearsMap[selectedAcademicYear]?.events ??
      DEFAULT_ACADEMIC_EVENTS_2026;
    const gradeTasks = roadmapTasks.filter(
      (t) => t.grade === input.currentGrade && t.active
    );
    const createdProgress: ProgressRecord[] = gradeTasks.map((task) => {
      const commonDueDate = calculateCommonDueDate(task, yearEvents);
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

    const nextUsers = {
      ...usersMap,
      [emailKey]: { passwordHash, profile: newProfile },
    };
    const nextStudents = [...students, newStudent];
    const nextProgress = [...progressRecords, ...createdProgress];
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'CREATE_STUDENT',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: input.studentId,
        details: {
          currentGrade: input.currentGrade,
          enrollmentYear: input.enrollmentYear,
        },
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setUsersMap(nextUsers);
    setStudents(nextStudents);
    setProgressRecords(nextProgress);
    setAuditLogs(nextAudit);
    syncToCloud({
      usersMap: nextUsers,
      students: nextStudents,
      progressRecords: nextProgress,
      auditLogs: nextAudit,
    });

    return null;
  };

  // 管理者：M1→M2進級処理 (#33)
  const handlePromoteToM2 = (studentId: string) => {
    if (!currentUser?.roles.admin) return;
    const target = students.find((s) => s.studentId === studentId);
    if (!target || target.currentGrade !== 'M1') return;

    const nowIso = new Date().toISOString();
    const yearEvents =
      academicYearsMap[selectedAcademicYear]?.events ??
      DEFAULT_ACADEMIC_EVENTS_2026;
    const { updatedStudent, mergedProgress } = promoteStudentToM2(
      target,
      progressRecords.filter((p) => p.studentId === studentId),
      roadmapTasks,
      yearEvents,
      currentUser.uid,
      nowIso
    );

    const nextStudents = students.map((s) =>
      s.studentId === studentId ? updatedStudent : s
    );
    const nextProgress = [
      ...progressRecords.filter((p) => p.studentId !== studentId),
      ...mergedProgress,
    ];
    const nextAudit: AuditLog[] = [
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
      ...auditLogs,
    ];

    setStudents(nextStudents);
    setProgressRecords(nextProgress);
    setAuditLogs(nextAudit);
    syncToCloud({
      students: nextStudents,
      progressRecords: nextProgress,
      auditLogs: nextAudit,
    });
  };

  // 管理者：アカウント利用停止 / 再開 (#52)
  const handleToggleAccountActive = (studentId: string, active: boolean) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const nextUsers = { ...usersMap };
    for (const [k, v] of Object.entries(nextUsers)) {
      if (v.profile.studentId === studentId) {
        nextUsers[k] = {
          ...v,
          profile: { ...v.profile, active, updatedAt: nowIso },
        };
      }
    }

    const nextAudit: AuditLog[] = [
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
      ...auditLogs,
    ];

    setUsersMap(nextUsers);
    setAuditLogs(nextAudit);
    syncToCloud({ usersMap: nextUsers, auditLogs: nextAudit });
  };

  // 管理者：パスワードリセット (#53: mustChangePassword = TRUE)
  const handleResetPassword = async (
    studentId: string,
    tempPassword: string
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();
    const newHash = await sha256Hex(tempPassword);

    const nextUsers = { ...usersMap };
    for (const [k, v] of Object.entries(nextUsers)) {
      if (v.profile.studentId === studentId) {
        nextUsers[k] = {
          passwordHash: newHash,
          profile: {
            ...v.profile,
            mustChangePassword: true,
            updatedAt: nowIso,
          },
        };
      }
    }

    const nextAudit: AuditLog[] = [
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
      ...auditLogs,
    ];

    setUsersMap(nextUsers);
    setAuditLogs(nextAudit);
    syncToCloud({ usersMap: nextUsers, auditLogs: nextAudit });
  };

  // 管理者：新規年度の追加
  const handleAddAcademicYear = (year: number) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();
    if (academicYearsMap[year]) {
      setSelectedAcademicYear(year);
      return;
    }

    const yearOffset = year - 2026;
    const clonedEvents: AcademicEvent[] = DEFAULT_ACADEMIC_EVENTS_2026.map(
      (ev) => ({
        ...ev,
        date: ev.date
          ? `${Number(ev.date.slice(0, 4)) + yearOffset}${ev.date.slice(4)}`
          : null,
      })
    );
    const nextYears = {
      ...academicYearsMap,
      [year]: {
        year,
        isCurrent: false,
        updatedAt: nowIso,
        events: clonedEvents,
      },
    };
    setAcademicYearsMap(nextYears);
    setSelectedAcademicYear(year);
    syncToCloud({
      academicYearsMap: nextYears,
      selectedAcademicYear: year,
    });
  };

  // 管理者：年度別イベント更新と共通期限の自動再計算 (#28, #30, #36)
  const handleUpdateAcademicEvent = (
    year: number,
    eventKey: string,
    updates: Partial<AcademicEvent>
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const targetYearObj = academicYearsMap[year];
    if (!targetYearObj) return;

    const nextEvents = targetYearObj.events.map((ev) =>
      ev.eventKey === eventKey ? { ...ev, ...updates } : ev
    );

    const nextYears = {
      ...academicYearsMap,
      [year]: {
        ...targetYearObj,
        updatedAt: nowIso,
        events: nextEvents,
      },
    };

    const taskMap = new Map(roadmapTasks.map((t) => [t.taskId, t]));
    const nextProgress = progressRecords.map((rec) => {
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
    });

    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'UPDATE_ACADEMIC_YEAR',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'academicEvent',
        targetId: `${year}_${eventKey}`,
        details: updates as Record<string, unknown>,
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setAcademicYearsMap(nextYears);
    setProgressRecords(nextProgress);
    setAuditLogs(nextAudit);
    syncToCloud({
      academicYearsMap: nextYears,
      progressRecords: nextProgress,
      auditLogs: nextAudit,
    });
  };

  // 管理者：ロードマップタスクの新規追加（該当学年の学生の進捗にも自動追加）
  const handleAddRoadmapTask = (input: {
    grade: MasterGrade;
    category: string;
    title: string;
    studentAction: string;
    guideline: string;
    deadlineType: DeadlineType;
    baseEventKey: string | null;
    offsetDays: number | null;
    deadlineRule: DeadlineRule;
  }) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const sameGradeTasks = roadmapTasks.filter((t) => t.grade === input.grade);
    const maxOrder = sameGradeTasks.reduce(
      (max, t) => Math.max(max, t.displayOrder),
      0
    );
    const nextIndex = sameGradeTasks.length + 1;
    const taskId = `${input.grade}-CUSTOM-${String(nextIndex).padStart(2, '0')}-${Date.now().toString().slice(-3)}`;

    const newTask: RoadmapTask = {
      taskId,
      grade: input.grade,
      category: input.category,
      title: input.title,
      studentAction: input.studentAction,
      requirement: '必須',
      deadlineType: input.deadlineType,
      baseEventKey: input.baseEventKey,
      offsetDays: input.offsetDays,
      deadlineRule: input.deadlineRule,
      guideline: input.guideline,
      progressManaged: true,
      reminderPattern: [14, 7, 3, 0],
      calendarDisplay: false,
      displayOrder: maxOrder + 1,
      notes: '',
      active: true,
    };

    const yearEvents =
      academicYearsMap[selectedAcademicYear]?.events ??
      DEFAULT_ACADEMIC_EVENTS_2026;
    const commonDueDate = calculateCommonDueDate(newTask, yearEvents);
    const { appliedDueDate, dueSource } = resolveAppliedDueDate(
      null,
      commonDueDate
    );

    // 該当学年の進捗を持つ学生へ新タスクの progressRecord を自動追加
    const targetStudents = students.filter(
      (s) =>
        s.currentGrade === input.grade ||
        (input.grade === 'M1' && s.currentGrade === 'M2')
    );
    const addedProgress: ProgressRecord[] = targetStudents.map((s) => ({
      progressId: `${s.studentId}_${newTask.taskId}`,
      studentId: s.studentId,
      taskId: newTask.taskId,
      historicalGrade: input.grade,
      category: newTask.category,
      title: newTask.title,
      displayOrder: newTask.displayOrder,
      progressManaged: true,
      personalTargetDate: null,
      commonDueDate,
      appliedDueDate,
      dueSource,
      status: 'NOT_STARTED',
      completedAt: null,
      comment: '',
      updatedAt: nowIso,
      updatedByUid: currentUser.uid,
    }));

    const nextTasks = [...roadmapTasks, newTask];
    const nextProgress = [...progressRecords, ...addedProgress];
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'UPDATE_ROADMAP',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'roadmapTask',
        targetId: taskId,
        details: { action: 'ADD_TASK', title: input.title, grade: input.grade },
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setRoadmapTasks(nextTasks);
    setProgressRecords(nextProgress);
    setAuditLogs(nextAudit);
    syncToCloud({
      roadmapTasks: nextTasks,
      progressRecords: nextProgress,
      auditLogs: nextAudit,
    });
  };

  // 管理者：既存ロードマップタスクの編集
  const handleUpdateRoadmapTask = (
    taskId: string,
    updates: Partial<RoadmapTask>
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const nextTasks = roadmapTasks.map((t) =>
      t.taskId === taskId ? { ...t, ...updates } : t
    );
    const nextProgress = progressRecords.map((p) =>
      p.taskId === taskId
        ? {
            ...p,
            title: updates.title ?? p.title,
            category: updates.category ?? p.category,
            updatedAt: nowIso,
          }
        : p
    );
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'UPDATE_ROADMAP',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'roadmapTask',
        targetId: taskId,
        details: { action: 'EDIT_TASK', ...updates },
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setRoadmapTasks(nextTasks);
    setProgressRecords(nextProgress);
    setAuditLogs(nextAudit);
    syncToCloud({
      roadmapTasks: nextTasks,
      progressRecords: nextProgress,
      auditLogs: nextAudit,
    });
  };

  // 管理者：ロードマップタスクの削除（無効化＋未完了進捗からの除外）
  const handleDeleteRoadmapTask = (taskId: string) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const nextTasks = roadmapTasks.map((t) =>
      t.taskId === taskId ? { ...t, active: false, progressManaged: false } : t
    );
    const nextProgress = progressRecords.filter((p) => p.taskId !== taskId);
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'UPDATE_ROADMAP',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'roadmapTask',
        targetId: taskId,
        details: { action: 'DELETE_TASK' },
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setRoadmapTasks(nextTasks);
    setProgressRecords(nextProgress);
    setAuditLogs(nextAudit);
    syncToCloud({
      roadmapTasks: nextTasks,
      progressRecords: nextProgress,
      auditLogs: nextAudit,
    });
  };

  // 1. 未ログイン時はシンプルなログイン画面を表示 (#7)
  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
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
  const activeRoadmapTasks = roadmapTasks.filter((t) => t.active);

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
            roadmapTasks={activeRoadmapTasks}
            academicYearsMap={academicYearsMap}
            selectedAcademicYear={selectedAcademicYear}
            auditLogs={auditLogs}
            todayTokyo={todayTokyo}
            isCloudConnected={isCloudConnected}
            onSelectAcademicYear={setSelectedAcademicYear}
            onAddAcademicYear={handleAddAcademicYear}
            onCreateStudent={handleCreateStudent}
            onUpdateStudentMeta={handleUpdateStudentMeta}
            onPromoteToM2={handlePromoteToM2}
            onToggleAccountActive={handleToggleAccountActive}
            onResetPassword={handleResetPassword}
            onAdminUpdateProgress={handleUpdateProgress}
            onUpdateAcademicEvent={handleUpdateAcademicEvent}
            onAddRoadmapTask={handleAddRoadmapTask}
            onUpdateRoadmapTask={handleUpdateRoadmapTask}
            onDeleteRoadmapTask={handleDeleteRoadmapTask}
          />
        ) : currentStudentRecord ? (
          <StudentDashboard
            student={currentStudentRecord}
            progressRecords={progressRecords.filter(
              // #73 学生は自分自身の studentId に紐づくデータのみ参照可能
              (p) => p.studentId === currentStudentRecord.studentId
            )}
            roadmapTasks={activeRoadmapTasks}
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
