# SECURITY.md — セキュリティおよびアクセス制御仕様書

本システムは大学院生の研究進捗管理を扱うため、`docs/MASTER_SPEC.md` に基づき多層防御（Defense in Depth）を徹底する。

---

## 1. 認証（Authentication）仕様

1. **方式**: Firebase Authentication の **Email / Password** 方式のみを使用する。
   - 自作セッション、自作OTP、メールリンク認証、Firestore上でのパスワード保存・ハッシュ比較は一切行わない。
2. **自己登録の禁止**:
   - クライアントからの新規アカウント作成は禁止し、管理者が Cloud Functions (`createStudentAccount`) 経由でのみアカウントを発行する。
3. **セッション保持期間（Persistence）**:
   - `browserSessionPersistence`（タブ/ウィンドウを閉じるとログアウトされるセッション単位保持）を使用する。共有PCや別Googleアカウントが開かれている環境でも干渉・長期残留しない。
4. **初回パスワード変更強制 (`mustChangePassword`)**:
   - アカウント作成時および管理者による仮パスワードリセット時は `userProfiles/{uid}.mustChangePassword = true` とする。
   - `mustChangePassword === true` の状態では、通常の学生画面へ遷移させず、パスワード変更画面のみを表示する。

---

## 2. 認可（Authorization）と Custom Claims

UIの非表示やクライアントから送信されたパラメータ（`role`, `admin`, `studentId`）は一切信用しない。

### Custom Claims 構造
Firebase Authentication の Custom Claims には最小限の権限識別子のみを格納する：
```json
{
  "student": true,
  "admin": false,
  "teacher": false,
  "studentId": "S001"
}
```
- **学生 (`student`)**: `token.student == true` かつ `token.studentId` が設定されている。
- **管理者 (`admin`)**: `token.admin == true`。
- **兼務者 (`student + admin`)**: `token.student == true` かつ `token.admin == true`。再ログインなしで学生画面 ⇄ 管理者画面を切り替え可能。

---

## 3. Firestore Security Rules（Deny-First）

デフォルトで全コレクションの読み書きを拒否（`allow read, write: if false;`）し、明示的に許可された条件のみを通過させる。

| コレクション | 学生 (`student`) | 管理者 (`admin`) |
| :--- | :--- | :--- |
| `userProfiles/{uid}` | 自分自身 (`request.auth.uid == uid`) の読取、および初回PW変更完了に伴う限定フィールド更新のみ可（`roles`, `studentId`, `active` の書き換え禁止） | 全件読取可（作成・権限変更は Cloud Functions 経由） |
| `students/{studentId}` | 自分自身 (`request.auth.token.studentId == studentId`) の読取のみ可。書込不可 | 全件読取・更新可 |
| `roadmapTasks/{taskId}` | 認証済みアクティブユーザーは読取可。書込不可 | 全件読取・書込可 |
| `academicYears/{year}/**` | 認証済みアクティブユーザーは読取可。書込不可 | 全件読取・書込可 |
| `progress/{progressId}` | 自分自身 (`resource.data.studentId == request.auth.token.studentId`) の読取、および許可フィールド（`status`, `personalTargetDate`, `appliedDueDate`, `dueSource`, `completedAt`, `comment`, `updatedAt`, `updatedByUid`）の更新のみ可（`studentId`, `taskId`, `historicalGrade`, `commonDueDate` の改ざん禁止） | 全件読取・書込可 |
| `notificationLogs/{id}` | アクセス不可 | 読取可（書込は Cloud Functions Admin SDK のみ） |
| `calendarSync/{id}` | アクセス不可 | 読取可（書込は Cloud Functions Admin SDK のみ） |
| `auditLogs/{id}` | アクセス不可 | 読取のみ可（書込は Cloud Functions Admin SDK のみ、更新・削除は完全禁止） |
| `appConfig/{id}` | 認証済みアクティブユーザーは読取可 | 読取・更新可 |

---

## 4. Secret 管理およびログ出力禁止事項

### GitHub コミット禁止（`.gitignore` で遮断）
- OAuth Client Secret / API Secret
- Firebase Admin SDK Service Account Private Key (`*service-account*.json`, `*firebase-adminsdk*.json`)
- Refresh Token / SMTP Password
- `.env`, `.env.local`, `.env.development.local`, `.env.production.local`

### Cloud Logging / Console 出力禁止
- パスワード（初期パスワード、新パスワード含む）
- Firebase ID Token / Refresh Token
- Service Account Private Key
- 患者情報・研究参加者個人情報

---

## 5. 保存禁止データ（研究倫理・個人情報保護）

本システムは「研究進捗管理」専用であり、以下のデータは大学の情報セキュリティおよび倫理審査上の許可が確認されるまで**一切保存してはならない**：
- 患者情報（カルテID、氏名、疾患情報等）
- 研究参加者の個人情報
- 未匿名化の生データ

---

## 6. Firebase App Check

本番公開（Production）前に Firebase App Check (reCAPTCHA Enterprise) を導入する。
1. 初期導入時は **Monitor モード** でメトリクスを確認する。
2. 正常なクライアントリクエストがブロックされないことを確認後、**Enforce（強制）モード** へ切り替える。
