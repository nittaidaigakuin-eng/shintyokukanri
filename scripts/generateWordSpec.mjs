/**
 * 大学院研究進捗管理Webアプリ — 現状仕様書 Word (.docx) 生成スクリプト
 * Python や外部ライブラリに依存せず、Node.js 標準機能のみで OpenXML (.docx) ファイルを生成する
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wHeading1(text) {
  return `<w:p>
    <w:pPr>
      <w:pStyle w:val="Heading1"/>
      <w:spacing w:before="360" w:after="160"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="12" w:space="4" w:color="2563EB"/>
      </w:pBdr>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
        <w:b/>
        <w:color w:val="0B1F3A"/>
        <w:sz w:val="32"/>
      </w:rPr>
      <w:t>${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function wHeading2(text) {
  return `<w:p>
    <w:pPr>
      <w:pStyle w:val="Heading2"/>
      <w:spacing w:before="240" w:after="100"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
        <w:b/>
        <w:color w:val="2563EB"/>
        <w:sz w:val="26"/>
      </w:rPr>
      <w:t>${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function wParagraph(text, bold = false) {
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="60" w:after="80" w:line="320" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
        ${bold ? '<w:b/>' : ''}
        <w:sz w:val="21"/>
      </w:rPr>
      <w:t>${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function wBullet(text) {
  return `<w:p>
    <w:pPr>
      <w:ind w:left="420" w:hanging="240"/>
      <w:spacing w:before="40" w:after="40" w:line="300" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
        <w:sz w:val="21"/>
      </w:rPr>
      <w:t>・ ${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function wTable(headers, rows) {
  const headerCells = headers
    .map(
      (h) => `<w:tc>
      <w:tcPr>
        <w:shd w:val="clear" w:color="auto" w:fill="0B1F3A"/>
        <w:tcMar>
          <w:top w:w="100" w:type="dxa"/>
          <w:bottom w:w="100" w:type="dxa"/>
          <w:left w:w="140" w:type="dxa"/>
          <w:right w:w="140" w:type="dxa"/>
        </w:tcMar>
      </w:tcPr>
      <w:p>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
            <w:b/>
            <w:color w:val="FFFFFF"/>
            <w:sz w:val="19"/>
          </w:rPr>
          <w:t>${escapeXml(h)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`
    )
    .join('');

  const bodyRows = rows
    .map(
      (row, idx) => `<w:tr>
      ${row
        .map(
          (cell) => `<w:tc>
        <w:tcPr>
          ${idx % 2 === 1 ? '<w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>' : ''}
          <w:tcMar>
            <w:top w:w="80" w:type="dxa"/>
            <w:bottom w:w="80" w:type="dxa"/>
            <w:left w:w="140" w:type="dxa"/>
            <w:right w:w="140" w:type="dxa"/>
          </w:tcMar>
        </w:tcPr>
        <w:p>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
              <w:sz w:val="19"/>
            </w:rPr>
            <w:t>${escapeXml(cell)}</w:t>
          </w:r>
        </w:p>
      </w:tc>`
        )
        .join('')}
    </w:tr>`
    )
    .join('');

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tr>${headerCells}</w:tr>
    ${bodyRows}
  </w:tbl>
  <w:p/>`;
}

const bodyParts = [
  `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="200" w:after="120"/></w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
        <w:b/><w:color w:val="0B1F3A"/><w:sz w:val="40"/>
      </w:rPr>
      <w:t>大学院研究進捗管理Webアプリ 現状システム仕様書</w:t>
    </w:r>
  </w:p>`,
  `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="360"/></w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Meiryo" w:hAnsi="Meiryo" w:eastAsia="Meiryo"/>
        <w:color w:val="475569"/><w:sz w:val="20"/>
      </w:rPr>
      <w:t>作成日: 2026年11月3日 / リポジトリ: nittaidaigakuin-eng/shintyokukanri</w:t>
    </w:r>
  </w:p>`,

  wHeading1('1. プロジェクト概要・目的'),
  wParagraph(
    '本システムは、大学院修士課程（将来的に博士課程へ拡張可能）の学生および研究指導・管理者を対象とした研究進捗管理Webアプリケーションである。単なるタスク管理表ではなく、学生自身が「今どの段階にいるか」「次に何をいつまでにやるべきか」を直感的に把握でき、管理者は「今フォローが必要な学生」を最優先で抽出できる設計としている。'
  ),
  wBullet('対象課程：修士課程（M1・M2）、将来的に博士課程（D1〜D3）へ拡張可能'),
  wBullet('設計方針：旧Google Apps Script (GAS) コードは移植せず、モダンなWeb標準構成でゼロベース構築'),
  wBullet('デザイン基調：Navy (#0B1F3A) および Blue (#2563EB) を基調とした大学業務に適したレスポンシブUI（PC Chrome / iPhone Safari・Chrome 対応）'),

  wHeading1('2. システム構成・アカウント構成'),
  wTable(
    ['区分', '採用技術 / アカウント', '用途・備考'],
    [
      ['フロントエンド', 'React 19 + TypeScript + Vite + Tailwind CSS', 'SPA構成、Lucide Icons使用'],
      ['ホスティング', 'Cloudflare Pages (無料静的Pages) / Firebase Hosting', '課金の発生しない静的Pages配信（_redirects対応済み）'],
      ['認証・DB基盤', 'Firebase Authentication + Cloud Firestore', '同一ブラウザ別タブ即時同期＋Firestoreリアルタイム同期対応'],
      ['バックエンド定義', 'Cloud Functions for Firebase v2 (asia-northeast1)', '学生作成・PWリセット・朝7時Calendar同期・朝8時通知基盤'],
      ['GitHubリポジトリ', 'nittaidaigakuin-eng/shintyokukanri (Private)', '共同開発者: shun05110511-cmyk'],
      ['管理者アカウント', 'nittai.daigakuin@gmail.com', '表示名：「管理者」（教授名表記なし）'],
      ['リマインド送信元', 'nittai.daigakuin@gmail.com', '各学生の登録メールアドレス宛に個別配信']
    ]
  ),

  wHeading1('3. 認証・権限・セキュリティ仕様'),
  wHeading2('3.1 ログイン・パスワード管理'),
  wBullet('ログイン方式：メールアドレス＋パスワードのみ（OTP、メールリンク、学生の自己新規登録は実装しない）'),
  wBullet('ログイン画面表示：「大学院研究進捗管理」「メールアドレス」「パスワード」「ログイン」および「パスワードを忘れた場合は管理者へお問い合わせください」のみを表示'),
  wBullet('初回パスワード変更強制：新規作成された学生（および管理者が仮パスワードへリセットした学生）は mustChangePassword = TRUE となり、初回ログイン時に新パスワード（8文字以上）への変更を完了するまで通常画面へ進めない'),
  wBullet('パスワード保護：FirestoreやGitHubリポジトリ上に平文パスワードを保存しない（Firebase Auth または SHA-256 ダイジェスト照合を使用）'),
  wBullet('ログイン保持：browserSessionPersistence（ブラウザセッション単位）を基本とし、共有PCや別Googleアカウントログイン状態の影響を受けない'),

  wHeading2('3.2 ロールと兼務画面切替'),
  wBullet('ロール種別：student（学生）、admin（管理者）、student + admin（兼務者）'),
  wBullet('兼務者機能：student と admin の両方を持つアカウントのみ、ヘッダー右上のトグルで再ログインなしに「学生画面 ⇄ 管理者画面」を切り替え可能（一般学生には切替UIを一切表示しない）'),
  wBullet('アクセス制御：Firestore Security Rules は deny-first（デフォルト全拒否）とし、学生は自身の studentId に紐づくデータのみ閲覧・限定更新可能。他学生のデータは取得・改ざん不可'),

  wHeading1('4. データモデル・業務ロジック仕様'),
  wHeading2('4.1 Firestore コレクション構成'),
  wTable(
    ['コレクション名', 'ドキュメントID', '主な保持データ'],
    [
      ['userProfiles', 'uid', 'email, displayName, studentId, roles, mustChangePassword, active, lastLoginAt'],
      ['students', 'studentId (例: S001)', 'name, email, course, currentGrade(M1/M2), enrollmentYear, supervisor, enrollmentStatus(在籍/休学/修了/退学), notificationEnabled'],
      ['roadmapTasks', 'taskId (例: M1-01)', 'grade, category, title, studentAction, guideline, deadlineType, baseEventKey, offsetDays, deadlineRule, progressManaged, active'],
      ['academicYears', 'year (例: 2026)', '年度ごとの公式イベント日程 (events サブコレクション: eventKey, name, target, date, time, calendarDisplay)'],
      ['progress', 'studentId_taskId', 'historicalGrade, status, personalTargetDate, commonDueDate, appliedDueDate, dueSource, completedAt, comment, updatedAt'],
      ['notificationLogs', 'studentId_taskId_dueDate_remindDays', '送信結果 (SUCCESS/FAILED)、重複送信防止用ログ'],
      ['calendarSync', 'year_eventKey', 'calendarEventId, lastSyncedAt, 同期結果'],
      ['auditLogs', 'auditId', '管理操作の監査証跡（学生作成、在籍状態変更、進級、PWリセット、年度更新、タスク増減）']
    ]
  ),

  wHeading2('4.2 研究進捗管理の重要ルール'),
  wBullet('初期データ状態：お試し用のダミー学生は0件（クリーンな状態）から運用を開始する'),
  wBullet('標準ロードマップ件数：M1＝17件、M2＝44件、合計61件を初期搭載。さらに管理画面からタスクの追加・編集・削除（増減）がいつでも可能'),
  wBullet('個人目標日優先ルール：個人目標日 (personalTargetDate) が設定されている場合は共通期限 (commonDueDate) より最優先で適用期限 (appliedDueDate, dueSource = PERSONAL) とする'),
  wBullet('「直前月曜」計算ルール：基準イベント日の直前の月曜日を算出する。基準日そのものが月曜日の場合は「7日前の月曜日」とする'),
  wBullet('歴史的学年 (historicalGrade) と M1→M2 進級処理：M1からM2へ進級した際、students.currentGrade のみを M2 へ変更し、M2用タスク進捗を追加生成する。M1の進捗履歴は削除せず historicalGrade = M1 のまま保持する'),
  wBullet('進捗率計算：現在学年 (currentGrade) の有効タスクのみを分母として計算し、M2進捗率にM1履歴は含めない'),
  wBullet('残日数計算と期限判定：Asia/Tokyo 基準で動的計算し、「期限なし / 予定 / まもなく(7日以内) / 本日 / 期限超過 / 完了」の6段階で表示する'),
  wBullet('完了日自動記録と解除確認：状態を「完了」にした際に完了日を自動記録し、完了から別状態へ戻す際は確認ダイアログを表示して完了日をクリアする'),

  wHeading1('5. 学生画面・管理者画面の機能一覧'),
  wHeading2('5.1 学生画面'),
  wBullet('期限超過アラートバナー：期限超過タスクがある場合に最上部で警告表示'),
  wBullet('現在の研究進捗率カード：現在学年の完了率（%）、完了件数/全体件数、進行中・7日以内期限・期限超過件数'),
  wBullet('今の段階 & 次にやること（1件強調）：最優先で取り組むべきタスク1件と次の期限・残り日数を大きく表示'),
  wBullet('直近予定（上位4件）およびカテゴリ別進捗バー'),
  wBullet('研究ロードマップ進捗一覧：すべて / 未完了 / 進行中 / 期限接近 / 期限超過 / 完了 のフィルタ、および「状態・個人目標日・コメント」の更新（更新すると管理画面側の最終更新日時・進捗率へ即時反映）。M2学生はM1履歴タブも閲覧可能'),

  wHeading2('5.2 管理者画面'),
  wBullet('要対応・ダッシュボード：「期限超過」「7日以内の期限到来」「個人目標日未設定」「長期間更新なし（30日以上）」の学生を最優先で抽出表示。学年別平均進捗率および年度別公式イベント一覧を表示'),
  wBullet('学生一覧・検索：氏名・studentId・メールアドレス検索、学年・指導教員・在籍状態・期限状態フィルタ'),
  wBullet('在籍状態の随時変更：学生一覧テーブル上および学生詳細画面のドロップダウンから「在籍 / 休学 / 修了 / 退学」をいつでも即座に変更可能'),
  wBullet('新規学生登録：studentId、氏名、メールアドレス、初期パスワード、学年、入学年度、指導教員、在籍状態、通知有無、兼務権限を登録し、該当学年の進捗を自動生成'),
  wBullet('学生詳細管理：M1→M2進級処理ボタン、仮パスワードリセット（mustChangePassword = TRUE 再設定）、アカウント利用停止/再開、管理者による各タスクの状態・個人目標日編集'),
  wBullet('年度別設定：年度セレクター（2026年度 / 2027年度…）および「＋年度を追加」機能により、年度ごとに公式イベント日程・時刻・Google Calendar同期有無を更新可能（変更時は共通期限を自動再計算）'),
  wBullet('ロードマップ管理（タスクの増減）：M1/M2タスクの新規追加（全学生の進捗へ自動追加）、既存タスクのタイトル・カテゴリ・アクション・時期目安の編集、不要タスクの削除が可能'),
  wBullet('通知・リマインド設定確認：送信元（nittai.daigakuin@gmail.com）から各学生の個別メールアドレス宛てに送信される14日前・7日前・3日前・当日リマインド対象タスクの一覧確認'),
  wBullet('監査ログ：重要な管理操作の実行履歴を時系列で記録・閲覧'),
];

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

// Minimal ZIP builder (PKZIP format)
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function createZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const uncompressedBuf = Buffer.from(file.content, 'utf8');
    const compressedBuf = deflateRawSync(uncompressedBuf);
    const crc = crc32(uncompressedBuf);

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedBuf.length, 18);
    localHeader.writeUInt32LE(uncompressedBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressedBuf);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedBuf.length, 20);
    centralHeader.writeUInt32LE(uncompressedBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    offset += localHeader.length + compressedBuf.length;
  }

  const centralSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

const zipBuf = createZipBuffer([
  { name: '[Content_Types].xml', content: contentTypesXml },
  { name: '_rels/.rels', content: relsXml },
  { name: 'word/document.xml', content: documentXml },
]);

const outPaths = [
  resolve(process.cwd(), 'docs/大学院研究進捗管理Webアプリ_現状仕様書.docx'),
  resolve('C:/Users/suga_/Desktop/大学院研究進捗管理Webアプリ_現状仕様書.docx'),
];

for (const p of outPaths) {
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, zipBuf);
    console.log('Generated:', p);
  } catch (err) {
    console.warn('Skipped path:', p, err.message);
  }
}
