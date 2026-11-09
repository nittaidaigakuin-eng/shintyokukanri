# DECISIONS.md — 設計判断および仕様決定記録

本ドキュメントは、`docs/MASTER_SPEC.md` を補足する技術的判断、およびユーザー承認を得た仕様決定事項を時系列で記録する。

---

## 記録フォーマット

新しい決定事項を追記する際は以下の形式を使用する：

```markdown
## [YYYY-MM-DD] タイトル
- **ステータス**: 承認済 / 仕様書範囲内の技術選択
- **背景・現在の仕様**:
- **決定内容**:
- **メリット / デメリット**:
- **影響範囲**:
```

---

## [2026-11-03] 初期開発基盤の技術構成選定（仕様書範囲内）
- **ステータス**: 仕様書範囲内の技術選択
- **背景**: `MASTER_SPEC.md` (#5, #100, #116) に基づく初期プロジェクト構築。
- **決定内容**:
  - **ビルドツール**: Vite + React 19 + TypeScript
  - **スタイリング**: Tailwind CSS + Lucide React（軽量アイコンライブラリ）
  - **テストフレームワーク**: Vitest（高速なTypeScriptネイティブ実行、ドメインロジックおよびFirestore Rulesテストに利用）
  - **タイムゾーン処理**: `Asia/Tokyo` 基準の日付計算を共通ユーティリティ (`src/lib/dateUtils.ts`) に集約し、ブラウザのローカルタイムゾーン設定に依存しない日付文字列 (`YYYY-MM-DD`) ベースで残日数・直前月曜を計算する。
- **影響範囲**: リポジトリ全体（`src/`, `functions/`, `tests/`）

---

## [2026-11-03] GitHub共同開発アカウントおよび無料静的ホスティング（Pages / Spark）運用方針
- **ステータス**: 承認済（ユーザー指示に基づく決定）
- **背景・現在の仕様**:
  - GitHubリポジトリは大学院アカウント (`nittaidaigakuin-eng/shintyokukanri`) 所有のPrivateリポジトリとし、日常のコード編集・Push作業をスムーズに行うため個人開発アカウント (`shun05110511-cmyk`) をCollaboratorとして追加。
  - ホスティングにおいて従量課金が発生しうるWorkers / App Hostingではなく、完全無料枠で運用可能な静的Pages（Cloudflare Pages または Firebase Hosting Spark枠）を利用したい。
- **決定内容**:
  - `public/_redirects` (`/* /index.html 200`) を同梱し、Cloudflare Pages 等の静的Pagesホスティングおよび Firebase Hosting の双方に無課金でデプロイ可能な構成とする。
  - クライアントから管理者自身が「学生作成・初期進捗生成・年度設定更新・進級処理」を行えるよう、Cloud Functions未デプロイ環境（Spark無料プラン環境）でもセカンダリFirebase Appインスタンス＋Firestore Security Rules（`isAdmin()`）を用いて安全に完結できるハイブリッド実装を採用する。
- **メリット / デメリット**:
  - **メリット**: Blaze従量課金やWorkers課金なしで本番運用・開発テストが完結し、固定費・従量費0円で運用可能。
  - **デメリット**: 毎日定時の自動バッチ（朝7時・8時のCloud Scheduler）のみ、将来必要になった時点でCloud FunctionsまたはGitHub Actions cronを選択する。
- **影響範囲**: `public/_redirects`, `src/lib/firebase/`, `docs/DECISIONS.md`

---

## [2026-11-09] 研究室フィードバック反映（学生間の進捗共有・来年度管理体制・Googleカレンダー双方向連携・研究プロセス蓄積・メール送信機能の確立）
- **ステータス**: 承認済（ユーザー指示および研究室意見に基づく仕様拡張）
- **背景・現在の仕様**:
  - ① 研究室内の情報共有を活性化するため、学生権限でも同じ研究室に所属する他学生の進捗状況を閲覧（Read-only）できるようにしたい。
  - ② 来年度（菊水・立山など）の運用を見据え、誰が進捗確認・年間スケジュール登録・タスク更新・情報修正を担うかの管理体制を明確化し、学生への管理担当（兼務）権限の付与をワンクリックで行えるようにしたい。
  - ③ 研究予定（`OFFICIAL`）だけでなく授業・ゼミ（`CLASS`）や研究室全体行事（`LAB_EVENT`）も一元管理し、Webアプリ ⇄ Googleカレンダーの双方向連携を実現したい。
  - ④ 継続運用のための更新タイミング・全体確認ルールをアプリ内に明示するとともに、単なる現在ステータスだけでなく「研究がどのような過程で進んできたか（研究プロセス履歴）」を時系列で蓄積・振り返り可能にしたい。
  - ⑤ `nittai.daigakuin@gmail.com` から各学生の個別メールアドレス宛てにリマインドメールを送る機能を確立したい。
- **決定内容**:
  - **① 学生間の進捗共有**: `firestore.rules` の `students` / `progress` の `allow read` を `isAdmin() || isStudent()` に拡張（更新 `allow update` は引き続き本人の `studentId` のみに厳格制限）。学生画面に「研究室メンバーの進捗状況」タブを追加。
  - **② 来年度の管理体制明確化**: `LabOperationConfig` を新設し、主管理者・学生管理担当（初期例：菊水・立山）・4つの役割分担（進捗確認／年間スケジュール登録／タスク更新／情報修正）を管理・表示。学生一覧からワンクリックで `兼務 (student + admin)` を切替可能にした。
  - **③ Googleカレンダー双方向連携・スケジュール一元管理**: `AcademicEvent` に区分（`OFFICIAL` / `CLASS` / `LAB_EVENT`）と双方向同期メタデータを追加し、`mergeBidirectionalCalendarEvents` による双方向マージ、Googleカレンダー埋め込み表示、iCalendar (`.ics`) 出力、GASブリッジ連携を実装。
  - **④ 運用ルール明示・研究プロセス記録の蓄積**: 進捗やコメントを更新するたびに `ResearchProcessLogEntry` を自動蓄積し、学生画面・管理者画面の双方から時系列で研究の歩みを振り返り可能にした。
  - **⑤ メール送信機能の確立**: 管理者画面の「メール通知・送信」タブから、ワンクリックで個別リマインドメールおよび一括リマインドメールを送信可能にした（GAS Webhook 設定時は `nittai.daigakuin@gmail.com` からバックグラウンド自動送信、未設定時もワンクリックでメーラー起動＋送信履歴記録）。さらにコピペ5分で無料構築できる Google Apps Script コードをアプリ内に同梱。
- **影響範囲**: `firestore.rules`, `src/types/domain.ts`, `src/lib/progressUtils.ts`, `src/data/demoSeed.ts`, `src/features/student/StudentDashboard.tsx`, `src/features/admin/AdminDashboard.tsx`, `src/App.tsx`


