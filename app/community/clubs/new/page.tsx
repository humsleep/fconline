'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/lib/supabase/useUser';
import {
  REGIONS,
  POSITION_OPTIONS,
  TITLE_MAX,
  BODY_MAX,
} from '@/lib/community/constants';

export default function NewClubPost() {
  const { user, loading, configured } = useUser();
  const router = useRouter();

  const [hasNickname, setHasNickname] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [region, setRegion] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [playStyle, setPlayStyle] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?next=/community/clubs/new');
      return;
    }
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => setHasNickname(Boolean(d.profile?.nickname)))
      .catch(() => setHasNickname(false));
  }, [user, loading, router]);

  const togglePos = (p: string) =>
    setPositions((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : cur.length < 6 ? [...cur, p] : cur
    );

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 입력하세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/community/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          region: region || null,
          positions,
          play_style: playStyle.trim() || null,
          contact: contact.trim() || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '등록 실패');
      if (!d.id) throw new Error('등록은 됐지만 이동에 실패했어요. 목록에서 확인하세요.');
      router.push(`/community/clubs/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
      setSubmitting(false);
    }
  };

  if (loading || hasNickname === null)
    return <div className="p-12 text-center text-muted">불러오는 중…</div>;
  if (!configured)
    return (
      <div className="mx-auto max-w-md p-12 text-center text-muted">
        로그인 설정이 완료되지 않았습니다.
      </div>
    );
  if (!hasNickname)
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm text-muted">
          모집 글을 쓰려면 커뮤니티 닉네임이 필요합니다.
        </p>
        <Link
          href="/profile/setup"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          닉네임 등록하기
        </Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">클럽 모집 글 쓰기</h1>

      <div className="mt-6 space-y-5">
        <Field label={`제목 (${title.length}/${TITLE_MAX})`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="예) 주말 저녁 같이 뛸 클럽원 구해요"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="지역">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">선택 안 함</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`모집 포지션 (${positions.length}/6)`}>
          <div className="flex flex-wrap gap-1.5">
            {POSITION_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePos(p)}
                className={
                  'scoreboard rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition ' +
                  (positions.includes(p)
                    ? 'bg-accent text-accent-ink'
                    : 'bg-surface-2 text-muted hover:text-ink')
                }
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`내용 (${body.length}/${BODY_MAX})`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            rows={6}
            placeholder="활동 시간대, 지향하는 플레이, 클럽 분위기 등을 적어주세요."
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="지향 플레이 (선택)">
          <input
            value={playStyle}
            onChange={(e) => setPlayStyle(e.target.value.slice(0, 60))}
            placeholder="예) 점유율 축구, 빠른 역습"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="연락 수단 (선택)">
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value.slice(0, 120))}
            placeholder="오픈채팅 링크, 디스코드 등"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        {error && <p className="text-sm text-lose">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {submitting ? '등록 중…' : '등록'}
          </button>
          <Link
            href="/community/clubs"
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface-2"
          >
            취소
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
