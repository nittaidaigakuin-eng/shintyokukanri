# 大学院研究進捗管理Webアプリ (`shintyokukanri`)

修士課程（将来的に博士課程へ拡張可能）の大学院生および指導教員・管理者向けの研究進捗管理Webアプリケーションです。

## 設計原則
- **学生向け**: 頻繁に管理表を見に行かなくても「今どの段階にいるか」「次に何をいつまでにやるべきか」が一目でわかるシンプルで迷わないUI。
- **管理者向け**: 全学生を漫然と見るのではなく、「今フォローが必要な学生（期限超過・7日以内期限・個人目標日未設定・長期未更新）」を最優先で抽出できるダッシュボード。
- **セキュリティ**: Firebase Authentication (Email/Password・セッション単位保持) + Custom Claims + Deny-first Firestore Security Rules + Cloud Functions v2 再検証。

## ドキュメント構成
- [`AGENTS.md`](./AGENTS.md): AIエージェント開発行動規範（必読）
- [`docs/MASTER_SPEC.md`](./docs/MASTER_SPEC.md): 完全マスター仕様書（最上位仕様）
- [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md): Firestore 全コレクション設計・スキーマ定義
- [`docs/SECURITY.md`](./docs/SECURITY.md): 認証・認可・Firestore Rules・Secret管理仕様
- [`docs/UI_SPEC.md`](./docs/UI_SPEC.md): 青基調UI・画面設計・レスポンシブ仕様
- [`docs/MIGRATION.md`](./docs/MIGRATION.md): 旧Spreadsheetからのデータ移行・検証仕様
- [`docs/DECISIONS.md`](./docs/DECISIONS.md): 設計判断記録

## 開発コマンド

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev

# 型チェック (TypeScript)
npm run typecheck

# Lint チェック (ESLint)
npm run lint

# ユニットテスト実行 (Vitest)
npm test

# 本番ビルド検証
npm run build
```
