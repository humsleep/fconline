import Link from "next/link";
import SearchForm from "./components/SearchForm";
import FocusSearchCard from "./components/FocusSearchCard";
import { DEMO_NICKNAME } from "@/lib/demo";

const FEATURES = [
  {
    tag: "전적 · 분석 리포트",
    title: "슛맵부터 스쿼드 진단까지",
    desc: "경기별 슛맵, 선수 성적표, 플레이스타일, 이적시장 내역을 한 번에.",
    hint: "내 전적 검색 →",
    href: "/?focus=1",
  },
  {
    tag: "스쿼드 빌더",
    title: "스쿼드 만들고 공유",
    desc: "포메이션에 선수 배치, 리그·팀 프리셋, 최근 경기 선발 그대로 불러오기.",
    hint: "바로가기 →",
    href: "/squad",
  },
  {
    tag: "랭커 픽 랭킹 · 선수 도감",
    title: "지금 랭커는 누굴 쓸까",
    desc: "상위 랭커가 많이 쓴 카드를 포지션별로 매일 갱신. 선수 이름으로 도감도 바로 검색.",
    hint: "픽 랭킹 · 선수 검색 →",
    href: "/meta",
  },
  {
    tag: "커뮤니티 · 배틀",
    title: "자랑하고, 모으고, 겨룬다",
    desc: "스쿼드 자랑과 평가, 클럽원 모집, 투표로 겨루는 스쿼드 배틀.",
    hint: "스쿼드 배틀 보기 →",
    href: "/community?type=squad_battle",
  },
] as const;

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      {/* 히어로 */}
      <section className="relative flex flex-col items-center pb-16 pt-16 text-center sm:pb-24 sm:pt-24">
        {/* 피치 라인 아트 */}
        <svg
          aria-hidden
          viewBox="0 0 400 240"
          className="pointer-events-none absolute inset-x-0 -top-6 mx-auto h-72 w-full max-w-lg opacity-[0.06]"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 30%, transparent 85%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 30%, transparent 85%)",
          }}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
        >
          {/* 센터서클 모티프만 — 사각 테두리는 '깨진 카드'처럼 보여 제거 */}
          <line x1="0" y1="120" x2="400" y2="120" />
          <circle cx="200" cy="120" r="56" />
          <circle cx="200" cy="120" r="3" fill="var(--accent)" stroke="none" />
        </svg>

        <p className="rise scoreboard relative block text-xs font-semibold tracking-[0.3em] text-accent">
          EA SPORTS FC ONLINE DATA LAB
        </p>
        <h1 className="rise rise-1 relative mt-5 text-4xl font-bold leading-tight sm:text-5xl">
          감이 아니라,
          <br className="sm:hidden" /> <span className="text-accent">데이터</span>로.
        </h1>
        {/* 첫 3초 인지: 모바일에서도 '무슨 서비스인지' 즉시 보이도록 (전엔 라벨이 sm 이상에서만 노출) */}
        <p className="rise rise-2 relative mt-4 max-w-md text-sm font-semibold leading-relaxed text-ink sm:text-base">
          FC온라인 전적·스쿼드·랭커 메타를 한 곳에
        </p>

        <div className="rise rise-3 relative mt-8 w-full max-w-md">
          <SearchForm size="lg" />
        </div>

        {/* 데모 구단주 — 검색할 닉네임이 없어도 바로 가치 체험 */}
        {DEMO_NICKNAME && (
          <Link
            href={`/user/${encodeURIComponent(DEMO_NICKNAME)}`}
            className="rise rise-3 relative mt-4 inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
          >
            👀 예시 리포트 먼저 구경하기 →
          </Link>
        )}
      </section>

      {/* 기능 */}
      <section className="pb-24 md:pb-16">
        <h2 className="scoreboard text-xs font-semibold tracking-[0.25em] text-muted">
          여기서 할 수 있는 것
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f, i) => {
            const inner = (
              <>
                <p className="scoreboard text-[13px] font-bold tracking-[0.2em] text-gold">
                  {f.tag}
                </p>
                <h3 className="mt-2 text-base font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {f.desc}
                </p>
                <p
                  className={`mt-3 text-sm font-semibold ${
                    f.href ? "text-accent" : "text-muted"
                  }`}
                >
                  {f.hint}
                </p>
              </>
            );
            const cls = `panel rise rise-${i + 1} block w-full p-5 transition-colors hover:border-accent/50`;
            return f.href === "/?focus=1" ? (
              // 검색으로 시작하는 기능 — 히어로 검색창으로 스크롤+포커스 (죽은 카드 방지)
              <FocusSearchCard key={f.title} className={cls}>
                {inner}
              </FocusSearchCard>
            ) : (
              <Link key={f.title} href={f.href} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
