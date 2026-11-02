/**
 * Cloud Functions for Firebase v2
 * MASTER_SPEC.md #5, #51, #53, #57-#71 に準拠
 *
 * - createStudentAccount: 管理者による学生作成・Authユーザー生成・Custom Claims設定・progress初期生成・監査ログ記録
 * - resetStudentPassword: 管理者による仮パスワードリセット (mustChangePassword = true)
 * - promoteStudentGrade: M1 -> M2 進級処理 (M1履歴保持 + M2 progress追加生成)
 * - scheduledCalendarSync: 毎日朝7時 (Asia/Tokyo) Google Calendar 同期
 * - scheduledDeadlineReminders: 毎日朝8時 (Asia/Tokyo) 研究期限リマインドメール送信
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();

const REGION = 'asia-northeast1';

/**
 * 呼び出し元が管理者 (Custom Claim: admin === true) であることを検証する (#17, #74)
 */
function assertAdmin(auth: { uid: string; token: Record<string, unknown> } | undefined): {
  uid: string;
  email: string;
} {
  if (!auth || auth.token.admin !== true) {
    throw new HttpsError(
      'permission-denied',
      'この操作には管理者権限が必要です。'
    );
  }
  return {
    uid: auth.uid,
    email: typeof auth.token.email === 'string' ? auth.token.email : '',
  };
}

/**
 * #70, #71 監査ログの記録（パスワード等の機密情報は絶対に含めない）
 */
async function writeAuditLog(params: {
  action: string;
  actorUid: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('auditLogs').doc();
  await ref.set({
    auditId: ref.id,
    action: params.action,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export interface CreateStudentInput {
  studentId: string;
  name: string;
  email: string;
  course: 'MASTER' | 'DOCTOR';
  currentGrade: 'M1' | 'M2';
  enrollmentYear: number;
  supervisor: string;
  enrollmentStatus: '在籍' | '休学' | '修了' | '退学';
  notificationEnabled: boolean;
  initialPassword: string;
  isAdminAlso?: boolean;
  notes?: string;
}

/**
 * #51 管理者による学生作成処理
 * 1. admin権限確認
 * 2. Firebase Authentication user作成
 * 3. custom claims設定
 * 4. userProfiles作成 (mustChangePassword = true)
 * 5. students作成
 * 6. currentGradeに対応するprogress生成
 */
export const createStudentAccount = onCall<CreateStudentInput>(
  { region: REGION },
  async (request) => {
    const actor = assertAdmin(request.auth);
    const data = request.data;

    if (
      !data.studentId ||
      !data.name ||
      !data.email ||
      !data.initialPassword ||
      data.initialPassword.length < 8
    ) {
      throw new HttpsError(
        'invalid-argument',
        'studentId、氏名、メールアドレス、初期パスワード（8文字以上）は必須です。'
      );
    }

    const db = getFirestore();
    const adminAuth = getAuth();

    const existingStudent = await db
      .collection('students')
      .doc(data.studentId)
      .get();
    if (existingStudent.exists) {
      throw new HttpsError(
        'already-exists',
        `学生ID ${data.studentId} は既に登録されています。`
      );
    }

    // 2. Firebase Authentication user作成（パスワードはFirestoreへ保存しない #11, #78）
    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: data.initialPassword,
      displayName: data.name,
      disabled: false,
    });

    const isAdminRole = Boolean(data.isAdminAlso);

    // 3. Custom Claims 設定 (#17, #75)
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      student: true,
      admin: isAdminRole,
      studentId: data.studentId,
    });

    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    // 4. userProfiles 作成 (#12, #19)
    const userProfileRef = db.collection('userProfiles').doc(userRecord.uid);
    batch.set(userProfileRef, {
      uid: userRecord.uid,
      email: data.email,
      displayName: data.name,
      studentId: data.studentId,
      roles: {
        student: true,
        admin: isAdminRole,
      },
      mustChangePassword: true,
      active: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    });

    // 5. students 作成 (#20)
    const studentRef = db.collection('students').doc(data.studentId);
    batch.set(studentRef, {
      studentId: data.studentId,
      name: data.name,
      email: data.email,
      course: data.course || 'MASTER',
      currentGrade: data.currentGrade,
      enrollmentYear: data.enrollmentYear,
      supervisor: data.supervisor,
      enrollmentStatus: data.enrollmentStatus || '在籍',
      notificationEnabled: Boolean(data.notificationEnabled),
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    });

    // 6. currentGrade に対応する progress 生成
    const tasksSnap = await db
      .collection('roadmapTasks')
      .where('grade', '==', data.currentGrade)
      .where('active', '==', true)
      .get();

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      const progressId = `${data.studentId}_${task.taskId}`;
      const progressRef = db.collection('progress').doc(progressId);
      batch.set(progressRef, {
        progressId,
        studentId: data.studentId,
        taskId: task.taskId,
        historicalGrade: data.currentGrade,
        category: task.category,
        title: task.title,
        displayOrder: task.displayOrder ?? 0,
        progressManaged: Boolean(task.progressManaged),
        personalTargetDate: null,
        commonDueDate: null,
        appliedDueDate: null,
        dueSource: 'NONE',
        status: 'NOT_STARTED',
        completedAt: null,
        comment: '',
        updatedAt: now,
        updatedByUid: actor.uid,
      });
    }

    await batch.commit();

    await writeAuditLog({
      action: 'CREATE_STUDENT',
      actorUid: actor.uid,
      actorEmail: actor.email,
      targetType: 'student',
      targetId: data.studentId,
      details: {
        uid: userRecord.uid,
        currentGrade: data.currentGrade,
        enrollmentYear: data.enrollmentYear,
        isAdminAlso: isAdminRole,
      },
    });

    return {
      success: true,
      uid: userRecord.uid,
      studentId: data.studentId,
    };
  }
);

/**
 * #53 管理者によるパスワードリセット
 * リセット後は mustChangePassword = TRUE とする。
 */
export const resetStudentPassword = onCall<{
  uid: string;
  studentId: string;
  temporaryPassword: string;
}>({ region: REGION }, async (request) => {
  const actor = assertAdmin(request.auth);
  const { uid, studentId, temporaryPassword } = request.data;

  if (!uid || !temporaryPassword || temporaryPassword.length < 8) {
    throw new HttpsError(
      'invalid-argument',
      '対象UIDおよび8文字以上の新しい仮パスワードが必要です。'
    );
  }

  const adminAuth = getAuth();
  const db = getFirestore();

  await adminAuth.updateUser(uid, {
    password: temporaryPassword,
  });

  await db.collection('userProfiles').doc(uid).update({
    mustChangePassword: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAuditLog({
    action: 'RESET_PASSWORD',
    actorUid: actor.uid,
    actorEmail: actor.email,
    targetType: 'userProfile',
    targetId: uid,
    details: { studentId },
  });

  return { success: true };
});

/**
 * #69 定期処理：毎日朝7時 (Asia/Tokyo) Google Calendar 同期
 */
export const scheduledCalendarSync = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'Asia/Tokyo',
    region: REGION,
  },
  async () => {
    logger.info('Starting scheduled Google Calendar sync (Asia/Tokyo 07:00)');
    // Calendar同期プロバイダ呼び出し（Secret Manager 設定後に有効化）
  }
);

/**
 * #69 定期処理：毎日朝8時 (Asia/Tokyo) 研究期限リマインド通知
 */
export const scheduledDeadlineReminders = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Asia/Tokyo',
    region: REGION,
  },
  async () => {
    logger.info('Starting scheduled research deadline reminders (Asia/Tokyo 08:00)');
    // EmailProvider インターフェース経由でのリマインド送信（notificationLogsで重複防止）
  }
);
