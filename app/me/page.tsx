"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/supabase/useUser";
import { loadMySquads, MAX_MY_SQUADS, type MySquad } from "@/app/components/MySquadPicker";
import { POST_TYPES } from "@/lib/community/post-types";

const RECENT_KEY = "fcscope-recent-searches";

interface Profile {
  nickname: string | null;
  verified_nickname: string | null;
}
interface MyPost {
  id: string;
  type: string;
  title: string;
  created_at: string;
}

export default function MyPage() {
  const { user, loading, configured } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [squads, setSquads] = useState<MySquad[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    setSquads(loadMySquads());
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(raw)) setRecent(raw.filter((x) => typeof x === "string").slice(0, 8));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.profile ?? null);
        setPosts(Array.isArray(d.posts) ? d.posts : []);
      })
      .catch(() => {})
      .finally(() => setFetched(true));
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="skeleton h-40" />
      </div>
    );
  }

  // 비로그인 — 로그인 유도(스쿼드/최근검색은 기기 기준으로 여전히 보여줌)
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold sm:text-3xl">마이페이지</h1>

      {/* 계정 / 연동 구단주 */}
      <section className="panel mt-4 p-5">
        {!configured || !user ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              로그인하면 연동 구단주·내 글을 한 곳에서 볼 수 있어요.
            </p>
            <Link
              href="/login"
              className="scoreboard flex-none rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink"
            >
              Google 로그인
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold">
                {profile?.nickname ?? "닉네임 미등록"}
              </p>
              {profile?.verified_nickname ? (
                <p className="text-sm text-accent">✓ 구단주 {profile.verified_nickname}</p>
              ) : (
                <p className="text-sm text-muted">구단주명 미연동</p>
              )}
            </div>
            {profile?.verified_nickname ? (
              <Link
                href={`/user/${encodeURIComponent(profile.verified_nickname)}`}
                className="scoreboard flex-none rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink"
              >
                내 전적·진단
              </Link>
            ) : (
              <Link
                href="/profile/setup"
                className="scoreboard flex-none rounded-lg bg-surface-2 px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-line"
              >
                {profile?.nickname ? "구단주 연동" : "닉네임 등록"}
              </Link>
            )}
          </div>
        )}
      </section>

      {/* 내 스쿼드 */}
      <section className="panel mt-3 p-5">
        <div className="flex items-baseline justify-between">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            내 스쿼드
          </p>
          <span className="scoreboard text-[13px] text-muted">
            {squads.length}/{MAX_MY_SQUADS}
          </span>
        </div>
        {squads.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            아직 저장한 스쿼드가 없어요.{" "}
            <Link href="/squad" className="text-accent underline underline-offset-2">
              스쿼드 빌더로 →
            </Link>
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {squads.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/squad/${encodeURIComponent(s.id)}`}
                  className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 transition-colors hover:bg-line"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                  <span className="scoreboard flex-none text-[13px] text-muted">{s.formation}</span>
                  <span className="scoreboard flex-none text-xs text-accent">열기 →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 최근 검색 */}
      {recent.length > 0 && (
        <section className="panel mt-3 p-5">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            최근 검색
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <Link
                key={r}
                href={`/user/${encodeURIComponent(r)}`}
                className="scoreboard rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line"
              >
                {r}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 내 커뮤니티 글 */}
      {user && (
        <section className="panel mt-3 p-5">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            내가 쓴 글
          </p>
          {!fetched ? (
            <div className="skeleton mt-3 h-10" />
          ) : posts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              아직 쓴 글이 없어요.{" "}
              <Link href="/community" className="text-accent underline underline-offset-2">
                커뮤니티로 →
              </Link>
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/community/${p.id}`}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 transition-colors hover:bg-line"
                  >
                    <span className="flex-none text-[13px]">
                      {POST_TYPES[p.type as keyof typeof POST_TYPES]?.emoji ?? "📝"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                    <span className="scoreboard flex-none text-xs text-accent">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
