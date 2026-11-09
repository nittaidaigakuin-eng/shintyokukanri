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
  LabOperationConfig,
  MasterGrade,
  NotificationLog,
  ProgressRecord,
  ProgressStatus,
  ResearchProcessLogEntry,
  RoadmapTask,
  ScheduleEventCategory,
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
  INITIAL_LAB_OPERATION_CONFIG,
  INITIAL_NOTIFICATION_LOGS,
  INITIAL_PROCESS_LOGS,
  INITIAL_STUDENTS,
  INITIAL_USERS,
  sha256Hex,
  SYSTEM_REMINDER_SENDER_EMAIL,
  type StoredAccount,
} from './data/demoSeed';
import {
  calculateCommonDueDate,
  getTokyoDateString,
  mergeBidirectionalCalendarEvents,
  promoteStudentToM2,
  resolveAppliedDueDate,
  type ExternalGoogleCalendarEvent,
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
  processLogs: 'shintyokukanri_v2_process_logs',
  notificationLogs: 'shintyokukanri_v2_notification_logs',
  operationConfig: 'shintyokukanri_v2_operation_config',
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
  const [processLogs, setProcessLogs] = useState<ResearchProcessLogEntry[]>(
    () => loadPersisted(STORAGE_KEYS.processLogs, [...INITIAL_PROCESS_LOGS])
  );
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(
    () =>
      loadPersisted(STORAGE_KEYS.notificationLogs, [
        ...INITIAL_NOTIFICATION_LOGS,
      ])
  );
  const [operationConfig, setOperationConfig] = useState<LabOperationConfig>(
    () =>
      loadPersisted(STORAGE_KEYS.operationConfig, {
        ...INITIAL_LAB_OPERATION_CONFIG,
      })
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
        } else if (e.key === STORAGE_KEYS.processLogs) {
          setProcessLogs(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.notificationLogs) {
          setNotificationLogs(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.operationConfig) {
          setOperationConfig(JSON.parse(e.newValue));
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
      if (remote.processLogs) setProcessLogs(remote.processLogs);
      if (remote.notificationLogs) setNotificationLogs(remote.notificationLogs);
      if (remote.operationConfig) setOperationConfig(remote.operationConfig);
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
        processLogs: next.processLogs ?? processLogs,
        notificationLogs: next.notificationLogs ?? notificationLogs,
        operationConfig: next.operationConfig ?? operationConfig,
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
      processLogs,
      notificationLogs,
      operationConfig,
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

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.processLogs,
        JSON.stringify(processLogs)
      );
    } catch {
      // ignore
    }
  }, [processLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.notificationLogs,
        JSON.stringify(notificationLogs)
      );
    } catch {
      // ignore
    }
  }, [notificationLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.operationConfig,
        JSON.stringify(operationConfig)
      );
    } catch {
      // ignore
    }
  }, [operationConfig]);

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

  // 進捗レコード更新 (#35, #36, #43) — 学生が更新した際に students.updatedAt も自動更新＆研究プロセス履歴へ自動蓄積！
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
    let newProcessEntry: ResearchProcessLogEntry | null = null;

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

      // 変更があった場合は研究プロセスの記録として履歴に蓄積
      if (
        rec.status !== updates.status ||
        rec.personalTargetDate !== updates.personalTargetDate ||
        rec.comment !== updates.comment
      ) {
        newProcessEntry = {
          logId: `plog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: rec.studentId,
          taskId: rec.taskId,
          taskTitle: rec.title,
          category: rec.category,
          grade: rec.historicalGrade,
          previousStatus: rec.status,
          newStatus: updates.status,
          personalTargetDate: updates.personalTargetDate,
          comment: updates.comment,
          recordedAt: nowIso,
          recordedByName: currentUser.displayName,
        };
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
    });

    const nextStudents = targetStudentId
      ? students.map((s) =>
          s.studentId === targetStudentId ? { ...s, updatedAt: nowIso } : s
        )
      : students;

    const nextProcessLogs = newProcessEntry
      ? [newProcessEntry, ...processLogs]
      : processLogs;

    setProgressRecords(nextProgress);
    setStudents(nextStudents);
    setProcessLogs(nextProcessLogs);
    syncToCloud({
      progressRecords: nextProgress,
      students: nextStudents,
      processLogs: nextProcessLogs,
    });
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

  // ② 来年度の管理体制：学生へ管理担当（兼務）権限をワンクリック付与・解除 (#11, #16)
  const handleToggleStudentAdminRole = (
    studentId: string,
    isAdminAlso: boolean
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();

    const nextUsers = { ...usersMap };
    for (const [k, v] of Object.entries(nextUsers)) {
      if (v.profile.studentId === studentId) {
        nextUsers[k] = {
          ...v,
          profile: {
            ...v.profile,
            roles: {
              ...v.profile.roles,
              admin: isAdminAlso,
            },
            updatedAt: nowIso,
          },
        };
      }
    }

    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'CHANGE_ROLE',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: studentId,
        details: { adminRole: isAdminAlso },
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
      ev.eventKey === eventKey
        ? { ...ev, ...updates, updatedAt: nowIso }
        : ev
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

  // ③ 授業・ゼミ・研究室全体行事・研究イベントの追加
  const handleAddAcademicEvent = (
    year: number,
    input: {
      name: string;
      eventCategory: ScheduleEventCategory;
      target: MasterGrade | 'ALL';
      date: string;
      time: string | null;
      calendarDisplay: boolean;
      notes: string;
    }
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();
    const targetYearObj = academicYearsMap[year];
    if (!targetYearObj) return;

    const eventKey = `${input.eventCategory}_${Date.now()}`;
    const newEvent: AcademicEvent = {
      eventKey,
      name: input.name,
      eventCategory: input.eventCategory,
      target: input.target,
      date: input.date,
      time: input.time,
      reminderDays: [7, 3, 0],
      calendarDisplay: input.calendarDisplay,
      notes: input.notes,
      googleCalendarEventId: null,
      syncOrigin: 'WEB_APP',
      updatedAt: nowIso,
    };

    const nextEvents = [...targetYearObj.events, newEvent];
    const nextYears = {
      ...academicYearsMap,
      [year]: {
        ...targetYearObj,
        updatedAt: nowIso,
        events: nextEvents,
      },
    };
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'UPDATE_ACADEMIC_YEAR',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'academicEvent',
        targetId: `${year}_${eventKey}`,
        details: {
          action: 'ADD_EVENT',
          name: input.name,
          category: input.eventCategory,
        },
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setAcademicYearsMap(nextYears);
    setAuditLogs(nextAudit);
    syncToCloud({
      academicYearsMap: nextYears,
      auditLogs: nextAudit,
    });
  };

  // 管理者：スケジュールイベントの削除
  const handleDeleteAcademicEvent = (year: number, eventKey: string) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();
    const targetYearObj = academicYearsMap[year];
    if (!targetYearObj) return;

    const nextEvents = targetYearObj.events.filter(
      (ev) => ev.eventKey !== eventKey
    );
    const nextYears = {
      ...academicYearsMap,
      [year]: {
        ...targetYearObj,
        updatedAt: nowIso,
        events: nextEvents,
      },
    };
    setAcademicYearsMap(nextYears);
    syncToCloud({ academicYearsMap: nextYears });
  };

  // ③ Googleカレンダー双方向同期 (Webアプリ ⇄ Googleカレンダー)
  const handleSyncGoogleCalendarBidirectional = async (
    year: number
  ): Promise<string> => {
    if (!currentUser?.roles.admin) return '管理者権限が必要です。';
    const nowIso = new Date().toISOString();
    const targetYearObj = academicYearsMap[year];
    if (!targetYearObj) return '対象年度が見つかりません。';

    const webhookUrl = operationConfig.gasBridgeWebhookUrl.trim();
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'SYNC_CALENDAR_BIDIRECTIONAL',
            calendarId: operationConfig.googleCalendarId || 'primary',
            events: targetYearObj.events,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          pushedEvents?: Array<{
            eventKey: string;
            googleCalendarEventId: string | null;
            updatedAt: string;
          }>;
          remoteCalendarEvents?: ExternalGoogleCalendarEvent[];
          error?: string;
        };

        if (!data.ok) {
          return `Googleカレンダー同期エラー: ${data.error ?? '不明なエラー'}`;
        }

        // 1. Web -> Google 側で発行された googleCalendarEventId を反映
        const pushedMap = new Map(
          (data.pushedEvents ?? []).map((p) => [p.eventKey, p])
        );
        const eventsWithIds = targetYearObj.events.map((ev) => {
          const pushed = pushedMap.get(ev.eventKey);
          if (!pushed) return ev;
          return {
            ...ev,
            googleCalendarEventId: pushed.googleCalendarEventId,
            updatedAt: pushed.updatedAt || nowIso,
          };
        });

        // 2. Google -> Web 側の変更・新規予定（授業・行事含む）を双方向マージ
        const {
          mergedEvents,
          importedCount,
          updatedFromGoogleCount,
        } = mergeBidirectionalCalendarEvents(
          eventsWithIds,
          data.remoteCalendarEvents ?? []
        );

        const nextYears = {
          ...academicYearsMap,
          [year]: {
            ...targetYearObj,
            updatedAt: nowIso,
            events: mergedEvents,
          },
        };

        // 共通期限の再計算
        const taskMap = new Map(roadmapTasks.map((t) => [t.taskId, t]));
        const nextProgress = progressRecords.map((rec) => {
          const task = taskMap.get(rec.taskId);
          if (!task || !task.baseEventKey) return rec;
          const newCommonDue = calculateCommonDueDate(task, mergedEvents);
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
            action: 'SYNC_GOOGLE_CALENDAR',
            actorUid: currentUser.uid,
            actorEmail: currentUser.email,
            targetType: 'academicYear',
            targetId: String(year),
            details: {
              importedCount,
              updatedFromGoogleCount,
              totalEvents: mergedEvents.length,
            },
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

        return `双方向同期が完了しました（Googleカレンダーから新規取込: ${importedCount}件 / 更新反映: ${updatedFromGoogleCount}件 / Web予定反映: ${mergedEvents.length}件）。`;
      } catch (err) {
        return `GASブリッジ通信に失敗しました: ${String(err)}`;
      }
    }

    // GAS Webhook未設定時は iCalendar (.ics) ファイルを生成して即時ダウンロード提供
    const validEvents = targetYearObj.events.filter(
      (e) => e.calendarDisplay && e.date
    );
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nittai GradLab//ResearchProgress//JP',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    for (const ev of validEvents) {
      const ymd = (ev.date ?? '').replace(/-/g, '');
      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${ev.eventKey}-${year}@nittai.daigakuin`,
        `DTSTAMP:${nowIso.replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${ymd}`,
        `SUMMARY:${ev.name}`,
        `DESCRIPTION:${(ev.notes || '').replace(/\n/g, '\\n')}`,
        'END:VEVENT'
      );
    }
    icsLines.push('END:VCALENDAR');

    try {
      const blob = new Blob([icsLines.join('\r\n')], {
        type: 'text/calendar;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab_schedule_${year}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore in headless test environments
    }

    return `Googleカレンダー取込用ファイル (lab_schedule_${year}.ics: ${validEvents.length}件) を出力しました。「メール通知・送信」タブでGAS Webhook URLを設定すると、ボタン1つで自動双方向同期が動作します。`;
  };

  // ⑤ リマインドメール送信機能の確立（GAS Webhook 自動送信 ＋ メーラー即時送信フォールバック）
  const handleSendReminderEmail = async (params: {
    notificationId: string;
    progressId: string;
    studentId: string;
    studentName: string;
    recipientEmail: string;
    taskId: string;
    taskTitle: string;
    dueDate: string;
    remindDays: number;
  }): Promise<{
    ok: boolean;
    mode: 'GAS_WEBHOOK' | 'MAILTO';
    message: string;
  }> => {
    if (!currentUser?.roles.admin) {
      return {
        ok: false,
        mode: 'MAILTO',
        message: '管理者権限が必要です。',
      };
    }
    const nowIso = new Date().toISOString();
    const subject = `【研究進捗リマインド】${params.taskTitle}（期限: ${params.dueDate}）`;
    const textBody = [
      `${params.studentName} さん`,
      '',
      '大学院研究進捗管理システムからのリマインド連絡です。',
      '以下の研究タスクの期限が近づいています（または到来しています）。',
      '',
      `■ 対象タスク: ${params.taskTitle} (${params.taskId})`,
      `■ 適用期限日: ${params.dueDate}`,
      '',
      'Webアプリにログインし、現在の進捗状況（ステータス・個人目標日・メモ）を更新してください。',
      '',
      '--------------------------------------------------',
      `送信元（管理者・リマインド共通）: ${SYSTEM_REMINDER_SENDER_EMAIL}`,
      '--------------------------------------------------',
    ].join('\n');

    const webhookUrl = operationConfig.gasBridgeWebhookUrl.trim();
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'SEND_EMAIL',
            recipientEmail: params.recipientEmail,
            subject,
            textBody,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        const isSuccess = Boolean(data.ok);

        const newLog: NotificationLog = {
          notificationId: params.notificationId,
          progressId: params.progressId,
          studentId: params.studentId,
          recipientEmail: params.recipientEmail,
          taskId: params.taskId,
          dueDate: params.dueDate,
          remindDays: params.remindDays,
          sentAt: nowIso,
          result: isSuccess ? 'SUCCESS' : 'FAILED',
          errorMessage: isSuccess ? null : (data.error ?? 'GAS送信エラー'),
        };
        const nextNotifLogs = [newLog, ...notificationLogs];
        const nextAudit: AuditLog[] = [
          {
            auditId: `audit-${Date.now()}`,
            action: 'SEND_REMINDER_EMAIL',
            actorUid: currentUser.uid,
            actorEmail: currentUser.email,
            targetType: 'student',
            targetId: params.studentId,
            details: {
              recipientEmail: params.recipientEmail,
              taskId: params.taskId,
              mode: 'GAS_WEBHOOK',
              result: newLog.result,
            },
            createdAt: nowIso,
          },
          ...auditLogs,
        ];

        setNotificationLogs(nextNotifLogs);
        setAuditLogs(nextAudit);
        syncToCloud({
          notificationLogs: nextNotifLogs,
          auditLogs: nextAudit,
        });

        return {
          ok: isSuccess,
          mode: 'GAS_WEBHOOK',
          message: isSuccess
            ? `${params.studentName} (${params.recipientEmail}) へ ${SYSTEM_REMINDER_SENDER_EMAIL} からリマインドメールを自動送信しました。`
            : `自動送信に失敗しました: ${data.error ?? '不明なエラー'}`,
        };
      } catch (err) {
        return {
          ok: false,
          mode: 'GAS_WEBHOOK',
          message: `GAS Webhook への通信に失敗しました: ${String(err)}`,
        };
      }
    }

    // GAS未設定時は mailto: で即座にメーラーを起動し、送信履歴にも記録
    const mailtoUrl = `mailto:${encodeURIComponent(
      params.recipientEmail
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      textBody
    )}`;
    if (typeof window !== 'undefined') {
      window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    }

    const newLog: NotificationLog = {
      notificationId: params.notificationId,
      progressId: params.progressId,
      studentId: params.studentId,
      recipientEmail: params.recipientEmail,
      taskId: params.taskId,
      dueDate: params.dueDate,
      remindDays: params.remindDays,
      sentAt: nowIso,
      result: 'SUCCESS',
      errorMessage: null,
    };
    const nextNotifLogs = [newLog, ...notificationLogs];
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'SEND_REMINDER_EMAIL',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'student',
        targetId: params.studentId,
        details: {
          recipientEmail: params.recipientEmail,
          taskId: params.taskId,
          mode: 'MAILTO',
        },
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setNotificationLogs(nextNotifLogs);
    setAuditLogs(nextAudit);
    syncToCloud({
      notificationLogs: nextNotifLogs,
      auditLogs: nextAudit,
    });

    return {
      ok: true,
      mode: 'MAILTO',
      message: `${params.studentName} (${params.recipientEmail}) 宛のメール作成画面を起動し、送信ログを記録しました（GAS連携URLを設定するとバックグラウンド自動送信になります）。`,
    };
  };

  // ② & ④ 研究室の管理体制・運用ルールの更新
  const handleUpdateOperationConfig = (
    updates: Partial<LabOperationConfig>
  ) => {
    if (!currentUser?.roles.admin) return;
    const nowIso = new Date().toISOString();
    const nextConfig: LabOperationConfig = {
      ...operationConfig,
      ...updates,
      updatedAt: nowIso,
    };
    const nextAudit: AuditLog[] = [
      {
        auditId: `audit-${Date.now()}`,
        action: 'UPDATE_OPERATION_CONFIG',
        actorUid: currentUser.uid,
        actorEmail: currentUser.email,
        targetType: 'operationConfig',
        targetId: 'lab_operation_config',
        details: updates as Record<string, unknown>,
        createdAt: nowIso,
      },
      ...auditLogs,
    ];

    setOperationConfig(nextConfig);
    setAuditLogs(nextAudit);
    syncToCloud({
      operationConfig: nextConfig,
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
  const currentAcademicEvents =
    academicYearsMap[selectedAcademicYear]?.events ??
    DEFAULT_ACADEMIC_EVENTS_2026;

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
            processLogs={processLogs}
            notificationLogs={notificationLogs}
            operationConfig={operationConfig}
            todayTokyo={todayTokyo}
            isCloudConnected={isCloudConnected}
            onSelectAcademicYear={setSelectedAcademicYear}
            onAddAcademicYear={handleAddAcademicYear}
            onCreateStudent={handleCreateStudent}
            onUpdateStudentMeta={handleUpdateStudentMeta}
            onToggleStudentAdminRole={handleToggleStudentAdminRole}
            onPromoteToM2={handlePromoteToM2}
            onToggleAccountActive={handleToggleAccountActive}
            onResetPassword={handleResetPassword}
            onAdminUpdateProgress={handleUpdateProgress}
            onUpdateAcademicEvent={handleUpdateAcademicEvent}
            onAddAcademicEvent={handleAddAcademicEvent}
            onDeleteAcademicEvent={handleDeleteAcademicEvent}
            onSyncGoogleCalendarBidirectional={
              handleSyncGoogleCalendarBidirectional
            }
            onSendReminderEmail={handleSendReminderEmail}
            onUpdateOperationConfig={handleUpdateOperationConfig}
            onAddRoadmapTask={handleAddRoadmapTask}
            onUpdateRoadmapTask={handleUpdateRoadmapTask}
            onDeleteRoadmapTask={handleDeleteRoadmapTask}
          />
        ) : currentStudentRecord ? (
          <StudentDashboard
            student={currentStudentRecord}
            allStudents={students}
            allProgressRecords={progressRecords}
            processLogs={processLogs}
            academicYear={selectedAcademicYear}
            academicEvents={currentAcademicEvents}
            operationConfig={operationConfig}
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
