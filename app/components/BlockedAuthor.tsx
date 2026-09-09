'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { BLOCKLIST_EVENT, blockUser, isBlocked, unblockUser } from '@/lib/client/blocklist';

function subscribe(cb: () => void) {
  window.addEventListener(BLOCKLIST_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(BLOCKLIST_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** SSR 에선 항상 false(차단 목록은 기기 로컬) → 하이드레이션 후 실제 값으로. */
function useBlocked(authorId: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isBlocked(authorId),
    () => false
  );
}

/**
 * 차단한 작성자의 콘텐츠 래퍼.
 * - mode="hide": 목록에서 통째로 숨김
 * - mode="notice": 자리에 "차단한 사용자" 안내 + 해제 버튼
 * 서버 컴포넌트 children 을 그대로 통과시키므로 목록/상세 어디서나 감쌀 수 있다.
 */
export default function BlockedAuthor({
  authorId,
  mode = 'hide',
  children,
}: {
  authorId: string | null | undefined;
  mode?: 'hide' | 'notice';
  children: ReactNode;
}) {
  const blocked = useBlocked(authorId);
  if (!blocked) return <>{children}</>;
  if (mode === 'hide') return null;
  return (
    <div className="panel mt-3 flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-muted">
      <span>차단한 사용자의 글이에요.</span>
      <button
        onClick={() => authorId && unblockUser(authorId)}
        className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-surface-2"
      >
        차단 해제
      </button>
    </div>
  );
}

/** "차단" 버튼 — 신고 버튼 옆에 두는 작은 텍스트 버튼. 확인 후 즉시 숨김. */
export function BlockButton({
  authorId,
  authorName,
  className = '',
}: {
  authorId: string;
  authorName?: string;
  className?: string;
}) {
  return (
    <button
      onClick={() => {
        const who = authorName ? `${authorName} 님` : '이 사용자';
        if (window.confirm(`${who}을 차단할까요?\n이 기기에서 해당 사용자의 글과 댓글이 보이지 않게 됩니다. 마이페이지에서 해제할 수 있어요.`))
          blockUser(authorId);
      }}
      className={`text-[13px] text-muted underline underline-offset-2 hover:text-lose ${className}`}
    >
      차단
    </button>
  );
}
