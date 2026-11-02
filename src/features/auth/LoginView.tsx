/**
 * ログイン画面 & 初回パスワード変更画面
 * MASTER_SPEC.md #7〜#14 に完全準拠
 * - 表示は「大学院研究進捗管理」「メールアドレス」「パスワード」「ログイン」のみ
 * - OTP・メールリンク・自己登録リンクは一切表示しない
 * - パスワードを忘れた場合は管理者へ問い合わせる旨を案内
 */

import React, { useState } from 'react';
import { AlertCircle, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<string | null>;
  isDemoMode: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, isDemoMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const err = await onLogin(email.trim(), password);
      if (err) {
        setError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl bg-[#0B1F3A] px-6 py-6 text-center text-white shadow-lg">
          <h1 className="text-xl font-bold tracking-wide sm:text-2xl">
            大学院研究進捗管理
          </h1>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10">
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                メールアドレス
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  placeholder="example@nittai.ac.jp"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                パスワード
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            パスワードを忘れた場合は管理者へお問い合わせください
          </p>

          {isDemoMode && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="mb-2.5 text-xs font-semibold text-slate-500">
                開発検証用ワンクリック入力（ローカル検証モード）：
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('s001@nittai.ac.jp', 'password123')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  学生 (M2・青木)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('s002@nittai.ac.jp', 'initpass123')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  学生 (初回PW変更)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('admin@nittai.ac.jp', 'adminpassword')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  管理者 (佐藤教授)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('dual@nittai.ac.jp', 'dualpassword')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  兼務 (学生＋管理者)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ForcePasswordChangeViewProps {
  userEmail: string;
  onChangePassword: (newPassword: string) => Promise<string | null>;
  onLogout: () => void;
}

export const ForcePasswordChangeView: React.FC<ForcePasswordChangeViewProps> = ({
  userEmail,
  onChangePassword,
  onLogout,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('新しいパスワードは8文字以上で設定してください。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('確認用パスワードが一致しません。');
      return;
    }
    setSubmitting(true);
    try {
      const err = await onChangePassword(newPassword);
      if (err) {
        setError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl bg-[#0B1F3A] px-6 py-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-bold">初回パスワード変更</h1>
              <p className="text-xs text-slate-300">{userEmail}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10">
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>
              初期パスワードまたは仮パスワードでログインされています。利用を開始する前に、ご自身の新しいパスワード（8文字以上）を設定してください。
            </span>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                新しいパスワード（8文字以上）
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                新しいパスワード（確認入力）
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? '更新中...' : 'パスワードを変更して開始'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={onLogout}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              ログアウトして戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
