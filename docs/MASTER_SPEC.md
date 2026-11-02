# 大学院研究進捗管理Webアプリ
# Antigravity ゼロベース開発用・完全マスター仕様書

この文書を、本プロジェクトにおける最上位の仕様書として扱ってください。

過去にGoogle Apps Scriptで同様のシステムを開発していましたが、**旧GASコードは移植しません。**

旧システムから引き継ぐのは、

- 業務仕様
- データの意味
- 研究進捗管理ルール
- ロードマップ
- 通知ルール
- Calendar連携ルール
- 旧Spreadsheet内の正式データ

のみです。

新システムは、

**Antigravity + GitHub + Firebase**

を使ってゼロベースで構築してください。

---

# 1. このプロジェクトの目的

大学院生の研究進捗を管理するWebアプリを作成します。

主な対象は現在、

**修士課程の学生**

です。

将来的には博士課程にも拡張できる構造にしてください。

このシステムは単なるタスク管理ではありません。

学生本人が、

- 今どの段階にいるのか
- 次に何をするべきか
- いつまでにやる必要があるのか
- 遅れているものは何か

を簡単に把握できることを重視します。

管理者は、

- 誰が遅れているか
- 誰の期限が近いか
- 誰がどの研究段階にいるか
- 個人目標日が未設定の学生
- 長期間進捗更新がない学生

を一覧で把握できるようにします。

---

# 2. 最重要設計思想

このシステムでは、

**学生が頻繁に管理表を見に行かなくても、システム側が次の行動を分かりやすく示す**

ことを重視してください。

学生に複雑な操作を要求しないでください。

管理者についても、

「全学生のデータを見る」

より、

**今対応が必要な学生を最初に見つけられる**

設計を優先してください。

---

# 3. アカウント構成

現在のアカウント構成は以下です。

## Antigravity

個人Googleアカウントを使用。

用途：

- 開発
- AIエージェント
- コード編集

## GitHub

大学院用アカウントを使用。

用途：

- ソースコード
- Git履歴
- ドキュメント

Repositoryは、

**Private**

にしてください。

## Firebase / Google Cloud

大学院用に作成したGmailアカウントを使用。

用途：

- Firebase Authentication
- Cloud Firestore
- Cloud Functions
- Firebase Hosting
- Security Rules
- 将来のGoogle API連携

---

# 4. 開発の基本方針

旧GASコードはコピーしないでください。

旧システムを参考にして、

**現在のFirebase構成として適切な設計を新規実装**

してください。

以下は禁止します。

- GASコードの大量コピー
- Apps Script前提の設計をそのまま再現
- 自作セッション認証
- 自作OTP
- 自作パスワードhash
- Firestoreへのパスワード保存

---

# 5. 推奨技術構成

基本構成は以下としてください。

## Frontend

- React
- TypeScript
- Vite

## Styling

- Tailwind CSS

必要に応じて、

- Lucide Icons

等の軽量アイコンライブラリを使用可能。

不要な大型UIライブラリは増やしすぎないでください。

## Authentication

Firebase Authentication

方式：

**Email + Password**

## Database

Cloud Firestore

## Backend

Cloud Functions for Firebase v2

## Hosting

Firebase Hosting

## Authorization

- Firebase Authentication
- Custom Claims
- Firestore Security Rules
- Cloud Functions側での再検証

## 定期処理

Cloud Functions scheduled functions

## 将来

- Google Calendar API
- Google Drive API
- Firebase Storage

等。

---

# 6. 開発環境と本番環境

可能であれば、

## development

開発用Firebase Project

## production

本番Firebase Project

を分離してください。

本番データで開発テストを行わないでください。

初期開発ではdevelopment環境を使用してください。

---

# 7. ログイン最終仕様

ログイン画面は非常にシンプルにしてください。

表示：

大学院研究進捗管理

メールアドレス

パスワード

ログイン

のみ。

通常ログインでは、

- OTP
- 6桁認証コード
- メールリンク
- 毎回送信される一時パスワード

を使用しません。

---

# 8. 学生ログイン

学生は、

**学生マスターに登録されているメールアドレス**

と、

**本人のパスワード**

でログインします。

Googleアカウントのログイン状態は関係ありません。

学生のPCで別のGoogleアカウントが開かれていても、

本システムへのログインには影響させないでください。

---

# 9. 管理者ログイン

管理者も、

メールアドレス
＋
パスワード

でログインします。

管理者だからといってOTPへ切り替えないでください。

---

# 10. アカウント自己登録

学生自身による、

「新規登録」

は実装しません。

アカウントは管理者が作成します。

---

# 11. 初期パスワード

管理者が学生アカウントを作成する際に、

初期パスワードを設定できるようにしてください。

学生へは、

メールアドレス
＋
初期パスワード

を別経路で伝えます。

初回ログイン後、

本人に新しいパスワードを設定させてください。

Firestoreには実際のパスワードを保存しません。

Firebase Authenticationに任せます。

---

# 12. 初回パスワード変更

Firestoreのユーザープロフィールに、

`mustChangePassword`

を持たせてください。

初期値：

TRUE

初回ログイン時、

通常の学生画面へ移動する前に、

新パスワード変更を要求してください。

変更完了後、

FALSE

にします。

---

# 13. ログイン保持

ユーザーは、

**アクセス時に基本的にログインを求められる**

運用を希望しています。

長期的な自動ログインは不要です。

Firebase Authenticationでは、

browser session単位のPersistence

を使用してください。

local永続ログインは避けてください。

---

# 14. パスワードを忘れた場合

最初のバージョンでは、

「パスワードを忘れた場合は管理者へお問い合わせください」

とします。

管理者がパスワードをリセットします。

自動メールリセットは将来追加可能ですが、最初から必須ではありません。

---

# 15. ユーザーロール

以下を想定します。

## student

学生

## admin

管理者

## student + admin

兼務者

## teacher

将来追加可能。

初期バージョンでは必須ではありません。

---

# 16. 兼務ユーザー

同一ユーザーが、

student = TRUE

admin = TRUE

を持てるようにしてください。

その場合、

学生画面
⇄
管理者画面

を切り替えられるようにしてください。

再ログインは不要です。

一般学生には、

管理者画面切替UIを表示しないでください。

---

# 17. 権限管理

UIを隠すだけではセキュリティになりません。

必ず、

- Custom Claims
- Firestore Security Rules
- Cloud Functions側

で権限を検証してください。

クライアントから送信された、

- role
- admin=true
- studentId

等を信用してはいけません。

Firebase Auth UIDから本人を判断してください。

---

# 18. Firestore Collection設計

基本Collectionは以下です。

```text
userProfiles
students
roadmapTasks
academicYears
progress
notificationLogs
calendarSync
auditLogs
appConfig
```

---

# 19. userProfiles

Document ID：

Firebase Authentication UID

fields：

```text
uid
email
displayName
studentId
roles
mustChangePassword
active
createdAt
updatedAt
lastLoginAt
```

roles：

```text
student
admin
teacher
```

---

# 20. students

Document ID：

`studentId`

例：

```text
S001
```

fields：

```text
studentId
name
email
course
currentGrade
enrollmentYear
supervisor
enrollmentStatus
notificationEnabled
notes
createdAt
updatedAt
```

---

# 21. 学生ID

studentIdは、

研究進捗管理上の安定したIDとして扱います。

Firebase UIDとは別です。

studentIdは、

進級
メール変更
パスワード変更

等で変更しません。

---

# 22. 修士課程の学年

現在：

```text
M1
M2
```

を使用します。

---

# 23. 在籍状態

以下を想定します。

```text
在籍
休学
修了
退学
```

---

# 24. roadmapTasks

修士課程の共通研究ロードマップです。

Document ID：

taskId

既存taskIdは移行時に維持してください。

fields：

```text
taskId
grade
category
title
studentAction
requirement
deadlineType
baseEventKey
offsetDays
deadlineRule
guideline
progressManaged
reminderPattern
calendarDisplay
displayOrder
notes
active
```

---

# 25. 現在のロードマップ件数

旧システムでは、

M1：

17件

M2：

44件

合計：

**61件**

存在します。

新システムへ移行するときも、

この61件を基準にしてください。

taskIdを勝手に変更しないでください。

---

# 26. ロードマップ設計

ロードマップ自体は全学生共通です。

学生ごとの差は、

progress

で管理します。

学生ごとに別ロードマップを作らないでください。

---

# 27. M1の特徴

M1では、

- 研究計画
- 倫理申請
- 予備実験
- 実験開始

等に個人差があります。

そのためM1では、

**個人目標日**

を中心に管理します。

---

# 28. M2の特徴

M2では、

- 中間発表
- 最終発表
- 論文関連

等、

共通公式日程を基準にする項目が増えます。

年度設定から共通期限を計算してください。

---

# 29. academicYears

Document ID：

年度

例：

```text
2026
```

Subcollection：

```text
events
```

---

# 30. 年度イベント

event fields：

```text
eventKey
name
target
date
time
reminderDays
calendarDisplay
notes
```

年度イベントは、

**共通公式予定のSource of Truth**

です。

---

# 31. progress

Document IDは、

```text
studentId_taskId
```

を推奨します。

fields：

```text
progressId
studentId
taskId
historicalGrade
category
title
personalTargetDate
commonDueDate
appliedDueDate
dueSource
status
completedAt
comment
updatedAt
updatedByUid
```

---

# 32. historicalGrade

非常に重要です。

progressに保存された学年は、

**そのタスクが属している歴史的学年**

です。

学生がM1からM2へ進級しても、

M1進捗のhistoricalGradeをM2へ変更してはいけません。

---

# 33. M1→M2

学生がM2になった場合、

students.currentGrade

のみ、

M1
→
M2

へ変更します。

M1のprogressは削除しません。

新しくM2用progressを生成します。

---

# 34. 進捗状態

status：

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
ON_HOLD
```

表示上は、

```text
未着手
進行中
完了
保留
```

とします。

---

# 35. 完了日

statusをCOMPLETEDへ変更した時、

completedAtが空なら、

サーバー時刻で自動入力してください。

完了から別状態へ戻す場合、

確認画面を表示し、

completedAtをクリアします。

---

# 36. 個人目標日と共通期限

期限には、

```text
personalTargetDate
commonDueDate
```

があります。

適用する期限は、

以下のルールです。

```text
if personalTargetDate exists:
    appliedDueDate = personalTargetDate
    dueSource = PERSONAL

else if commonDueDate exists:
    appliedDueDate = commonDueDate
    dueSource = COMMON

else:
    appliedDueDate = null
    dueSource = NONE
```

最優先は、

**個人目標日**

です。

---

# 37. 「直前月曜」

期限計算で、

「直前月曜」

を使用することがあります。

定義：

対象日の直前の月曜日。

対象日そのものが月曜日の場合は、

7日前の月曜日

を使用します。

この計算ロジックは共通utilityとして一元管理してください。

---

# 38. 進捗率

進捗率は、

現在学年の、

`progressManaged = TRUE`

のタスクだけを対象とします。

例：

M2学生の場合、

M2の44タスクを基準にします。

M1履歴は進捗率へ含めません。

---

# 39. 期限状態

表示上、

以下を使用します。

```text
期限なし
予定
まもなく
本日
期限超過
完了
```

---

# 40. 残日数

残日数は、

Asia/Tokyo

基準で計算します。

毎日変化するため、

原則Firestoreへ固定値として保存しないでください。

画面表示時またはサーバー側処理時に計算してください。

---

# 41. 学生画面の目的

学生画面では、

**情報量を増やしすぎない**

でください。

最も重要なのは、

「次に何をすればいいか」

です。

---

# 42. 学生ホーム画面

表示：

## 現在の研究進捗率

## 今の段階

現在進行中または最優先の研究タスク。

## 次にやること

次の重要タスクを1件強調表示。

## 次の期限

期限日
＋
残り日数

## 期限超過

あれば警告。

## 直近予定

3〜5件。

## カテゴリ別進捗

簡潔に表示。

---

# 43. 学生進捗一覧

学生が変更可能：

- 状態
- 個人目標日
- コメント

ただしタスクによって管理者限定にできる余地を残してください。

---

# 44. 学生画面フィルタ

以下を想定します。

```text
すべて
未完了
進行中
期限接近
期限超過
完了
```

---

# 45. 管理者ダッシュボード

管理者画面は、

**問題のある学生を先に表示**

してください。

---

# 46. 管理者ダッシュボードの主要指標

表示：

## 期限超過

## 7日以内の期限

## 個人目標日未設定

## 長期間更新なし

## 学年別進捗

## 次の公式イベント

---

# 47. 学生一覧

表示：

```text
氏名
学年
進捗率
次の期限
期限超過数
最終更新
指導教員
```

---

# 48. 学生一覧フィルタ

```text
学年
指導教員
在籍状態
期限状態
```

検索：

```text
氏名
studentId
メールアドレス
```

---

# 49. 学生詳細

管理者は学生詳細で、

- プロフィール
- 現在学年進捗
- 過去学年履歴
- 個人目標日
- コメント
- アカウント状態
- 最終ログイン

等を確認できます。

---

# 50. 管理者による学生作成

管理画面から、

以下を登録できるようにしてください。

```text
studentId
氏名
メールアドレス
課程
学年
入学年度
指導教員
在籍状態
通知有効
初期パスワード
```

---

# 51. 学生作成処理

学生登録は、

Cloud Functions

経由にしてください。

Functionsで、

1. admin権限確認
2. Firebase Authentication user作成
3. custom claims設定
4. userProfiles作成
5. students作成
6. currentGradeに対応するprogress生成

を行います。

---

# 52. アカウント無効化

学生が修了・退学等になった場合、

すぐAuth userを削除せず、

まず利用停止してください。

履歴を残します。

---

# 53. 管理者によるパスワードリセット

管理者画面から、

新しい仮パスワードを設定可能にしてください。

リセット後：

```text
mustChangePassword = TRUE
```

とします。

管理者が現在の学生パスワードを見る機能は作らないでください。

---

# 54. 青基調UI

全体は、

**青基調でシンプルかつかっこいいデザイン**

にしてください。

推奨：

```text
Navy     #0B1F3A
Blue     #2563EB
White
Pale blue-gray
```

状態：

```text
成功 → Green
注意 → Orange
危険 → Red
```

---

# 55. デザイン方針

- 余白を十分取る
- 角丸カード
- 強すぎるグラデーションを使いすぎない
- 大学業務として違和感のないデザイン
- スマートフォンでも見やすい
- 色だけで状態を表現しない
- アイコン＋テキストを使用

---

# 56. 対応端末

優先：

1. PC Chrome
2. iPhone Safari
3. iPhone Chrome

レスポンシブ対応してください。

---

# 57. 通知機能

研究進捗の期限が近づいた場合、

学生へ通知します。

---

# 58. 通知対象

以下すべてを満たすもの。

- 学生が利用中
- 通知有効
- progress未完了
- appliedDueDateあり
- reminder条件一致

---

# 59. 通知タイミング

基本：

```text
14日前
7日前
3日前
当日
```

ロードマップや年度設定で変更可能にしてください。

---

# 60. 通知重複防止

notificationId：

```text
studentId_taskId_dueDate_remindDays
```

SUCCESS済みなら、

再送しない。

FAILEDなら、

再試行可能。

---

# 61. notificationLogs

fields：

```text
notificationId
progressId
studentId
taskId
dueDate
remindDays
recipientEmail
sentAt
result
errorMessage
```

---

# 62. メールProvider

通知メール送信方式は、

後から変更可能な設計にしてください。

例：

```text
EmailProvider
```

インターフェースを作成。

具体的な送信Providerは後決定可能。

秘密情報は、

Secret Manager

等で管理。

---

# 63. Google Calendar

共通公式予定を、

Google Calendarへ同期します。

---

# 64. Calendarに載せるもの

年度設定の、

```text
calendarDisplay = TRUE
```

かつ、

日付あり

のイベント。

---

# 65. Calendarに載せないもの

以下は共通Calendarへ載せません。

- 学生個人目標日
- 学生氏名
- 個別研究進捗

---

# 66. Calendar Source of Truth

年度設定

をSource of Truthとします。

Calendar側で編集された内容を正式情報にはしません。

---

# 67. Calendar重複防止

calendarSync Collectionに、

```text
syncKey
eventKey
calendarEventId
lastSyncedAt
result
errorMessage
```

等を保存してください。

既存eventIdを更新し、

毎回新しいイベントを作成しないでください。

---

# 68. Calendar削除

年度設定で、

calendarDisplay = FALSE

または、

日付削除

された場合、

対応Calendarイベントを削除してください。

---

# 69. 定期処理

目安：

```text
朝7時
Calendar同期

朝8時
研究期限リマインド
```

Asia/Tokyo基準。

---

# 70. auditLogs

重要な管理操作は、

監査ログへ記録してください。

---

# 71. audit対象

例：

- 学生作成
- 学生無効化
- 権限変更
- パスワードリセット
- 年度設定変更
- ロードマップ変更
- 管理者による個人期限変更

---

# 72. セキュリティ

Firestore Rulesは、

**deny-first**

で作成してください。

開発中だからという理由で、

`allow read, write: if true`

を放置しないでください。

---

# 73. 学生アクセス

学生は、

自分自身に関係するデータだけ

アクセス可能。

他学生データを、

URLやAPI改変で取得できないようにしてください。

---

# 74. 管理者アクセス

admin custom claimを持つユーザーだけ、

管理者機能へアクセス可能。

---

# 75. custom claims

権限制御はcustom claims。

プロフィール情報はFirestore。

大量の情報をclaimsへ保存しないでください。

---

# 76. App Check

本番公開前に、

Firebase App Check

を導入してください。

最初はMonitorし、

問題ないことを確認してからEnforceしてください。

---

# 77. Secrets

以下をGitHubへコミット禁止。

- OAuth secret
- API secret
- service account private key
- refresh token
- SMTP password

---

# 78. ログ

Cloud Logging等へ、

以下を出力禁止。

- パスワード
- Auth token
- private key
- refresh token
- 患者情報

---

# 79. 研究データ

このシステムは、

研究進捗管理を目的とします。

患者情報
研究参加者個人情報
未匿名化生データ

は、

大学の情報セキュリティおよび倫理審査上の許可を確認するまで保存しないでください。

---

# 80. ファイル管理

ファイル管理は、

基本機能が安定してから追加します。

---

# 81. ファイル管理の考え方

学生がGoogle Driveへ直接アクセスする方式を必須にしません。

学生の既定Googleアカウントが違っていても、

Webアプリ内から利用できる構成を目指します。

---

# 82. ファイルカテゴリ

将来的に、

```text
01_研究計画
02_倫理申請
03_研究資料
04_論文
05_学会発表
06_その他
```

を想定。

---

# 83. 保存Provider

ファイル保存は、

Provider抽象化してください。

候補：

- Google Drive
- Firebase Storage

大学のルールを確認してから決定します。

---

# 84. 旧システム

旧システムは、

Google Apps Script
＋
Google Spreadsheet

で作成されています。

新システム完成までは削除しません。

---

# 85. 旧GASから移行するもの

コードではなく、

データのみです。

---

# 86. 旧Spreadsheetシート

旧システムには、

以下があります。

```text
修士ロードマップ
年度設定
学生マスター
学生進捗
通知ログ
カレンダー同期
```

Phase 9で追加した認証関連データは、

原則新Firebase Authenticationへ引き継ぎません。

---

# 87. 旧学生マスター正式仕様

ヘッダー：

第4行

データ：

第5行以降

正式DB：

A:N

```text
A student_id
B 氏名
C メールアドレス
D 課程
E 学年
F 入学年度
G 指導教員
H 在籍状態
I 利用権限
J 通知有効
K 登録日
L 更新日
M 備考
N 最終ログイン
```

---

# 88. 旧学生進捗正式仕様

ヘッダー：

第1行

A:Q

17列。

```text
progress_id
student_id
task_id
氏名
学年
カテゴリ
項目名
個人目標日
共通期限
適用期限
期限ソース
状態
完了日
コメント
更新日時
残日数
期限判定
```

---

# 89. 旧年度設定正式仕様

B4：

年度

ヘッダー：

第6行

```text
event_key
イベント名
対象
日付（入力）
時刻（入力）
通知日数
カレンダー表示
入力状況
備考
```

---

# 90. データ移行

新システムが安定してから、

Spreadsheetから、

CSVまたはJSON等を使って移行してください。

---

# 91. 移行順

推奨：

```text
roadmapTasks
↓
academicYears/events
↓
students
↓
progress
```

Authentication userは、

新Firebase側で作成します。

旧パスワードは移行しません。

---

# 92. 移行検証

最低限、

```text
M1 = 17
M2 = 44
合計 = 61
```

を確認。

studentId重複なし。

メール形式確認。

progress件数確認。

M1履歴確認。

期限ロジック確認。

---

# 93. テスト

最低限、

以下のテストを作成してください。

---

# 94. 認証テスト

- 学生ログイン
- 管理者ログイン
- 兼務ログイン
- 誤パスワード拒否
- 未登録メール拒否
- 初回PW変更
- logout
- 学生の管理者アクセス拒否

---

# 95. Firestore Rulesテスト

Firebase Emulatorを使用。

最低限：

- 学生Aが学生Bを読めない
- 学生Aが学生Bを更新できない
- 学生が管理者設定を変更できない
- 管理者は必要データへアクセス可能
- 未認証ユーザー拒否

---

# 96. ロジックテスト

- 個人目標日優先
- 共通期限
- 直前月曜
- M1→M2
- M2進捗率
- M1履歴保持
- 通知重複防止
- Calendar重複防止

---

# 97. Responsiveテスト

PC

iPhone

で確認。

---

# 98. GitHub運用

main：

安定版。

作業時：

feature branch

を使用。

---

# 99. コミット

1コミットに、

無関係な変更を大量に混ぜないでください。

---

# 100. リポジトリ構成

推奨：

```text
/
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ MASTER_SPEC.md
│  ├─ DATA_MODEL.md
│  ├─ SECURITY.md
│  ├─ UI_SPEC.md
│  ├─ MIGRATION.md
│  └─ DECISIONS.md
│
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ lib/
│  │  └─ firebase/
│  └─ types/
│
├─ functions/
├─ tests/
├─ scripts/
│  └─ import/
│
├─ firestore.rules
├─ firestore.indexes.json
├─ storage.rules
├─ firebase.json
└─ package.json
```

---

# 101. MASTER_SPEC.md

この文書そのものを、

```text
docs/MASTER_SPEC.md
```

として保存してください。

---

# 102. AGENTS.md

AGENTS.mdには、

このプロジェクトでAIが必ず守る短いルールをまとめてください。

最低限：

```text
MASTER_SPEC.mdを最優先
勝手に仕様変更しない
Authを自作しない
Rulesを必ず確認
本番データでテストしない
studentId/roleをクライアント値から信用しない
SecretsをGitHubへ保存しない
実装後にテスト結果を報告
```

を含めます。

---

# 103. 実装の順序

Phase番号は使用しません。

以下の順序で実装してください。

```text
開発基盤
↓
Firebase接続
↓
認証・権限
↓
Firestoreデータ基盤
↓
学生画面
↓
管理者画面
↓
通知
↓
Google Calendar
↓
旧データ移行
↓
ファイル管理
↓
本番安定化
```

---

# 104. 次へ進む条件

単純に順番通り作るのではなく、

各段階がテスト済みであることを確認してから、

次へ進んでください。

ただし、

**逐一ユーザーへ「次へ進んでいいですか？」と確認する必要はありません。**

仕様書の範囲内であれば、

そのまま作業を継続してください。

---

# 105. ラリーを増やさないための重要ルール

このプロジェクトでは、

不要な確認質問を減らしてください。

仕様書に答えがある場合、

質問せず実装してください。

軽微な技術選択についても、

最適と判断したものを選択して進めてください。

---

# 106. ユーザーへ確認が必要なケース

以下の場合のみ確認してください。

## ユーザー本人の操作が必要

例：

- Googleログイン
- Firebase Console操作
- GitHub認証
- API有効化
- OAuth同意
- secret入力
- Billing設定

## 仕様が大きく変わる

例：

Firebase Authenticationを別方式に変更したい。

## 費用が発生する

課金設定等。

## データ消失リスクがある

本番DB削除等。

## セキュリティ上重大な選択

公開範囲等。

それ以外は、

可能な限り自律的に進めてください。

---

# 107. ユーザー操作が必要になった場合

単に、

「Firebaseで設定してください」

とは言わないでください。

必ず、

```text
どこを開く
↓
何をクリック
↓
何を入力
↓
完了後どうなる
```

まで具体的に説明してください。

---

# 108. 一度にまとめてユーザー操作を依頼

例えばFirebaseで、

3つ設定が必要なら、

一つずつラリーせず、

可能な限りまとめて案内してください。

---

# 109. 開発中の報告

細かい作業ごとに、

逐一長い説明を返す必要はありません。

意味のある区切りで、

```text
実装したこと
変更ファイル
テスト結果
ユーザー操作が必要なもの
未解決点
```

をまとめて報告してください。

---

# 110. 仕様変更

MASTER_SPECと違う実装が必要と判断した場合、

勝手に変更しないでください。

以下を報告してください。

```text
現在の仕様
問題点
提案
メリット
デメリット
影響範囲
```

ユーザー承認後、

`docs/DECISIONS.md`

へ記録します。

---

# 111. 学生の負担を増やさない

機能追加時は必ず、

「学生が操作する回数が増えないか」

を考慮してください。

自動取得・自動計算できるものを、

学生に手入力させないでください。

---

# 112. 管理者負担も減らす

可能なものは、

一括処理
自動生成
自動計算

してください。

---

# 113. 将来的な目標

将来的には、

Webアプリを開けば、

学生は、

「今日何をすればいいか」

管理者は、

「今日誰をフォローすればいいか」

が分かるシステムにしてください。

---

# 114. 今回最初に行う作業

この仕様書を読んだ後、

いきなり全機能を作らないでください。

まず現在の開発環境を確認してください。

---

# 115. 最初に確認するもの

以下を確認してください。

```text
現在の作業フォルダ
Git repository
remote repository
current branch
Node.js
npm
Firebase CLI
Firebase project
Firebase Authentication
Firestore
Hosting
現在存在するファイル
```

---

# 116. その後に作るもの

開発基盤として、

最低限、

```text
React
TypeScript
Vite
Tailwind
Firebase SDK
Firebase Functions
Firebase Emulator
ESLint
TypeScript typecheck
テスト環境
```

を整備してください。

---

# 117. 最初に作成するドキュメント

```text
AGENTS.md
docs/MASTER_SPEC.md
docs/DATA_MODEL.md
docs/SECURITY.md
docs/UI_SPEC.md
docs/MIGRATION.md
docs/DECISIONS.md
```

---

# 118. Firestore Rules

最初から、

deny-first

で作成してください。

まだCollectionが完成していなくても、

未認証ユーザーが自由にアクセスできる状態にはしないでください。

---

# 119. 最初の完成状態

最初の作業では、

まだ学生画面や管理者画面を完成させる必要はありません。

最低限、

```text
Reactアプリ起動
Firebase dev接続
Git正常
Firestore Rules
Emulator
lint
typecheck
test
基本ドキュメント
```

まで整えばよいです。

---

# 120. その後

基盤が正常なら、

仕様書に従って、

認証
↓
データ
↓
UI

へ自律的に進んでください。

必要以上に、

「次はどうしますか？」

とユーザーへ聞かないでください。

---

# 121. 最終的な完成条件

以下が利用可能になれば、

初期完成とします。

## 学生

- メール＋PWログイン
- 初回PW変更
- 進捗率表示
- 次にやること
- 期限
- 進捗更新
- 個人目標日
- コメント
- logout

## 管理者

- 管理者ログイン
- 学生一覧
- 学生詳細
- 学生作成
- 学生無効化
- PWリセット
- 進捗確認
- 年度設定
- ロードマップ
- 問題学生抽出

## システム

- 通知
- Calendar
- Security Rules
- audit log
- Responsive
- Migration

---

# 122. 開発上の絶対ルール

以下は常に守ってください。

1. このMASTER_SPECを最優先する。
2. 旧GASコードは移植しない。
3. Firebase Authenticationを使う。
4. パスワードをFirestoreへ保存しない。
5. Firestore Security Rulesを必ず実装する。
6. clientからのrole/studentIdを信用しない。
7. 学生は自分のデータ以外へアクセスできない。
8. M1履歴を削除しない。
9. M2進捗率へM1を含めない。
10. 個人目標日を共通期限より優先する。
11. taskIdを勝手に変更しない。
12. 通知・Calendarは重複を作らない。
13. SecretsをGitHubへ保存しない。
14. 本番データでテストしない。
15. 意味のない確認ラリーを増やさない。
16. ユーザー操作が必要な作業は具体的にまとめて案内する。
17. 仕様外の大きな変更だけ確認する。
18. 実装後は必ずテストする。
