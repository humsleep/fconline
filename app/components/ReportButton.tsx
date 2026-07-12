'use client';

import { useState } from 'react';

const REASONS = [
  { key: 'spam', label: '스팸·도배·광고' },
  { key: 'abuse', label: '욕설·비하·혐오' },
  { key: 'illegal', label: '불법·음란·거래 유도' },
  { key: 'other', label: '기타' },
] as const;

/** 글/댓글 신고 버튼 — 사유 선택 시트, 같은 대상 1인 1회. */
export default function ReportButton({
  targetType,
  targetId,
  className = '',
}: {
  targetType: 'post' | 'comment';
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const report = async (reason: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/community/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) setDone('신고하려면 로그인이 필요해요.');
      else if (!res.ok) setDone(d.error ?? '신고에 실패했어요.');
      else setDone('신고가 접수됐어요. 확인 후 조치할게요.');
    } catch {
      setDone('신고에 실패했어요.');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  if (done)
    return <span className={`text-[13px] text-muted ${className}`}>{done}</span>;

  return (
    <span className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[13px] text-muted underline underline-offset-2 hover:text-lose"
      >
        신고
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-40 flex w-44 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {REASONS.map((r) => (
            <button
              key={r.key}
              disabled={busy}
              onClick={() => report(r.key)}
              className="px-3 py-2.5 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setOpen(false)}
            className="border-t border-line px-3 py-2 text-left text-[13px] text-muted hover:bg-surface-2"
          >
            취소
          </button>
        </span>
      )}
    </span>
  );
}
