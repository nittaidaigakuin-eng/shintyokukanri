# AGENTS.md — AI エージェント開発行動規範

このリポジトリで作業するすべてのAIエージェント（Antigravity等）は、以下のルールを**絶対遵守**してください。

## 1. 最上位原則
1. **`docs/MASTER_SPEC.md` を最優先する**: すべての設計・実装・テストは `docs/MASTER_SPEC.md` に準拠すること。
2. **勝手に仕様変更しない**: `MASTER_SPEC.md` と異なる仕様が必要な場合は、実装前に必ず「現在の仕様・問題点・提案・メリット・デメリット・影響範囲」をユーザーへ報告し、承認を得てから `docs/DECISIONS.md` に記録すること。
3. **旧GASコードは移植しない**: Apps Script前提の設計やコードコピーは禁止。Firebase + React + TypeScript に適したゼロベース設計を行うこと。
4. **意味のない確認ラリーを増やさない**: 仕様書に答えがある事項や軽微な技術判断でユーザーに質問せず、自律的に実装と検証を進めること。ユーザー操作が必要な場合は、手順をまとめて具体的に案内すること。

## 2. 認証・認可・セキュリティ絶対ルール
5. **Authを自作しない**: 認証は必ず **Firebase Authentication (Email + Password)** を使用する。自作セッション、自作OTP、自作パスワードハッシュは禁止。
6. **パスワードをFirestoreへ保存しない**: 初期パスワード・変更後パスワードを含め、Firestoreやログに平文・ハッシュ問わずパスワードを保存・出力してはならない。
7. **ログイン保持はセッション単位**: Firebase Auth Persistence は `browserSessionPersistence` を使用する（ローカル永続ログインは避ける）。
8. **クライアント送信の role / studentId を信用しない**: UI非表示だけで権限を制御してはならない。必ず Firebase Auth UID・Custom Claims（`admin`, `student`, `studentId`）・Firestore Security Rules・Cloud Functions 側で再検証を行うこと。
9. **Firestore Rules は必ず deny-first で確認する**: 開発中であっても `allow read, write: if true` を放置しない。学生は自分自身のデータのみアクセス可能とし、他学生データの閲覧・改ざんを完全に遮断すること。
10. **Secrets を GitHub へ保存しない**: API Secret、OAuth Secret、Service Account Private Key、Refresh Token、SMTP Password、`.env.local` 等は絶対にコミットしない。
11. **機密情報・患者情報をログやDBに出力・保存しない**: パスワード、Authトークン、秘密鍵をCloud Logging等に出力しない。また、患者情報・研究参加者個人情報・未匿名化生データをシステム内に保存しない。

## 3. ドメイン・データ整合性ルール
12. **`studentId` は不変の安定ID**: Firebase UIDとは別に管理し、進級・メール変更・パスワード変更等で変更しない。
13. **`taskId` を勝手に変更しない**: 修士ロードマップ全61件（M1: 17件、M2: 44件）の `taskId` を維持する。
14. **M1履歴を削除・上書きしない (`historicalGrade`)**: M1→M2進級時は `students.currentGrade` のみ `M2` に変更し、M2用 `progress` を追加生成する。既存のM1 `progress` の `historicalGrade` は `M1` のまま保持する。
15. **M2進捗率へM1を含めない**: 進捗率は「現在学年 (`currentGrade`) かつ `progressManaged == true`」のタスクのみを分母・分子として計算する。
16. **個人目標日を共通期限より優先する**: `personalTargetDate` が存在する場合は `appliedDueDate = personalTargetDate` (`dueSource = PERSONAL`)、なければ `commonDueDate` (`dueSource = COMMON`)、どちらもなければ `null` (`dueSource = NONE`) とする。
17. **残日数は Asia/Tokyo 基準で動的計算する**: 毎日変化するため、Firestoreへ固定値として保存せず、表示時またはサーバー処理時に `Asia/Tokyo` 基準で計算する。「直前月曜」ロジック（対象日が月曜なら7日前）は共通ユーティリティで一元管理する。
18. **通知・Calendar同期は重複を作らない**: `notificationLogs` (`studentId_taskId_dueDate_remindDays`) および `calendarSync` (`syncKey` / `calendarEventId`) により冪等性を保証する。

## 4. 環境・テスト・Git運用ルール
19. **本番データでテストしない**: 開発・自動テストは Emulator または development 用 Firebase Project で行う。
20. **1コミットに無関係な変更を混ぜない**: 論理的な単位でコミットし、実装後は必ずテスト・型チェック・Lintの結果を確認して報告する。
