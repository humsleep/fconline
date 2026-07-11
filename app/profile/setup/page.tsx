'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/lib/supabase/useUser';
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  validateNickname,
} from '@/lib/community/constants';

interface Profile {
  nickname: string;
  verified_nickname: string | null;
  verified_ouid: string | null;
}

export default function ProfileSetupPage() {
  const { user, loading, configured } = useUser();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState('');
  const [fcName, setFcName] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?next=/profile/setup');
      return;
    }
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setProfile(d.profile);
          setNickname(d.profile.nickname ?? '');
          setFcName(d.profile.verified_nickname ?? '');
        }
      })
      .catch(() => {});
  }, [user, loading, router]);

  const saveNickname = async () => {
    const invalid = validateNickname(nickname);
    if (invalid) {
      setMsg({ text: invalid, ok: false });
      return;
    }
    setSavingNick(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '저장 실패');
      setProfile((p) => ({
        nickname: nickname.trim(),
        verified_nickname: p?.verified_nickname ?? null,
        verified_ouid: p?.verified_ouid ?? null,
      }));
      setMsg({ text: '닉네임을 저장했어요.', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : '저장 실패', ok: false });
    } finally {
      setSavingNick(false);
    }
  };

  const verifyFc = async () => {
    if (!fcName.trim()) return;
    setVerifying(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: fcName.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '연동 실패');
      setProfile((p) =>
        p
          ? { ...p, verified_nickname: fcName.trim(), verified_ouid: d.ouid ?? '' }
          : p
      );
      setMsg({ text: 'FC Online 구단주명을 연동했어요.', ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : '연동 실패', ok: false });
    } finally {
      setVerifying(false);
    }
  };

  if (loading)
    return <div className="p-12 text-center text-muted">불러오는 중…</div>;
  if (!configured)
    return (
      <div className="mx-auto max-w-md p-12 text-center text-muted">
        로그인 준비 중이에요. 잠시 후 다시 시도해 주세요.
      </div>
    );

  const hasNickname = Boolean(profile?.nickname);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold">프로필 설정</h1>
      <p className="mt-1 text-sm text-muted">
        커뮤니티 활동에 쓸 닉네임을 정하고, 내 FC Online 구단주명을 연동하세요.
      </p>

      {/* 닉네임 */}
      <section className="panel mt-6 p-5">
        <h2 className="text-sm font-bold">커뮤니티 닉네임</h2>
        <p className="mt-1 text-[13px] text-muted">
          {NICKNAME_MIN}~{NICKNAME_MAX}자. 커뮤니티 글에 표시됩니다.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX}
            placeholder="닉네임"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={saveNickname}
            disabled={savingNick}
            className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {savingNick ? '저장 중…' : hasNickname ? '변경' : '등록'}
          </button>
        </div>
      </section>

      {/* FC Online 구단주명 연동 */}
      <section className="panel mt-4 p-5">
        <h2 className="text-sm font-bold">FC Online 구단주명 연동</h2>
        <p className="mt-1 text-[13px] text-muted">
          연동하면 내 커뮤니티 글에 전적 카드가 자동으로 붙습니다.
          {!hasNickname && ' (닉네임 등록 후 가능)'}
        </p>
        {profile?.verified_nickname && (
          <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 text-[13px] text-accent">
            연동됨: <b>{profile.verified_nickname}</b>
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={fcName}
            onChange={(e) => setFcName(e.target.value)}
            placeholder="FC Online 구단주명"
            disabled={!hasNickname}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            onClick={verifyFc}
            disabled={verifying || !hasNickname}
            className="flex-none rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
          >
            {verifying ? '확인 중…' : '연동'}
          </button>
        </div>
      </section>

      {msg && (
        <p
          className={
            'mt-4 text-sm ' + (msg.ok ? 'text-accent' : 'text-lose')
          }
        >
          {msg.text}
        </p>
      )}

      <div className="mt-6 flex gap-3 text-[13px]">
        <Link href="/community" className="text-accent underline underline-offset-2">
          커뮤니티 보러가기
        </Link>
        <Link href="/" className="text-muted underline underline-offset-2">
          홈
        </Link>
      </div>
    </div>
  );
}
