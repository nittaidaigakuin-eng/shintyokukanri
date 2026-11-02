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

