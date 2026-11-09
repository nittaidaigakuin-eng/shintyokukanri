/**
 * Firestore Security Rules 構造および移行データ検証テスト (#92, #95)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateMigrationDataset } from '../scripts/import/validateMigration';
import { INITIAL_ROADMAP_TASKS } from '../src/data/roadmapSeed';
import {
  INITIAL_ADMIN_PASSWORD_SHA256,
  INITIAL_STUDENTS,
  INITIAL_USERS,
  sha256Hex,
  SYSTEM_ADMIN_EMAIL,
  SYSTEM_REMINDER_SENDER_EMAIL,
} from '../src/data/demoSeed';
import type { Student } from '../src/types/domain';

describe('Firestore Security Rules Deny-First Verification (#72, #73, #74, #95)', () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const rulesContent = readFileSync(rulesPath, 'utf-8');

  it('enforces deny-first default rule and forbids open access', () => {
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
    expect(rulesContent).not.toContain('allow read, write: if true');
  });

  it('allows lab students to read peer progress while strictly locking updates to their own studentId', () => {
    expect(rulesContent).toContain('request.auth.token.studentId == studentId');
    expect(rulesContent).toContain('request.auth.token.admin == true');
    expect(rulesContent).toContain('allow read: if isAdmin() || isStudent();');
    expect(rulesContent).toContain('isOwnStudentId(resource.data.studentId)');
  });

  it('prevents students from mutating historicalGrade, studentId, taskId, or roles', () => {
    expect(rulesContent).toContain(
      'request.resource.data.historicalGrade == resource.data.historicalGrade'
    );
    expect(rulesContent).toContain(
      'request.resource.data.roles == resource.data.roles'
    );
  });
});

describe('System Configuration & Clean Initial State Verification', () => {
  it('starts with 0 demo students and configures nittai.daigakuin@gmail.com as admin & reminder sender', async () => {
    expect(INITIAL_STUDENTS).toHaveLength(0);
    expect(SYSTEM_ADMIN_EMAIL).toBe('nittai.daigakuin@gmail.com');
    expect(SYSTEM_REMINDER_SENDER_EMAIL).toBe('nittai.daigakuin@gmail.com');

    const adminEntry = INITIAL_USERS[SYSTEM_ADMIN_EMAIL];
    expect(adminEntry).toBeDefined();
    expect(adminEntry.profile.displayName).toBe('管理者');
    expect(adminEntry.profile.roles.admin).toBe(true);
    expect(adminEntry.passwordHash).toBe(INITIAL_ADMIN_PASSWORD_SHA256);

    const computed = await sha256Hex('nittaidai19851008daigakuin');
    expect(computed).toBe(INITIAL_ADMIN_PASSWORD_SHA256);
  });
});

describe('Migration Validator Verification (#92)', () => {
  it('validates the initial 61 roadmap tasks with zero errors', () => {
    const result = validateMigrationDataset({
      roadmapTasks: INITIAL_ROADMAP_TASKS,
      students: [],
      progress: [],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.stats.m1TasksCount).toBe(17);
    expect(result.stats.m2TasksCount).toBe(44);
    expect(result.stats.totalTasksCount).toBe(61);
  });

  it('detects duplicate studentId and invalid email format', () => {
    const sampleStudent: Student = {
      studentId: 'S001',
      name: 'テスト学生',
      email: 's001@example.ac.jp',
      course: 'MASTER',
      currentGrade: 'M1',
      enrollmentYear: 2026,
      supervisor: '未設定',
      enrollmentStatus: '在籍',
      notificationEnabled: true,
      notes: '',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    };
    const badStudents: Student[] = [
      sampleStudent,
      {
        ...sampleStudent,
        email: 'invalid-email-format',
      },
    ];
    const result = validateMigrationDataset({
      roadmapTasks: INITIAL_ROADMAP_TASKS,
      students: badStudents,
      progress: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('studentId の重複'))).toBe(true);
    expect(result.errors.some((e) => e.includes('不正なメールアドレス形式'))).toBe(
      true
    );
  });
});
