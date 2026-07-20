'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser, signOut } from '@/lib/supabase/useUser';
import { createClient } from '@/lib/supabase/client';

const SEEN_KEY = 'fcscope-comments-seen';

interface NotifItem {
  postId: string;
  title: string;
  count: number;
}

export default function AuthButton() {
  const { user, loading, configured } = useUser();
  const [nickname, setNickname] = useState<string | null>(null);
  const [fcNickname, setFcNickname] = useState<string | null>(null);
  const [notif, setNotif] = useState<{ total: number; items: NotifItem[] }>({
    total: 0,
    items: [],
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 내 글 새 댓글 알림 (마지막 확인 시각은 localStorage)
  useEffect(() => {
    if (!user) {
      setNotif({ total: 0, items: [] });
      return;
    }
    let active = true;
    let since = new Date(0).toISOString();
    try {
      since = localStorage.getItem(SEEN_KEY) ?? since;
    } catch {}
    fetch(`/api/me/notifications?since=${encodeURIComponent(since)}`)
      .then((r) => (r.ok ? r.json() : { total: 0, items: [] }))
      .then((d) => {
        if (active) setNotif({ total: d.total ?? 0, items: d.items ?? [] });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNickname(null);
      setFcNickname(null);
      return;
    }
    let active = true;
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('nickname, verified_nickname')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setNickname(data?.nickname ?? null);
          setFcNickname(data?.verified_nickname ?? null);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!configured || loading) return null;

  if (!user)
    return (
      <Link
        href="/login"
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
      >
        로그인
      </Link>
    );

  const openMenu = () => {
    setOpen((v) => {
      const next = !v;
      // 메뉴를 열면 확인한 것으로 간주 — 다음 로드부터 배지 제거
      if (next && notif.total > 0) {
        try {
          localStorage.setItem(SEEN_KEY, new Date().toISOString());
        } catch {}
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openMenu}
        className="relative flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={notif.total > 0 ? `새 댓글 ${notif.total}개` : undefined}
      >
        {notif.total > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lose px-1 text-[11px] font-bold text-white"
          >
            {notif.total > 9 ? '9+' : notif.total}
          </span>
        )}
        <span className="max-w-[7rem] truncate">
          {nickname ?? '내 계정'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          {/* 새 댓글 알림 */}
          {notif.items.length > 0 && (
            <div className="border-b border-line bg-surface-2/50 px-3 py-2">
              <p className="text-[13px] font-semibold text-muted">💬 새 댓글</p>
              {notif.items.map((n) => (
                <Link
                  key={n.postId}
                  href={`/community/${n.postId}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="-mx-1 mt-1 flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm hover:bg-surface-2 hover:text-accent"
                >
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  <span className="flex-none font-bold text-accent">+{n.count}</span>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/me"
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            🏠 마이페이지
          </Link>
          {fcNickname && (
            <Link
              href={`/user/${encodeURIComponent(fcNickname)}`}
              role="menuitem"
              className="block px-4 py-2.5 text-sm font-semibold text-accent hover:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              ⚽ 내 전적
            </Link>
          )}
          <Link
            href="/profile/setup"
            role="menuitem"
            className="block px-4 py-2.5 text-sm hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            프로필 설정
          </Link>
          <Link
            href="/community"
            role="menuitem"
            className="block px-4 py-2.5 text-sm hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            커뮤니티
          </Link>
          <button
            role="menuitem"
            onClick={() => signOut()}
            className="block w-full px-4 py-2.5 text-left text-sm text-lose hover:bg-surface-2"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
