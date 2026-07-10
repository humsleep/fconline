import type { Metadata } from "next";
import { MATCH_TABS } from "@/lib/nexon/meta";
import LiveSession from "./LiveSession";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}): Promise<Metadata> {
  const { nickname } = await params;
  let decoded = nickname;
  try {
    decoded = decodeURIComponent(nickname);
  } catch {
    // 원문 사용
  }
  return {
    title: `${decoded} 라이브 세션`,
    description: `${decoded}의 실시간 세션 분석 — 경기가 끝날 때마다 자동으로 갱신됩니다.`,
  };
}

export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ nickname }, { type }] = await Promise.all([params, searchParams]);
  const matchType =
    MATCH_TABS.find((t) => t.type === Number(type))?.type ?? MATCH_TABS[0].type;

  let decoded = nickname;
  try {
    decoded = decodeURIComponent(nickname);
  } catch {
    // 잘못된 % 시퀀스면 원문 그대로 사용 (라이브 API가 not_found로 처리)
  }

  return <LiveSession nickname={decoded} matchType={matchType} />;
}
