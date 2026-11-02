# DATA_MODEL.md — Firestore データモデル仕様書

本ドキュメントは `docs/MASTER_SPEC.md` に基づく Cloud Firestore のコレクション設計・フィールド型・整合性ルールを定義する。

---

## 1. コレクション一覧

```text
/userProfiles/{uid}
/students/{studentId}
/roadmapTasks/{taskId}
/academicYears/{year}
/academicYears/{year}/events/{eventKey}
/progress/{progressId}               // Document ID: {studentId}_{taskId}
/notificationLogs/{notificationId}   // Document ID: {studentId}_{taskId}_{dueDate}_{remindDays}
/calendarSync/{syncKey}
/auditLogs/{auditId}
/appConfig/{configKey}
```

---

## 2. 各コレクション詳細

### 2.1 `userProfiles`
- **Document ID**: Firebase Authentication `uid`
- **用途**: ログインユーザーのプロフィール、ロール表示情報、初回パスワード変更フラグの管理。
- **注意**: パスワードそのものは絶対に保存しない。認可判定の主軸は Custom Claims (`request.auth.token`) とする。

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `uid` | `string` | YES | Firebase Authentication UID |
| `email` | `string` | YES | ログイン用メールアドレス |
| `displayName` | `string` | YES | 表示名（学生氏名または管理者名） |
| `studentId` | `string \| null` | YES | 学生ID（例: `S001`、純粋な管理者の場合は `null`） |
| `roles` | `object` | YES | `{ student: boolean, admin: boolean, teacher?: boolean }` |
| `mustChangePassword` | `boolean` | YES | 初回ログイン時または管理者PWリセット直後は `true`、本人変更後に `false` |
| `active` | `boolean` | YES | アカウント有効状態（退学・修了等で停止する場合は `false`） |
| `createdAt` | `Timestamp` | YES | 作成日時 |
| `updatedAt` | `Timestamp` | YES | 更新日時 |
| `lastLoginAt` | `Timestamp \| null` | YES | 最終ログイン日時 |

---

### 2.2 `students`
- **Document ID**: `studentId`（例: `S001`）
- **用途**: 学生マスター情報。`studentId` は進級・メール変更・パスワード変更等で一切変更しない安定したIDとする。

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `studentId` | `string` | YES | 学生ID（Document IDと同一） |
| `name` | `string` | YES | 氏名 |
| `email` | `string` | YES | メールアドレス |
| `course` | `'MASTER' \| 'DOCTOR'` | YES | 課程（現在主対象は修士課程 `'MASTER'`、将来博士課程 `'DOCTOR'` 拡張可能） |
| `currentGrade` | `'M1' \| 'M2' \| 'D1' \| 'D2' \| 'D3'` | YES | 現在学年（修士は `'M1'`, `'M2'`） |
| `enrollmentYear` | `number` | YES | 入学年度（例: `2026`） |
| `supervisor` | `string` | YES | 指導教員名 |
| `enrollmentStatus` | `'在籍' \| '休学' \| '修了' \| '退学'` | YES | 在籍状態 |
| `notificationEnabled` | `boolean` | YES | 通知メール送信対象かどうか |
| `notes` | `string` | YES | 備考（空文字可） |
| `createdAt` | `Timestamp` | YES | 登録日時 |
| `updatedAt` | `Timestamp` | YES | 更新日時 |

---

### 2.3 `roadmapTasks`
- **Document ID**: `taskId`（旧システムのIDを完全維持。M1: 17件、M2: 44件、計61件）
- **用途**: 全学生共通の研究ロードマップ定義。学生ごとに別ロードマップは作らない。

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `taskId` | `string` | YES | タスクID（不変） |
| `grade` | `'M1' \| 'M2'` | YES | 対象学年 |
| `category` | `string` | YES | カテゴリ（例: 研究計画、倫理申請、中間発表、論文審査 等） |
| `title` | `string` | YES | タスク項目名 |
| `studentAction` | `string` | YES | 学生が取るべき具体的行動 |
| `requirement` | `string` | YES | 要件・必須区分 |
| `deadlineType` | `'PERSONAL' \| 'COMMON_EVENT' \| 'COMMON_FIXED' \| 'NONE'` | YES | 期限種別 |
| `baseEventKey` | `string \| null` | YES | 基準となる年度イベントの `eventKey` |
| `offsetDays` | `number \| null` | YES | 基準イベント日からの相対日数 |
| `deadlineRule` | `'EXACT' \| 'PREVIOUS_MONDAY' \| 'MANUAL' \| 'NONE'` | YES | 期限算出ルール（`PREVIOUS_MONDAY` = 直前月曜） |
| `guideline` | `string` | YES | 時期目安・ガイドライン |
| `progressManaged` | `boolean` | YES | 進捗率計算の対象とするか（`true` のみ進捗率計算に含める） |
| `adminOnlyEdit` | `boolean` | NO | `true` の場合、管理者のみ状態変更可能（拡張用余地） |
| `reminderPattern` | `number[]` | YES | リマインド日数配列（基本: `[14, 7, 3, 0]`） |
| `calendarDisplay` | `boolean` | YES | カレンダー表示対象か |
| `displayOrder` | `number` | YES | 表示順序 |
| `notes` | `string` | YES | 備考 |
| `active` | `boolean` | YES | 有効フラグ |

---

### 2.4 `academicYears` およびサブコレクション `events`
- **Document ID**: 年度文字列（例: `2026`）
- **Subcollection**: `/academicYears/{year}/events/{eventKey}`
- **用途**: 共通公式予定の **Source of Truth**。Google Calendar への同期元、および M2 等の共通期限 (`commonDueDate`) の計算基準となる。

#### `/academicYears/{year}`
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `year` | `number` | YES | 年度（例: `2026`） |
| `isCurrent` | `boolean` | YES | 現在アクティブな年度かどうか |
| `updatedAt` | `Timestamp` | YES | 更新日時 |

#### `/academicYears/{year}/events/{eventKey}`
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `eventKey` | `string` | YES | イベント識別キー |
| `name` | `string` | YES | イベント名 |
| `target` | `'M1' \| 'M2' \| 'ALL'` | YES | 対象学年 |
| `date` | `string \| null` | YES | 日付（`YYYY-MM-DD` 形式、未定時は `null`） |
| `time` | `string \| null` | YES | 時刻（`HH:mm` 形式、終日または未定時は `null`） |
| `reminderDays` | `number[]` | YES | リマインド日数配列 |
| `calendarDisplay` | `boolean` | YES | Google Calendar 同期対象フラグ |
| `notes` | `string` | YES | 備考 |

---

### 2.5 `progress`
- **Document ID**: `{studentId}_{taskId}`（例: `S001_M1-01`）
- **用途**: 学生ごとの各ロードマップタスク進捗。
- **最重要ルール**:
  - `historicalGrade` はそのタスクが属する歴史的学年（`M1` または `M2`）を保持する。M1→M2進級時にM1タスクの `historicalGrade` を `M2` に書き換えてはならない。
  - **残日数 (`remainingDays`) や期限判定ラベルは毎日変化するため Firestore に固定値として保存しない**（クライアント表示時およびサーバー定期処理時に `Asia/Tokyo` 基準で動的計算する）。

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `progressId` | `string` | YES | `{studentId}_{taskId}` |
| `studentId` | `string` | YES | 学生ID |
| `taskId` | `string` | YES | ロードマップタスクID |
| `historicalGrade` | `'M1' \| 'M2'` | YES | タスクが属する歴史的学年（不変） |
| `category` | `string` | YES | カテゴリ名 |
| `title` | `string` | YES | タスク項目名 |
| `displayOrder` | `number` | YES | 表示順序 |
| `progressManaged` | `boolean` | YES | 進捗率計算対象フラグ |
| `personalTargetDate` | `string \| null` | YES | 個人目標日（`YYYY-MM-DD` または `null`） |
| `commonDueDate` | `string \| null` | YES | 年度設定から自動計算された共通期限（`YYYY-MM-DD` または `null`） |
| `appliedDueDate` | `string \| null` | YES | 適用期限（`personalTargetDate ?? commonDueDate ?? null`） |
| `dueSource` | `'PERSONAL' \| 'COMMON' \| 'NONE'` | YES | 適用期限のソース |
| `status` | `'NOT_STARTED' \| 'IN_PROGRESS' \| 'COMPLETED' \| 'ON_HOLD'` | YES | 進捗状態（未着手 / 進行中 / 完了 / 保留） |
| `completedAt` | `Timestamp \| null` | YES | 完了日時（`COMPLETED` 変更時にサーバー時刻を自動セット、他状態へ戻した時は `null`） |
| `comment` | `string` | YES | 学生・管理者コメント |
| `updatedAt` | `Timestamp` | YES | 最終更新日時 |
| `updatedByUid` | `string` | YES | 最終更新者の Firebase UID |

---

### 2.6 `notificationLogs`
- **Document ID**: `{studentId}_{taskId}_{dueDate}_{remindDays}`
- **用途**: 通知メール送信履歴および重複送信防止。`result === 'SUCCESS'` の場合は再送しない。`FAILED` の場合は再試行可能。

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `notificationId` | `string` | YES | `{studentId}_{taskId}_{dueDate}_{remindDays}` |
| `progressId` | `string` | YES | 対象 `progressId` |
| `studentId` | `string` | YES | 学生ID |
| `taskId` | `string` | YES | タスクID |
| `dueDate` | `string` | YES | 通知時点の `appliedDueDate` (`YYYY-MM-DD`) |
| `remindDays` | `number` | YES | 何日前通知か（`14`, `7`, `3`, `0` 等） |
| `recipientEmail` | `string` | YES | 送信先メールアドレス |
| `sentAt` | `Timestamp` | YES | 送信処理日時 |
| `result` | `'SUCCESS' \| 'FAILED'` | YES | 送信結果 |
| `errorMessage` | `string \| null` | YES | エラー詳細（成功時は `null`） |

---

### 2.7 `calendarSync`
- **Document ID**: `syncKey`（例: `{year}_{eventKey}`）
- **用途**: 年度設定の公式イベントと Google Calendar イベントの紐付け・重複防止。

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `syncKey` | `string` | YES | `{year}_{eventKey}` |
| `year` | `number` | YES | 年度 |
| `eventKey` | `string` | YES | イベントキー |
| `calendarEventId` | `string \| null` | YES | Google Calendar 側の eventId |
| `lastSyncedAt` | `Timestamp` | YES | 最終同期日時 |
| `result` | `'SUCCESS' \| 'DELETED' \| 'FAILED'` | YES | 同期結果 |
| `errorMessage` | `string \| null` | YES | エラーメッセージ |

---

### 2.8 `auditLogs`
- **Document ID**: 自動生成ID
- **用途**: 管理者による重要操作の監査証跡。改ざん・削除不可。

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `auditId` | `string` | YES | ドキュメントID |
| `action` | `string` | YES | 操作種別（`CREATE_STUDENT`, `DEACTIVATE_STUDENT`, `CHANGE_ROLE`, `RESET_PASSWORD`, `UPDATE_ACADEMIC_YEAR`, `UPDATE_ROADMAP`, `ADMIN_UPDATE_PROGRESS` 等） |
| `actorUid` | `string` | YES | 実行者の Firebase UID |
| `actorEmail` | `string` | YES | 実行者のメールアドレス |
| `targetType` | `string` | YES | 対象リソース種別（`student`, `userProfile`, `academicYear`, `roadmapTask`, `progress`） |
| `targetId` | `string` | YES | 対象リソースID |
| `details` | `Record<string, unknown>` | YES | 変更差分やメタ情報（パスワード等の機密情報は絶対に含めない） |
| `createdAt` | `Timestamp` | YES | 実行日時 |

---

### 2.9 `appConfig`
- **Document ID**: `system` 等
- **用途**: 現在年度（`currentAcademicYear`）、長期未更新アラート閾値日数（例: 30日）、共通Google Calendar ID等のシステム全体設定。
