/**
 * 状態バッジ・期限バッジ共通コンポーネント (#54, #55)
 * 色だけで状態を表現せず、必ず「アイコン＋テキストラベル」を併用する
 */

import React from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  MinusCircle,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import type { DeadlineStateLabel, ProgressStatus } from '../types/domain';
import { PROGRESS_STATUS_LABELS } from '../types/domain';

export const StatusBadge: React.FC<{ status: ProgressStatus }> = ({ status }) => {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {PROGRESS_STATUS_LABELS[status]}
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          <PlayCircle className="h-3.5 w-3.5 shrink-0" />
          {PROGRESS_STATUS_LABELS[status]}
        </span>
      );
    case 'ON_HOLD':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          <PauseCircle className="h-3.5 w-3.5 shrink-0" />
          {PROGRESS_STATUS_LABELS[status]}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          <MinusCircle className="h-3.5 w-3.5 shrink-0" />
          {PROGRESS_STATUS_LABELS[status]}
        </span>
      );
  }
};

export const DeadlineBadge: React.FC<{
  label: DeadlineStateLabel;
  remainingDays: number | null;
}> = ({ label, remainingDays }) => {
  const daysText =
    remainingDays === null
      ? ''
      : remainingDays < 0
      ? `（${Math.abs(remainingDays)}日超過）`
      : remainingDays === 0
      ? '（今日）'
      : `（残り${remainingDays}日）`;

  switch (label) {
    case '期限超過':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {label}
          {daysText}
        </span>
      );
    case '本日':
    case 'まもなく':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {label}
          {daysText}
        </span>
      );
    case '完了':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {label}
        </span>
      );
    case '予定':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {label}
          {daysText}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          <MinusCircle className="h-3.5 w-3.5 shrink-0" />
          {label}
        </span>
      );
  }
};
