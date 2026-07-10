import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import SearchForm from "./components/SearchForm";
import { getPositionLabel } from "@/lib/nexon/meta";
import { getPlayerNames } from "@/lib/nexon/players";
import { getTodaysVs } from "@/lib/vs";

const UPCOMING = [
  {
    tag: "PHASE 2",
    title: "스쿼드 클리닉",
    desc: "최근 경기에서 스쿼드를 자동으로 읽어 급여 효율·포지션 적합도·랭커 대비 스탯을 진단하고, AI가 교체 카드를 추천합니다.",
  },
  {
    tag: "PHASE 3",
    title: "VS 판독기",
    desc: "“누가 더 좋냐” 논쟁 끝. 랭커들의 실사용 평균 스탯으로 두 선수를 판정하고 투표로 여론을 확인합니다.",
  },
  {
    tag: "PHASE 4",
    title: "현실 라인업 스쿼드",
    desc: "어제 경기 선발 11명 그대로. 실제 팀의 최신 라인업을 FC온라인 카드로 매칭한 스쿼드를 만들어드립니다.",
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
        <p className="scoreboard flex-none text-[10px] font-bold leading-tight tracking-[0.2em] text-gold">
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

      {/* 예정 기능 */}
      <section className="pb-20">
        <h2 className="scoreboard text-xs font-semibold tracking-[0.25em] text-muted">
          COMING NEXT
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {UPCOMING.map((f, i) => (
            <article key={f.title} className={`panel rise rise-${i + 1} p-5`}>
              <p className="scoreboard text-[10px] font-bold tracking-[0.2em] text-gold">
                {f.tag}
              </p>
              <h3 className="mt-2 text-base font-bold">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                {f.desc}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
