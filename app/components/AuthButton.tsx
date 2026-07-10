'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser, signOut } from '@/lib/supabase/useUser';
import { createClient } from '@/lib/supabase/client';

export default function AuthButton() {
  const { user, loading, configured } = useUser();
  const [nickname, setNickname] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setNickname(null);
      return;
    }
    let active = true;
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setNickname(data?.nickname ?? null);
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
        className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold hover:bg-surface-2"
      >
        로그인
      </Link>
    );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
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
          className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <Link
            href="/profile/setup"
            role="menuitem"
            className="block px-4 py-2.5 text-[13px] hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            프로필 설정
          </Link>
          <Link
            href="/community/clubs"
            role="menuitem"
            className="block px-4 py-2.5 text-[13px] hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            클럽 모집
          </Link>
          <button
            role="menuitem"
            onClick={() => signOut()}
            className="block w-full px-4 py-2.5 text-left text-[13px] text-lose hover:bg-surface-2"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
