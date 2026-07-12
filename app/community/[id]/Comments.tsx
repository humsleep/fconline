'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRelativeKr } from '@/lib/format';
import MySquadPicker from '@/app/components/MySquadPicker';

export interface CommentView {
  id: string;
  body: string;
  squad_id: string | null;
  created_at: string;
  authorName: string;
  isOwn: boolean;
}

// 닉네임 이니셜 아바타 — 이름 해시로 색 고정(같은 사람 = 같은 색)
const AVATAR_COLORS = [
  'bg-accent/20 text-accent',
  'bg-gold/20 text-gold',
  'bg-win/20 text-win',
  'bg-lose/15 text-lose',
  'bg-surface-2 text-ink',
];

function Avatar({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const color = AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold ${color}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function Comments({
  postId,
  comments,
  canWrite,
  loggedIn,
}: {
  postId: string;
  comments: CommentView[];
  canWrite: boolean; // 로그인 + 닉네임 보유
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [squadId, setSquadId] = useState('');
  const [showSquad, setShowSquad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          squad_id: squadId.trim() || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '등록 실패');
      setBody('');
      setSquadId('');
      setShowSquad(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (commentId: string) => {
    if (!window.confirm('댓글을 삭제할까요?')) return;
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId }),
      });
      if (res.ok) router.refresh();
    } catch {
      // 무시 — 새로고침으로 상태 확인 가능
    }
  };

  return (
    <section className="panel mt-4 p-5">
      <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
        댓글 {comments.length > 0 && `(${comments.length})`}
      </p>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          아직 댓글이 없어요. 첫 의견을 남겨보세요!
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar name={c.authorName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-semibold text-ink">{c.authorName}</span>
                  <span className="text-muted">{formatRelativeKr(c.created_at)}</span>
                  {c.isOwn && (
                    <button
                      onClick={() => remove(c.id)}
                      className="ml-auto text-[13px] text-lose"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="mt-1 rounded-xl rounded-tl-sm bg-surface-2 px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {c.body}
                  </p>
                  {c.squad_id && (
                    <Link
                      href={`/squad/${encodeURIComponent(c.squad_id)}`}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-[13px] font-semibold text-accent"
                    >
                      🧩 제안 스쿼드 보기 →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 입력 */}
      {canWrite ? (
        <div className="mt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="의견을 남겨보세요 (스쿼드 평가·조언 환영!)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {showSquad ? (
            <div className="mt-2">
              <MySquadPicker
                value={squadId}
                onChange={setSquadId}
                placeholder="제안 스쿼드 공유코드"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowSquad(true)}
              className="mt-1 text-[13px] text-muted underline underline-offset-2"
            >
              + 제안 스쿼드 첨부
            </button>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={submit}
              disabled={busy || !body.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
            >
              {busy ? '등록 중…' : '댓글 등록'}
            </button>
            {error && <p className="text-sm text-lose">{error}</p>}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {loggedIn ? (
            <>
              댓글을 쓰려면{' '}
              <Link href="/profile/setup" className="text-accent underline underline-offset-2">
                닉네임 등록
              </Link>
              이 필요해요.
            </>
          ) : (
            <>
              <Link href="/login" className="text-accent underline underline-offset-2">
                로그인
              </Link>
              하고 의견을 남겨보세요.
            </>
          )}
        </p>
      )}
    </section>
  );
}
