import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import SearchForm from "./components/SearchForm";
import { getPositionLabel } from "@/lib/nexon/meta";
import { getPlayerNames } from "@/lib/nexon/players";
import { getTodaysVs } from "@/lib/vs";

const FEATURES = [
  {
    tag: "매치 리포트",
    title: "슛맵으로 왜 졌는지 본다",
    desc: "경기별 슛 좌표·선수 평점·POTM까지. 점유율 말고 진짜 원인을 짚어줍니다.",
    hint: "구단주명 검색 → 경기 선택",
    href: null,
  },
  {
    tag: "선수 성적표",
    title: "내 카드, 랭커 대비 몇 점?",
    desc: "내 스쿼드 선수별 실사용 평점을 랭커 평균과 나란히. 능력치가 아니라 실전 데이터로.",
    hint: "구단주명 검색 → 선수 성적표",
    href: null,
  },
  {
    tag: "라이브 세션",
    title: "켜두면 자동으로 분석",
    desc: "게임하는 동안 켜두면 경기가 끝날 때마다 세션 전적·연승·평점이 실시간처럼 갱신됩니다.",
    hint: "구단주명 검색 → 라이브 세션",
    href: null,
  },
  {
    tag: "오늘의 VS",
    title: "누가 더 센지 판정 + 투표",
    desc: "랭커 실사용 데이터로 두 선수를 판정하고 예측 투표. 매일 새로운 대결이 열립니다.",
    hint: "바로가기 →",
    href: "/vs",
  },
  {
    tag: "스쿼드 빌더",
    title: "리그·팀 스쿼드 만들고 공유",
    desc: "포메이션에 선수를 배치해 나만의 스쿼드를. 프리미어리그 아스날처럼 팀을 고르면 자동으로 채워집니다.",
    hint: "바로가기 →",
    href: "/squad",
  },
] as const;

async function VsTeaser() {
  const today = await getTodaysVs().catch(() => null);
  if (!today) return null;

  const names = await getPlayerNames([today.aSpId, today.bSpId]);
  const aName = names.get(today.aSpId) ?? `선수 ${today.aSpId}`;
  const bName = names.get(today.bSpId) ?? `선수 ${today.bSpId}`;

  return (
    <section className="pb-10">
      <Link
        href="/vs"
        className="panel group flex items-center gap-3 p-4 transition-colors hover:border-gold/50 sm:gap-5 sm:p-5"
      >
        <p className="scoreboard flex-none text-[12px] font-bold leading-tight tracking-[0.2em] text-gold">
          오늘의
          <br />
          VS
        </p>
        <VsFace spId={today.aSpId} name={aName} />
        <span className="scoreboard flex-none text-sm font-bold text-muted">VS</span>
        <VsFace spId={today.bSpId} name={bName} />
        <span className="scoreboard ml-auto hidden flex-none text-xs font-bold text-muted transition-colors group-hover:text-gold sm:block">
          {getPositionLabel(today.pos)} · 누가 셀까? →
        </span>
      </Link>
    </section>
  );
}

function VsFace({ spId, name }: { spId: number; name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Image
        src={`/api/player-image/${spId}`}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="h-9 w-9 flex-none rounded-lg bg-surface-2 object-cover"
      />
      <span className="truncate text-sm font-bold">{name}</span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      {/* 히어로 */}
      <section className="relative flex flex-col items-center pb-16 pt-16 text-center sm:pb-24 sm:pt-24">
        {/* 피치 라인 아트 */}
        <svg
          aria-hidden
          viewBox="0 0 400 240"
          className="pointer-events-none absolute inset-x-0 top-4 mx-auto h-56 w-full max-w-lg opacity-[0.08]"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
        >
          <rect x="20" y="10" width="360" height="220" rx="4" />
          <line x1="20" y1="120" x2="380" y2="120" />
          <circle cx="200" cy="120" r="42" />
          <circle cx="200" cy="120" r="3" fill="var(--accent)" stroke="none" />
        </svg>

        <p className="rise scoreboard relative text-xs font-semibold tracking-[0.3em] text-accent">
          EA SPORTS FC ONLINE DATA LAB
        </p>
        <h1 className="rise rise-1 relative mt-5 text-4xl font-bold leading-tight sm:text-5xl">
          감이 아니라,
          <br className="sm:hidden" /> <span className="text-accent">데이터</span>로.
        </h1>
        <p className="rise rise-2 relative mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          전적 조회를 넘어 진단까지. 구단주명을 검색하면{" "}
          <br className="hidden sm:block" />
          최근 경기 기록과 통계를 바로 보여드립니다.
        </p>

        <div className="rise rise-3 relative mt-8 w-full max-w-md">
          <SearchForm size="lg" />
        </div>
      </section>

      {/* 오늘의 VS 히어로 */}
      <Suspense fallback={null}>
        <VsTeaser />
      </Suspense>

      {/* 기능 */}
      <section className="pb-24 md:pb-16">
        <h2 className="scoreboard text-xs font-semibold tracking-[0.25em] text-muted">
          여기서 할 수 있는 것
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f, i) => {
            const inner = (
              <>
                <p className="scoreboard text-[12px] font-bold tracking-[0.2em] text-gold">
                  {f.tag}
                </p>
                <h3 className="mt-2 text-base font-bold">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {f.desc}
                </p>
                <p
                  className={`mt-3 text-[13px] font-semibold ${
                    f.href ? "text-accent" : "text-muted"
                  }`}
                >
                  {f.hint}
                </p>
              </>
            );
            const cls = `panel rise rise-${i + 1} block p-5`;
            return f.href ? (
              <Link
                key={f.title}
                href={f.href}
                className={`${cls} transition-colors hover:border-accent/50`}
              >
                {inner}
              </Link>
            ) : (
              <article key={f.title} className={cls}>
                {inner}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
