/**
 * Cloud Firestore リアルタイム同期 & 永続化ブリッジ
 * - Firebase環境変数 (VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID) または管理画面で設定された firebaseConfig が存在する場合、
 *   Cloud Firestore (doc: appState/main) を Source of Truth として onSnapshot で全端末（学生PC/スマホ ⇄ 管理者PC）にリアルタイム同期する。
 * - 同一ブラウザの別タブ間でも storage イベントで即座に同期する。
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  AcademicYear,
  AuditLog,
  ProgressRecord,
  RoadmapTask,
  Student,
} from '../../types/domain';
import type { StoredAccount } from '../../data/demoSeed';

export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface SharedAppState {
  usersMap: Record<string, StoredAccount>;
  students: Student[];
  roadmapTasks: RoadmapTask[];
  academicYearsMap: Record<number, AcademicYear>;
  selectedAcademicYear: number;
  progressRecords: ProgressRecord[];
  auditLogs: AuditLog[];
  updatedAt: string;
}

const RUNTIME_FIREBASE_CONFIG_KEY = 'shintyokukanri_firebase_config_v1';

export function getActiveFirebaseConfig(): FirebaseRuntimeConfig | null {
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (
    envApiKey &&
    envApiKey !== 'your_api_key_here' &&
    envProjectId &&
    envProjectId !== 'your_project_id'
  ) {
    return {
      apiKey: envApiKey,
      authDomain:
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
        `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
  }

  try {
    const raw = localStorage.getItem(RUNTIME_FIREBASE_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseRuntimeConfig;
    if (parsed.apiKey && parsed.projectId) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveRuntimeFirebaseConfig(config: FirebaseRuntimeConfig): void {
  localStorage.setItem(RUNTIME_FIREBASE_CONFIG_KEY, JSON.stringify(config));
}

export function clearRuntimeFirebaseConfig(): void {
  localStorage.removeItem(RUNTIME_FIREBASE_CONFIG_KEY);
}

let firestoreInstance: Firestore | null = null;

function getOrInitFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;
  const cfg = getActiveFirebaseConfig();
  if (!cfg) return null;

  try {
    const existing = getApps().find((a) => a.name === 'realtime-sync');
    const app: FirebaseApp =
      existing ?? initializeApp(cfg, 'realtime-sync');
    firestoreInstance = getFirestore(app);
    return firestoreInstance;
  } catch {
    return null;
  }
}

export function subscribeSharedAppState(
  onReceive: (state: SharedAppState) => void,
  onError?: (err: string) => void
): Unsubscribe | null {
  const db = getOrInitFirestore();
  if (!db) return null;

  const stateDocRef = doc(db, 'appConfig', 'sharedAppState');
  return onSnapshot(
    stateDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SharedAppState;
        onReceive(data);
      }
    },
    (err) => {
      if (onError) onError(err.message);
    }
  );
}

export async function pushSharedAppState(
  state: SharedAppState
): Promise<boolean> {
  const db = getOrInitFirestore();
  if (!db) return false;
  try {
    const stateDocRef = doc(db, 'appConfig', 'sharedAppState');
    await setDoc(stateDocRef, state, { merge: true });
    return true;
  } catch {
    return false;
  }
}
