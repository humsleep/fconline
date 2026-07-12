'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ModerateButtons({
  targetType,
  targetId,
  hidden,
}: {
  targetType: 'post' | 'comment';
  targetId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const act = async (action: 'hide' | 'unhide' | 'delete') => {
    if (action === 'delete' && !window.confirm('대상을 완전히 삭제할까요?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-none gap-1.5">
      <button
        onClick={() => act(hidden ? 'unhide' : 'hide')}
        disabled={busy}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-semibold hover:bg-surface-2 disabled:opacity-50"
      >
        {hidden ? '해제' : '숨김'}
      </button>
      <button
        onClick={() => act('delete')}
        disabled={busy}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-semibold text-lose hover:bg-surface-2 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}

export function NoticeForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const publish = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), link: link.trim() || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '실패');
      setText('');
      setLink('');
      setMsg('공지를 게시했어요.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '실패');
    } finally {
      setBusy(false);
    }
  };

  const takeDown = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/notice', { method: 'DELETE' });
      if (res.ok) {
        setMsg('공지를 내렸어요.');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {current && (
        <div className="flex items-center gap-2 rounded-lg bg-gold/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">📢 {current}</span>
          <button
            onClick={takeDown}
            disabled={busy}
            className="flex-none text-[13px] font-semibold text-lose"
          >
            내리기
          </button>
        </div>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 200))}
        placeholder="새 공지 내용 (게시 시 기존 공지는 자동 교체)"
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value.slice(0, 120))}
          placeholder="링크(선택, /community 처럼 내부 경로)"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={publish}
          disabled={busy || !text.trim()}
          className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          게시
        </button>
      </div>
      {msg && <p className="mt-2 text-[13px] text-accent">{msg}</p>}
    </div>
  );
}
