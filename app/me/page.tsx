"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/supabase/useUser";
import { forgetMySquad, loadMySquads, MAX_MY_SQUADS, type MySquad } from "@/app/components/MySquadPicker";
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
interface ServerSquad {
  id: string;
  name: string;
  formation: string;
}
interface Snapshot {
  winRate: number;
  avgRating: number;
  played: number;
  deltaWinRate: number | null;
  deltaRating: number | null;
  prevDate: string | null;
}

export default function MyPage() {
  const { user, loading, configured } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [serverSquads, setServerSquads] = useState<ServerSquad[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
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
        setServerSquads(Array.isArray(d.squads) ? d.squads : []);
        setSnapshot(d.snapshot ?? null);
      })
      .catch(() => {})
      .finally(() => setFetched(true));
  }, [user]);

  // 서버(계정 귀속, 크로스기기) 우선 + 이 기기 로컬 스쿼드 중 서버에 없는 것 추가
  const mergedSquads: { id: string; name: string; formation: string; isServer: boolean }[] = [
    ...serverSquads.map((s) => ({ ...s, isServer: true })),
    ...squads
      .filter((ls) => !serverSquads.some((sv) => sv.id === ls.id))
      .map((s) => ({ id: s.id, name: s.name, formation: s.formation, isServer: false })),
  ];

  const [deleting, setDeleting] = useState<string | null>(null);
  async function deleteSquad(id: string, isServer: boolean) {
    const ok = window.confirm(
      isServer
        ? "이 스쿼드를 완전히 삭제할까요? 공유 링크도 열리지 않게 됩니다."
        : "이 스쿼드를 목록에서 제거할까요?"
    );
    if (!ok) return;
    setDeleting(id);
    try {
      if (isServer) {
        const res = await fetch(`/api/squad/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "삭제하지 못했어요.");
        }
        setServerSquads((l) => l.filter((s) => s.id !== id));
      }
      forgetMySquad(id);
      setSquads(loadMySquads());
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "삭제하지 못했어요.");
    } finally {
      setDeleting(null);
    }
  }

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
              className="scoreboard flex-none rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-ink"
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
                className="scoreboard flex-none rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-ink"
              >
                내 전적·진단
              </Link>
            ) : (
              <Link
                href="/profile/setup"
                className="scoreboard flex-none rounded-lg bg-surface-2 px-4 py-3 text-sm font-bold text-ink transition-colors hover:bg-line"
              >
                {profile?.nickname ? "구단주 연동" : "닉네임 등록"}
              </Link>
            )}
          </div>
        )}
      </section>

      {/* 지난 방문 대비 변화 — 재방문 훅 */}
      {snapshot && (
        <section className="panel mt-3 p-5">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            지난 방문 대비
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-[13px] text-muted">최근 {snapshot.played}경기 승률</p>
              <p className="scoreboard text-2xl font-bold">
                <span className="text-accent">{snapshot.winRate}%</span>
                {snapshot.deltaWinRate !== null && (
                  <span
                    className={`ml-2 text-base ${
                      snapshot.deltaWinRate > 0
                        ? "text-win"
                        : snapshot.deltaWinRate < 0
                          ? "text-lose"
                          : "text-muted"
                    }`}
                  >
                    {snapshot.deltaWinRate > 0
                      ? `▲${snapshot.deltaWinRate}%p`
                      : snapshot.deltaWinRate < 0
                        ? `▼${-snapshot.deltaWinRate}%p`
                        : "±0"}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[13px] text-muted">평균 평점</p>
              <p className="scoreboard text-2xl font-bold text-gold">
                {snapshot.avgRating.toFixed(2)}
                {snapshot.deltaRating !== null && snapshot.deltaRating !== 0 && (
                  <span
                    className={`ml-2 text-base ${snapshot.deltaRating > 0 ? "text-win" : "text-lose"}`}
                  >
                    {snapshot.deltaRating > 0 ? `▲${snapshot.deltaRating}` : `▼${-snapshot.deltaRating}`}
                  </span>
                )}
              </p>
            </div>
          </div>
          <p className="mt-1.5 text-[12px] text-muted">
            {snapshot.deltaWinRate === null
              ? "내일 다시 방문하면 지난 방문과 비교해 변화를 보여드려요."
              : `${snapshot.prevDate} 방문 대비`}
          </p>
        </section>
      )}

      {/* 내 스쿼드 */}
      <section className="panel mt-3 p-5">
        <div className="flex items-baseline justify-between">
          <p className="scoreboard text-[13px] font-semibold tracking-[0.2em] text-muted">
            내 스쿼드
          </p>
          <span className="scoreboard text-[13px] text-muted">
            {mergedSquads.length}
            {!user && `/${MAX_MY_SQUADS}`}
          </span>
        </div>
        {mergedSquads.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            아직 저장한 스쿼드가 없어요.{" "}
            <Link href="/squad" className="text-accent underline underline-offset-2">
              스쿼드 빌더로 →
            </Link>
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {mergedSquads.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5">
                <Link
                  href={`/squad/${encodeURIComponent(s.id)}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                  <span className="scoreboard flex-none text-[13px] text-muted">{s.formation}</span>
                </Link>
                <Link
                  href={`/squad?load=${encodeURIComponent(s.id)}`}
                  className="scoreboard flex min-h-11 flex-none items-center rounded px-2 text-[13px] font-semibold text-accent transition-colors hover:bg-line"
                  aria-label={`${s.name} 수정`}
                >
                  수정
                </Link>
                <button
                  onClick={() => deleteSquad(s.id, s.isServer)}
                  disabled={deleting === s.id}
                  className="scoreboard flex min-h-11 flex-none items-center rounded px-2 text-[13px] font-semibold text-lose transition-colors hover:bg-line disabled:opacity-50"
                  aria-label={`${s.name} 삭제`}
                >
                  {deleting === s.id ? "삭제 중…" : "삭제"}
                </button>
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
                className="scoreboard inline-flex min-h-11 items-center rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line"
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
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 transition-colors hover:bg-line"
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
