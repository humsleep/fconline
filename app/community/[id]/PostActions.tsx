'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PostActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState(status);

  const toggle = async () => {
    setBusy(true);
    const next = cur === 'open' ? 'closed' : 'open';
    try {
      const res = await fetch(`/api/community/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setCur(next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/community/posts/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/community');
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 flex gap-2 border-t border-line pt-4">
      <button
        onClick={toggle}
        disabled={busy}
        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
      >
        {cur === 'open' ? '마감하기' : '다시 열기'}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-lose hover:bg-surface-2 disabled:opacity-60"
      >
        삭제
      </button>
    </div>
  );
}
