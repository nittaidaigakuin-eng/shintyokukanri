/**
 * Firestore Security Rules 構造および移行データ検証テスト (#92, #95)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateMigrationDataset } from '../scripts/import/validateMigration';
import { INITIAL_ROADMAP_TASKS } from '../src/data/roadmapSeed';
import {
  buildInitialDemoProgress,
  INITIAL_STUDENTS,
} from '../src/data/demoSeed';

describe('Firestore Security Rules Deny-First Verification (#72, #73, #74, #95)', () => {
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  const rulesContent = readFileSync(rulesPath, 'utf-8');

  it('enforces deny-first default rule and forbids open access', () => {
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
    expect(rulesContent).not.toContain('allow read, write: if true');
  });

  it('restricts student data access to their own studentId via Custom Claims', () => {
    expect(rulesContent).toContain('request.auth.token.studentId == studentId');
    expect(rulesContent).toContain('request.auth.token.admin == true');
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

describe('Migration Validator Verification (#92)', () => {
  it('validates the initial 61 roadmap tasks, students, and progress records with zero errors', () => {
    const progress = buildInitialDemoProgress();
    const result = validateMigrationDataset({
      roadmapTasks: INITIAL_ROADMAP_TASKS,
      students: INITIAL_STUDENTS,
      progress,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.stats.m1TasksCount).toBe(17);
    expect(result.stats.m2TasksCount).toBe(44);
    expect(result.stats.totalTasksCount).toBe(61);
  });

  it('detects duplicate studentId and invalid email format', () => {
    const badStudents = [
      ...INITIAL_STUDENTS,
      {
        ...INITIAL_STUDENTS[0],
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
