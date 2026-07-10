import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import VerdictStamp from "@/app/components/VerdictStamp";
import { getPositionLabel } from "@/lib/nexon/meta";
import { isNotConfigured } from "@/lib/nexon/client";
import {
  buildComparison,
  getTodaysVs,
  getVoteCounts,
  VS_MATCH_TYPE,
  type VsComparison,
} from "@/lib/vs";
import VsReveal from "./VsReveal";

export const metadata: Metadata = {
  title: "오늘의 VS — 누가 더 셀까",
  description: "랭커 실사용 데이터로 판정하는 선수 비교. 예측 투표하고 안목을 확인하세요.",
};

export default async function VsPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; pos?: string }>;
}) {
  const { a, b, pos } = await searchParams;

  let cmp: VsComparison | null = null;
  let notConfigured = false;

  // 파라미터 검증 — 정수·범위 밖이면 무시하고 오늘의 VS로 폴백
  // (임의 spId로 넥슨 라이브 호출을 유발하는 열거 표면 축소)
  const aId = toSpId(a);
  const bId = toSpId(b);
  const posId = toPos(pos);
  const validParams = aId !== null && bId !== null && posId !== null && aId !== bId;

  try {
    if (validParams) {
      cmp = await buildComparison(aId, bId, posId);
    } else {
      const today = await getTodaysVs(VS_MATCH_TYPE);
      if (today) {
        cmp = await buildComparison(today.aSpId, today.bSpId, today.pos);
      }
    }
  } catch (err) {
    if (isNotConfigured(err)) notConfigured = true;
  }

  if (!cmp || !cmp.available) {
    return <EmptyVs notConfigured={notConfigured} />;
  }

  const counts = await getVoteCounts(cmp.vsKey);
  const A = cmp.a!;
  const B = cmp.b!;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8">
      <p className="scoreboard rise text-center text-xs font-semibold tracking-[0.3em] text-gold">
        오늘의 VS · {getPositionLabel(cmp.pos)}
      </p>

      {/* 슬램 카드 */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <SlamCard
          side="left"
          spId={A.spId}
          name={A.name}
          rating={A.rating}
        />
        <div className="scoreboard text-2xl font-bold text-muted sm:text-3xl">VS</div>
        <SlamCard
          side="right"
          spId={B.spId}
          name={B.name}
          rating={B.rating}
        />
      </div>

      {/* 심판 도장 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex justify-center">
          <VerdictStamp verdict={A.verdict} />
        </div>
        <div className="flex justify-center">
          <VerdictStamp verdict={B.verdict} />
        </div>
      </div>

      {/* 예측 투표 → 정답 공개 */}
      <VsReveal cmp={cmp} initialCounts={counts} />

      <p className="mt-8 text-center text-[11px] text-muted">
        랭커 {getPositionLabel(cmp.pos)} 실사용 평균 기준 · 매일 새로운 대결
      </p>
    </div>
  );
}

// spId: 최대 9자리 양의 정수 (시즌3 + pid6)
function toSpId(v?: string): number | null {
  if (!v || !/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toPos(v?: string): number | null {
  if (!v || !/^\d{1,2}$/.test(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 28 ? n : null;
}

function SlamCard({
  side,
  spId,
  name,
  rating,
}: {
  side: "left" | "right";
  spId: number;
  name: string;
  rating: number;
}) {
  return (
    <div
      className={`panel flex flex-col items-center p-3 ${
        side === "left" ? "slam-left" : "slam-right"
      }`}
    >
      <Image
        src={`/api/player-image/${spId}`}
        alt=""
        width={112}
        height={112}
        unoptimized
        className="h-20 w-20 rounded-xl bg-surface-2 object-cover sm:h-28 sm:w-28"
      />
      <p className="mt-2 line-clamp-1 text-center text-sm font-bold sm:text-base">
        {name}
      </p>
      <p className="scoreboard text-2xl font-bold text-accent">
        {rating.toFixed(1)}
      </p>
    </div>
  );
}

function EmptyVs({ notConfigured }: { notConfigured: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center">
      <p className="scoreboard text-5xl font-bold text-surface-2">VS</p>
      <h1 className="mt-4 text-xl font-bold">오늘의 VS 준비 중</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {notConfigured
          ? "넥슨 API 연동 설정이 완료되면 랭커 데이터로 대결을 공개합니다."
          : "랭커 데이터가 쌓이면 매일 새로운 선수 대결이 자동으로 열립니다. 조금만 기다려주세요."}
      </p>
      <Link
        href="/"
        className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
      >
        홈으로
      </Link>
    </div>
  );
}
