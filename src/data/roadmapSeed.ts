/**
 * 修士課程 共通研究ロードマップ 基準データ (M1: 17件, M2: 44件, 合計: 61件)
 * MASTER_SPEC.md #24〜#28, #92 に準拠
 * ※ 旧Spreadsheet移行時は scripts/import/ で正式データを上書きインポート可能
 */

import type { AcademicEvent, RoadmapTask } from '../types/domain';

export const DEFAULT_ACADEMIC_EVENTS_2026: AcademicEvent[] = [
  {
    eventKey: 'M1_PLAN_SUBMISSION',
    name: 'M1 研究計画書提出締切',
    target: 'M1',
    date: '2026-06-30',
    time: '17:00',
    reminderDays: [14, 7, 3, 0],
    calendarDisplay: true,
    notes: '指導教員承認後に提出',
  },
  {
    eventKey: 'M1_ETHICS_DEADLINE',
    name: 'M1 倫理審査申請締切（前期）',
    target: 'M1',
    date: '2026-07-31',
    time: '17:00',
    reminderDays: [14, 7, 3, 0],
    calendarDisplay: true,
    notes: '対象研究のみ必須',
  },
  {
    eventKey: 'M2_MIDTERM_PRESENTATION',
    name: 'M2 修士論文中間発表会',
    target: 'M2',
    date: '2026-07-18',
    time: '09:30',
    reminderDays: [14, 7, 3, 0],
    calendarDisplay: true,
    notes: '要旨提出は直前月曜',
  },
  {
    eventKey: 'M2_THESIS_TITLE_SUBMISSION',
    name: 'M2 修士論文題目届提出締切',
    target: 'M2',
    date: '2026-11-16',
    time: '17:00',
    reminderDays: [14, 7, 3, 0],
    calendarDisplay: true,
    notes: '教務課窓口または所定フォーム',
  },
  {
    eventKey: 'M2_THESIS_SUBMISSION',
    name: 'M2 修士論文最終提出締切',
    target: 'M2',
    date: '2027-01-18',
    time: '17:00',
    reminderDays: [14, 7, 3, 0],
    calendarDisplay: true,
    notes: '厳守',
  },
  {
    eventKey: 'M2_FINAL_PRESENTATION',
    name: 'M2 修士論文最終発表会（公聴会）',
    target: 'M2',
    date: '2027-02-06',
    time: '09:30',
    reminderDays: [14, 7, 3, 0],
    calendarDisplay: true,
    notes: 'スライド提出は直前月曜',
  },
];

const M1_TASK_DEFINITIONS: Array<{
  idSuffix: string;
  category: string;
  title: string;
  studentAction: string;
  guideline: string;
  baseEventKey?: string | null;
  offsetDays?: number | null;
  deadlineRule?: 'EXACT' | 'PREVIOUS_MONDAY' | 'MANUAL';
}> = [
  { idSuffix: '01', category: '01_研究体制・オリエンテーション', title: '指導教員との初回研究面談・年間スケジュール確認', studentAction: '指導教員と面談し、M1年間の研究計画と定期ゼミ日程を確定する', guideline: '4月中旬' },
  { idSuffix: '02', category: '01_研究体制・オリエンテーション', title: '研究倫理eラーニング（APRIN等）受講完了', studentAction: '指定された研究倫理教育プログラムを受講し修了証を取得する', guideline: '4月末' },
  { idSuffix: '03', category: '02_先行研究・テーマ設定', title: '主要先行研究の文献レビュー（20本以上）整理', studentAction: '関連領域の主要論文を精読し、レビューマトリクスを作成する', guideline: '5月中旬' },
  { idSuffix: '04', category: '02_先行研究・テーマ設定', title: 'リサーチクエスチョン（RQ）および仮説の設定', studentAction: '先行研究のギャップから本研究のRQと検証仮説を明文化する', guideline: '5月末' },
  { idSuffix: '05', category: '03_研究計画', title: '研究計画書ドラフト作成・指導教員レビュー', studentAction: '背景・目的・方法・期待される成果をまとめた計画書案を作成する', guideline: '6月中旬' },
  { idSuffix: '06', category: '03_研究計画', title: '研究計画書の正式提出', studentAction: '指導教員の承認を得て研究計画書を提出する', guideline: '6月末', baseEventKey: 'M1_PLAN_SUBMISSION', offsetDays: 0, deadlineRule: 'EXACT' },
  { idSuffix: '07', category: '04_倫理申請', title: '研究倫理審査の要否確認および申請書類ドラフト作成', studentAction: '対象者・データ種別を確認し、倫理審査申請書・説明書・同意書案を作成する', guideline: '7月中旬' },
  { idSuffix: '08', category: '04_倫理申請', title: '研究倫理審査委員会への申請提出', studentAction: '指導教員確認済みの倫理審査申請書類一式を提出する', guideline: '7月末', baseEventKey: 'M1_ETHICS_DEADLINE', offsetDays: 0, deadlineRule: 'EXACT' },
  { idSuffix: '09', category: '04_倫理申請', title: '倫理審査結果の確認・修正対応（承認取得）', studentAction: '審査コメントへの回答・修正を行い、正式承認通知を受領する', guideline: '9月末' },
  { idSuffix: '10', category: '05_実験・調査準備', title: '測定機器・調査票・解析環境のセットアップ', studentAction: '実験プロトコルまたは調査票を確定し、必要な機材・ソフトウェアを準備する', guideline: '10月中旬' },
  { idSuffix: '11', category: '05_実験・調査準備', title: '予備実験（パイロットテスト）の実施', studentAction: '少人数またはテストデータで手順・測定精度・所要時間を検証する', guideline: '11月中旬' },
  { idSuffix: '12', category: '05_実験・調査準備', title: '予備実験結果に基づくプロトコル修正・確定', studentAction: '予備実験の課題を反映し、本実験・本調査の実施手順を最終確定する', guideline: '12月中旬' },
  { idSuffix: '13', category: '06_本実験・データ収集', title: '本実験・本調査の開始（データ収集フェーズ1）', studentAction: '承認された倫理計画に従い、本実験・本調査のデータ収集を開始する', guideline: '1月中旬' },
  { idSuffix: '14', category: '06_本実験・データ収集', title: '初期取得データの品質確認・中間集計', studentAction: '欠損値や外れ値、測定エラーがないか初期データを点検する', guideline: '2月中旬' },
  { idSuffix: '15', category: '07_M1年度末総括', title: 'M1研究成果・進捗報告スライド作成', studentAction: 'M1での達成事項と現在までのデータ状況をスライドにまとめる', guideline: '2月末' },
  { idSuffix: '16', category: '07_M1年度末総括', title: 'M1年度末研究報告会での発表', studentAction: '研究室内または専攻報告会でM1の進捗を発表しフィードバックを受ける', guideline: '3月中旬' },
  { idSuffix: '17', category: '07_M1年度末総括', title: 'M2に向けた研究推進計画・個人目標日の策定', studentAction: '中間発表・本論文提出から逆算したM2スケジュールを作成する', guideline: '3月末' },
];

const M2_TASK_DEFINITIONS: Array<{
  idSuffix: string;
  category: string;
  title: string;
  studentAction: string;
  guideline: string;
  deadlineType?: 'PERSONAL' | 'COMMON_EVENT';
  baseEventKey?: string | null;
  offsetDays?: number | null;
  deadlineRule?: 'EXACT' | 'PREVIOUS_MONDAY' | 'MANUAL';
}> = [
  { idSuffix: '01', category: '01_M2計画・データ収集完遂', title: 'M2年間マイルストーンおよび公式日程の確認', studentAction: '中間発表・題目届・最終提出・公聴会の公式日程を確認し計画を更新する', guideline: '4月上旬' },
  { idSuffix: '02', category: '01_M2計画・データ収集完遂', title: '本実験・本調査のデータ収集継続（目標サンプル50%達成）', studentAction: '計画したサンプルサイズ・実験回数の半数以上を達成する', guideline: '4月末' },
  { idSuffix: '03', category: '01_M2計画・データ収集完遂', title: 'データクリーニング・前処理パイプラインの構築', studentAction: '収集データの匿名化確認・整形・解析用データセット作成手順を確立する', guideline: '5月中旬' },
  { idSuffix: '04', category: '01_M2計画・データ収集完遂', title: '中間発表に向けた主要データ収集の完了（80%以上）', studentAction: '中間発表で提示する主解析に必要なデータ収集を完了する', guideline: '5月末' },
  { idSuffix: '05', category: '02_中間発表準備', title: '中間発表用の統計解析・一次結果の算出', studentAction: '主要評価項目に関する統計解析を実施し、図表を作成する', guideline: '6月上旬' },
  { idSuffix: '06', category: '02_中間発表準備', title: '指導教員との中間発表ストーリー・結果ディスカッション', studentAction: '解析結果の解釈と今後の課題について指導教員と合意形成する', guideline: '6月中旬' },
  { idSuffix: '07', category: '02_中間発表準備', title: '中間発表抄録（要旨）ドラフト作成', studentAction: '指定フォーマットに従い中間発表要旨のドラフトを作成し添削を受ける', guideline: '6月下旬' },
  { idSuffix: '08', category: '02_中間発表準備', title: '中間発表抄録（要旨）の提出', studentAction: '指導教員承認済みの要旨を期限までに提出する', guideline: '中間発表直前月曜', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_MIDTERM_PRESENTATION', offsetDays: 0, deadlineRule: 'PREVIOUS_MONDAY' },
  { idSuffix: '09', category: '02_中間発表準備', title: '中間発表スライド初稿の作成', studentAction: '背景・方法・結果・考察・今後の計画を含む発表スライドを作成する', guideline: '中間発表10日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_MIDTERM_PRESENTATION', offsetDays: -10, deadlineRule: 'EXACT' },
  { idSuffix: '10', category: '02_中間発表準備', title: '研究室内リハーサル・質疑応答対策', studentAction: '発表時間を計測して練習し、想定質問への回答スライドを準備する', guideline: '中間発表5日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_MIDTERM_PRESENTATION', offsetDays: -5, deadlineRule: 'EXACT' },
  { idSuffix: '11', category: '02_中間発表準備', title: '中間発表スライド最終版の提出', studentAction: 'リハーサル修正を反映した最終スライドを提出する', guideline: '中間発表2日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_MIDTERM_PRESENTATION', offsetDays: -2, deadlineRule: 'EXACT' },
  { idSuffix: '12', category: '02_中間発表準備', title: '修士論文中間発表会での発表実施', studentAction: '中間発表会にて発表を行い、副査・教員からの質疑・助言を記録する', guideline: '中間発表当日', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_MIDTERM_PRESENTATION', offsetDays: 0, deadlineRule: 'EXACT' },
  { idSuffix: '13', category: '03_追加実験・本解析', title: '中間発表フィードバックの整理と対応方針決定', studentAction: '中間発表での指摘事項を一覧化し、指導教員と追加検証・修正方針を決定する', guideline: '7月下旬' },
  { idSuffix: '14', category: '03_追加実験・本解析', title: '追加実験・補足データ収集の実施', studentAction: '指摘事項への対応および最終サンプルサイズ達成に向けたデータ収集を行う', guideline: '8月中旬' },
  { idSuffix: '15', category: '03_追加実験・本解析', title: '全データ収集の完全終了（データロック）', studentAction: '修士論文に使用する全データの収集を完了し、データセットを確定する', guideline: '8月末' },
  { idSuffix: '16', category: '03_追加実験・本解析', title: '最終統計解析・サブグループ解析・感度分析の完了', studentAction: '確定データセットに対して全ての本解析・副次解析を完了する', guideline: '9月中旬' },
  { idSuffix: '17', category: '03_追加実験・本解析', title: '論文掲載用の最終図表（Figure / Table）作成', studentAction: '論文規格に準拠した解像度・表記で全図表および凡例を作成する', guideline: '9月末' },
  { idSuffix: '18', category: '04_学会発表・対外発表', title: '関連学会への演題登録・抄録提出（該当者）', studentAction: '国内外の学会発表に向けた抄録を作成・登録する', guideline: '10月上旬' },
  { idSuffix: '19', category: '04_学会発表・対外発表', title: '学会発表スライドまたはポスターの作成・発表（該当者）', studentAction: '学会での発表を行い、外部研究者からの議論を論文考察へ反映する', guideline: '10月下旬' },
  { idSuffix: '20', category: '05_論文構成・題目届', title: '修士論文の章立て（アウトライン）確定', studentAction: '緒言・方法・結果・考察・結論の詳細アウトラインを作成し指導教員と合意する', guideline: '10月末' },
  { idSuffix: '21', category: '05_論文構成・題目届', title: '修士論文題目（和文・英文）の決定および指導教員承認', studentAction: '研究内容を正確に表す論文題目を決定し、題目届の準備を行う', guideline: '11月上旬' },
  { idSuffix: '22', category: '05_論文構成・題目届', title: '修士論文題目届の正式提出', studentAction: '所定の期日までに修士論文題目届を提出する', guideline: '題目届締切日', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_TITLE_SUBMISSION', offsetDays: 0, deadlineRule: 'EXACT' },
  { idSuffix: '23', category: '06_論文執筆（初稿）', title: '第2章「対象と方法（Materials & Methods）」執筆完了', studentAction: '研究デザイン、対象、測定項目、統計解析手法、倫理的配慮を執筆する', guideline: '11月中旬' },
  { idSuffix: '24', category: '06_論文執筆（初稿）', title: '第3章「結果（Results）」執筆完了', studentAction: '図表を引用しながら客観的な解析結果を過不足なく記述する', guideline: '11月下旬' },
  { idSuffix: '25', category: '06_論文執筆（初稿）', title: '第1章「緒言・背景（Introduction）」執筆完了', studentAction: '社会的・学術的背景、先行研究の到達点と課題、本研究の目的を執筆する', guideline: '12月上旬' },
  { idSuffix: '26', category: '06_論文執筆（初稿）', title: '第4章「考察（Discussion）・限界・結論」執筆完了', studentAction: '主要結果の解釈、先行研究との比較、臨床的・実践的意義、研究の限界を執筆する', guideline: '12月中旬' },
  { idSuffix: '27', category: '06_論文執筆（初稿）', title: '引用文献リスト・要旨（和文・英文）・謝辞の整備', studentAction: '規定の引用スタイルに統一し、和文・英文要旨を作成する', guideline: '12月中旬' },
  { idSuffix: '28', category: '06_論文執筆（初稿）', title: '修士論文 通し初稿（Full Draft v1）の指導教員提出', studentAction: '全章を結合した完全初稿を指導教員へ提出する', guideline: '最終提出30日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_SUBMISSION', offsetDays: -30, deadlineRule: 'EXACT' },
  { idSuffix: '29', category: '07_論文推敲・最終提出', title: '指導教員からの第1回添削コメント反映（改訂稿 v2 作成）', studentAction: '論理展開、記述の正確性、図表の明瞭さに関する指摘を修正する', guideline: '最終提出20日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_SUBMISSION', offsetDays: -20, deadlineRule: 'EXACT' },
  { idSuffix: '30', category: '07_論文推敲・最終提出', title: '副査・共著教員への事前閲読依頼（必要な場合）', studentAction: '改訂稿を関係教員へ共有し、多角的なコメントを受ける', guideline: '最終提出14日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_SUBMISSION', offsetDays: -14, deadlineRule: 'EXACT' },
  { idSuffix: '31', category: '07_論文推敲・最終提出', title: '指導教員からの最終添削反映（最終稿 v3 確定）', studentAction: '全ての修正を完了し、指導教員から提出許可を得る', guideline: '最終提出7日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_SUBMISSION', offsetDays: -7, deadlineRule: 'EXACT' },
  { idSuffix: '32', category: '07_論文推敲・最終提出', title: '書式・体裁・誤字脱字・剽窃チェックの完了', studentAction: '余白、フォント、ページ番号、図表番号、引用の整合性を最終点検する', guideline: '最終提出3日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_SUBMISSION', offsetDays: -3, deadlineRule: 'EXACT' },
  { idSuffix: '33', category: '07_論文推敲・最終提出', title: '提出用PDF出力・印刷製本および付属書類の準備', studentAction: '提出規定部数の準備および電子提出データを確定する', guideline: '最終提出前日', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_SUBMISSION', offsetDays: -1, deadlineRule: 'EXACT' },
  { idSuffix: '34', category: '07_論文推敲・最終提出', title: '修士論文 最終提出', studentAction: '所定の方法・窓口へ修士論文一式を期限内に提出する', guideline: '最終提出締切日', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_THESIS_SUBMISSION', offsetDays: 0, deadlineRule: 'EXACT' },
  { idSuffix: '35', category: '08_最終発表（公聴会）', title: '最終発表（公聴会）用要旨の提出', studentAction: '公聴会配布用の最終要旨を提出する', guideline: '最終発表14日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: -14, deadlineRule: 'EXACT' },
  { idSuffix: '36', category: '08_最終発表（公聴会）', title: '最終発表スライド初稿の作成', studentAction: '修士論文全体を規定時間内にわかりやすく伝えるスライドを作成する', guideline: '最終発表10日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: -10, deadlineRule: 'EXACT' },
  { idSuffix: '37', category: '08_最終発表（公聴会）', title: '最終発表 研究室内リハーサル（第1回）', studentAction: '発表練習を行い、スライド構成と時間配分を調整する', guideline: '最終発表7日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: -7, deadlineRule: 'EXACT' },
  { idSuffix: '38', category: '08_最終発表（公聴会）', title: '最終発表 最終リハーサル・質疑応答対策完了', studentAction: '主査・副査からの想定質問に対する補足資料（Appendix）を完成させる', guideline: '最終発表直前月曜', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: 0, deadlineRule: 'PREVIOUS_MONDAY' },
  { idSuffix: '39', category: '08_最終発表（公聴会）', title: '最終発表スライドファイルの提出', studentAction: '公聴会運営へ最終発表用スライドデータを提出する', guideline: '最終発表2日前', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: -2, deadlineRule: 'EXACT' },
  { idSuffix: '40', category: '08_最終発表（公聴会）', title: '修士論文最終発表会（公聴会）・口頭試問の実施', studentAction: '公聴会での発表および審査委員による口頭試問を受ける', guideline: '最終発表当日', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: 0, deadlineRule: 'EXACT' },
  { idSuffix: '41', category: '09_審査後修正・修了手続', title: '口頭試問・審査委員指摘事項の修正反映', studentAction: '審査での指摘に基づき修士論文の最終修正を行う', guideline: '最終発表7日後', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: 7, deadlineRule: 'EXACT' },
  { idSuffix: '42', category: '09_審査後修正・修了手続', title: '修士論文 最終確定版（保存用）の提出', studentAction: '主査確認済みの最終保存用論文データを提出する', guideline: '最終発表14日後', deadlineType: 'COMMON_EVENT', baseEventKey: 'M2_FINAL_PRESENTATION', offsetDays: 14, deadlineRule: 'EXACT' },
  { idSuffix: '43', category: '09_審査後修正・修了手続', title: '学術雑誌投稿用原稿（論文化）ドラフトの整理', studentAction: '修士論文を基に投稿規定に合わせた学術論文原稿を整理する', guideline: '3月上旬' },
  { idSuffix: '44', category: '09_審査後修正・修了手続', title: '研究データ・解析コード・実験ノートの研究室アーカイブ引継ぎ', studentAction: '研究データの適切な保管手続きと後輩・研究室への引継ぎを完了する', guideline: '3月中旬' },
];

export const INITIAL_ROADMAP_TASKS: RoadmapTask[] = [
  ...M1_TASK_DEFINITIONS.map((def, idx): RoadmapTask => ({
    taskId: `M1-${def.idSuffix}`,
    grade: 'M1',
    category: def.category,
    title: def.title,
    studentAction: def.studentAction,
    requirement: '必須',
    deadlineType: def.baseEventKey ? 'COMMON_EVENT' : 'PERSONAL',
    baseEventKey: def.baseEventKey ?? null,
    offsetDays: def.offsetDays ?? null,
    deadlineRule: def.deadlineRule ?? 'MANUAL',
    guideline: def.guideline,
    progressManaged: true,
    reminderPattern: [14, 7, 3, 0],
    calendarDisplay: false,
    displayOrder: idx + 1,
    notes: '',
    active: true,
  })),
  ...M2_TASK_DEFINITIONS.map((def, idx): RoadmapTask => ({
    taskId: `M2-${def.idSuffix}`,
    grade: 'M2',
    category: def.category,
    title: def.title,
    studentAction: def.studentAction,
    requirement: '必須',
    deadlineType: def.deadlineType ?? 'PERSONAL',
    baseEventKey: def.baseEventKey ?? null,
    offsetDays: def.offsetDays ?? null,
    deadlineRule: def.deadlineRule ?? 'MANUAL',
    guideline: def.guideline,
    progressManaged: true,
    reminderPattern: [14, 7, 3, 0],
    calendarDisplay: false,
    displayOrder: idx + 1,
    notes: '',
    active: true,
  })),
];
