'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Notice {
  id: number;
  text: string;
  link: string | null;
}

const DISMISS_KEY = 'fcscope-notice-dismissed';

/** 공지 배너 — 헤더 아래 한 줄. X로 닫으면 같은 공지는 다시 안 뜸. */
export default function NoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/notice')
      .then((r) => (r.ok ? r.json() : { notice: null }))
      .then((d) => {
        if (!active || !d.notice) return;
        try {
          if (localStorage.getItem(DISMISS_KEY) === String(d.notice.id)) return;
        } catch {}
        setNotice(d.notice);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!notice) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(notice.id));
    } catch {}
    setNotice(null);
  };

  const inner = (
    // block + flex: inline span 에는 overflow 가 안 먹어 말줄임이 안 됐고, 긴 공지가 모든 페이지에 가로 스크롤을 만들었다.
    // "자세히"는 말줄임 밖(flex-none)에 둬 항상 보이게 한다.
    <span className="flex min-w-0 flex-1 items-center">
      <span className="block min-w-0 truncate">📢 {notice.text}</span>
      {notice.link && <span className="ml-1.5 flex-none font-semibold underline underline-offset-2">자세히</span>}
    </span>
  );

  return (
    <div className="border-b border-gold/30 bg-gold/10">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2 text-sm text-ink">
        {notice.link ? (
          <Link href={notice.link} className="flex min-w-0 flex-1" onClick={dismiss}>
            {inner}
          </Link>
        ) : (
          inner
        )}
        <button
          onClick={dismiss}
          aria-label="공지 닫기"
          className="flex h-11 w-11 flex-none items-center justify-center text-muted hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
