# MIGRATION.md — 旧システム（Spreadsheet）からのデータ移行仕様書

`docs/MASTER_SPEC.md` (#84〜#92) に基づき、旧 Google Apps Script + Spreadsheet システムから新 Firebase (Cloud Firestore) へのデータ移行手順と検証基準を定義する。

---

## 1. 基本方針

- **旧GASコードは一切移植しない**。移行対象は「正式データ」のみ。
- 旧システムは新システムの稼働・安定が確認されるまで削除せず保持する。
- Phase 9 で旧システムに追加された認証関連データ（旧パスワードやOTP履歴等）は**新システムへ引き継がない**。Firebase Authentication ユーザーは新システム側で新規作成する。

---

## 2. 旧 Spreadsheet シート構造仕様

### 2.1 修士ロードマップ (`roadmapTasks`)
- **件数基準**: M1 = **17件**、M2 = **44件**、合計 = **61件**
- **ルール**: 既存の `taskId` を絶対に変更しない。

### 2.2 年度設定 (`academicYears/{year}/events`)
- **年度セル**: `B4`
- **ヘッダー行**: 第6行（データ：第7行以降）
- **列構成**:
  1. `event_key`
  2. `イベント名` (`name`)
  3. `対象` (`target`)
  4. `日付（入力）` (`date`)
  5. `時刻（入力）` (`time`)
  6. `通知日数` (`reminderDays`)
  7. `カレンダー表示` (`calendarDisplay`)
  8. `入力状況`
  9. `備考` (`notes`)

### 2.3 学生マスター (`students`)
- **ヘッダー行**: 第4行（データ：第5行以降）
- **正式DB範囲**: `A:N`（14列）
  - `A`: `student_id` (`studentId`)
  - `B`: `氏名` (`name`)
  - `C`: `メールアドレス` (`email`)
  - `D`: `課程` (`course`)
  - `E`: `学年` (`currentGrade`)
  - `F`: `入学年度` (`enrollmentYear`)
  - `G`: `指導教員` (`supervisor`)
  - `H`: `在籍状態` (`enrollmentStatus`)
  - `I`: `利用権限` (`roles`)
  - `J`: `通知有効` (`notificationEnabled`)
  - `K`: `登録日` (`createdAt`)
  - `L`: `更新日` (`updatedAt`)
  - `M`: `備考` (`notes`)
  - `N`: `最終ログイン` (`lastLoginAt`)

### 2.4 学生進捗 (`progress`)
- **ヘッダー行**: 第1行（データ：第2行以降）
- **正式DB範囲**: `A:Q`（17列）
  - `A`: `progress_id` (`progressId` = `{studentId}_{taskId}`)
  - `B`: `student_id` (`studentId`)
  - `C`: `task_id` (`taskId`)
  - `D`: `氏名`
  - `E`: `学年` (**`historicalGrade` として保存**)
  - `F`: `カテゴリ` (`category`)
  - `G`: `項目名` (`title`)
  - `H`: `個人目標日` (`personalTargetDate`)
  - `I`: `共通期限` (`commonDueDate`)
  - `J`: `適用期限` (`appliedDueDate`)
  - `K`: `期限ソース` (`dueSource`)
  - `L`: `状態` (`status`)
  - `M`: `完了日` (`completedAt`)
  - `N`: `コメント` (`comment`)
  - `O`: `更新日時` (`updatedAt`)
  - `P`: `残日数`（※Firestoreには固定保存せず動的計算へ移行）
  - `Q`: `期限判定`（※Firestoreには固定保存せず動的計算へ移行）

---

## 3. 移行実行順序

`scripts/import/` 配下のインポートスクリプトを用いて、必ず以下の順序で移行を実行する：

```text
Step 1: roadmapTasks (全61件: M1=17, M2=44)
  ↓
Step 2: academicYears / events (年度および公式イベント日程)
  ↓
Step 3: students & Firebase Auth / userProfiles (学生マスター登録＋初期アカウント発行)
  ↓
Step 4: progress (M1履歴・現在学年進捗のインポートと期限再計算検証)
```

---

## 4. 移行後の必須検証項目（バリデーションチェックリスト）

インポートスクリプト実行時に以下の自動検証を行い、1項目でも不一致があればエラーとして報告する：

1. **ロードマップ件数検証**: `M1 == 17` 件、`M2 == 44` 件、合計 `61` 件であること。
2. **学生ID重複・欠損なし**: 全学生の `studentId` が一意であり、空値がないこと。
3. **メールアドレス形式検証**: RFC準拠の有効なメールアドレス形式であり、重複がないこと。
4. **進捗レコード件数整合性**: 各学生の対象学年分の `progress` が欠損なく存在すること。
5. **M1履歴保持検証**: M2学生の過去M1進捗データの `historicalGrade` が `'M1'` のまま保持されており、M2進捗率の分母に混入していないこと。
6. **期限優先ロジック検証**: 全 `progress` について `personalTargetDate` がある場合は `appliedDueDate == personalTargetDate` (`dueSource == 'PERSONAL'`)、ない場合は `commonDueDate` が正しく適用されていること。
