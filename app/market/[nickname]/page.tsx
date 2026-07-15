import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getOuid } from "@/lib/nexon/api";
import { isUserNotFound } from "@/lib/nexon/client";
import { limitNexonFanout } from "@/lib/security/rate-limit";
import TradeSection from "./TradeSection";

export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}): Promise<Metadata> {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  return {
    title: `${decoded} 이적시장`,
    description: `${decoded}의 FC온라인 이적시장 거래 내역 — 영입 지출과 방출 수입`,
  };
}

/** 이적시장 거래 내역 — 매치 종류와 무관한 구단 단위 데이터라 전적과 분리된 독립 페이지. */
export default async function MarketPage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname: raw } = await params;
  const nickname = decodeURIComponent(raw);

  // 넥슨 팬아웃(거래 buy/sell) SSR — IP rate limit 선차단
  const rl = limitNexonFanout(await headers(), "market-page");
  if (!rl.ok) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
        <h1 className="text-xl font-bold">지금 조회 요청이 많아요</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          1~2분 후에 다시 시도해 주세요.
        </p>
        <Link href="/" className="mt-6 text-sm text-muted underline underline-offset-2">
          홈으로
        </Link>
      </div>
    );
  }

  let ouid: string;
  try {
    ouid = await getOuid(nickname);
  } catch (err) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center">
        <h1 className="text-xl font-bold">
          {isUserNotFound(err)
            ? `‘${nickname}’ 구단주를 찾을 수 없어요`
            : "일시적으로 조회할 수 없어요"}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {isUserNotFound(err)
            ? "닉네임 철자를 확인해 주세요."
            : "잠시 후 다시 시도해 주세요."}
        </p>
        <Link
          href="/"
          className="mt-6 text-sm text-muted underline underline-offset-2"
        >
          홈에서 다시 검색
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pb-16">
      <p className="scoreboard text-[13px] font-bold tracking-[0.25em] text-accent">
        TRANSFER MARKET
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{nickname}의 이적시장</h1>
        <Link
          href={`/user/${encodeURIComponent(nickname)}`}
          className="scoreboard text-sm font-semibold text-muted transition-colors hover:text-accent"
        >
          전적·분석 →
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        넥슨 공식 거래 기록 기준 — 최근 영입 지출과 방출 수입
      </p>

      <Suspense key={ouid} fallback={<MarketSkeleton />}>
        <TradeSection ouid={ouid} />
      </Suspense>
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-label="거래 내역 불러오는 중">
      <div className="skeleton h-20" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
      <p className="pt-2 text-center text-xs text-muted">
        넥슨 서버에서 거래 내역을 불러오는 중…
      </p>
    </div>
  );
}
