import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { getMaxDivisions, getOuid, getUserBasic, getUserMatches } from "@/lib/nexon/api";
import { getMatchDetailCached } from "@/lib/nexon/cached";
import { getDivisionName } from "@/lib/nexon/meta";
import { aggregate, summarizeMatch, type MatchSummary } from "@/lib/nexon/summary";
import { SITE_HOST } from "@/lib/site";

export const runtime = "nodejs";
export const maxDuration = 60; // 콜드 조회(넥슨 순차 호출) 대비
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FC Scope 전적 카드";

/** 카드에 실제로 쓰이는 글자만 서브셋으로 구글 폰트에서 로드 (satori는 woff2 미지원) */
async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } } // TTF 응답 유도
      )
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname: raw } = await params;
  const nickname = decodeURIComponent(raw);

  let level: number | null = null;
  let division = "";
  let rec: ReturnType<typeof aggregate> | null = null;
  let form: MatchSummary[] = [];

  // 넥슨 팬아웃 유발 — 공유 크롤러(카톡 등) 정상 트래픽은 넉넉히 허용(분당 60).
  // 한도 초과 시 넥슨 조회만 건너뛰고 닉네임만 담긴 기본 카드를 렌더(썸네일 깨짐 방지).
  const overLimit = !rateLimit(`og:${clientIp(await headers())}`, 60, 60_000).ok;

  try {
    if (overLimit) throw new Error("og rate limited");
    const ouid = await getOuid(nickname);
    const basic = await getUserBasic(ouid);
    level = basic.level;

    const divisions = await getMaxDivisions(ouid).catch(() => []);
    const official = divisions.find((d) => d.matchType === 50) ?? divisions[0];
    if (official) division = await getDivisionName(official.division);

    const ids = await getUserMatches(ouid, 50, 10).catch(() => [] as string[]);
    const summaries: MatchSummary[] = [];
    for (const id of ids) {
      try {
        const s = summarizeMatch(await getMatchDetailCached(id), ouid);
        if (s) summaries.push(s);
      } catch {
        // skip
      }
    }
    if (summaries.length > 0) {
      rec = aggregate(summaries);
      form = summaries.slice(0, 5);
    }
  } catch {
    // 데이터 실패 시 닉네임만으로 폴백 카드
  }

  const textUsed = `${nickname}${division}FC SCOPE 전적 카드 최근 경기 승률 무패 LV.0123456789%승 무 패`;
  const font = await loadKoreanFont(textUsed);

  const resultColor = (r: string) =>
    r === "승" ? "#4ade80" : r === "패" ? "#fb7185" : "#94a3b8";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a1119",
          backgroundImage:
            "radial-gradient(800px 400px at 50% -100px, rgba(200,245,66,0.15), transparent)",
          padding: 64,
          color: "#e9eef6",
          fontFamily: font ? "NotoKR" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#c8f542" }}>FC</span>
          <span style={{ fontSize: 32, fontWeight: 700 }}>SCOPE</span>
          <span style={{ fontSize: 22, color: "#8fa0b5", marginLeft: 8 }}>전적 카드</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1 }}>{nickname}</span>
            {level !== null && (
              <span style={{ fontSize: 30, color: "#8fa0b5", paddingBottom: 8 }}>
                LV.{level}
              </span>
            )}
          </div>
          {division && (
            <span style={{ fontSize: 30, color: "#f2c14e", fontWeight: 700 }}>{division}</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {rec ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, color: "#8fa0b5" }}>최근 {rec.played}경기 승률</span>
                <span style={{ fontSize: 88, fontWeight: 700, color: "#c8f542", lineHeight: 1 }}>
                  {rec.winRate}%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", paddingBottom: 6 }}>
                <span style={{ fontSize: 26, color: "#8fa0b5" }}>
                  {rec.win}승 {rec.draw}무 {rec.lose}패
                </span>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {form.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        fontWeight: 700,
                        color: resultColor(m.result),
                        backgroundColor: "rgba(233,238,246,0.08)",
                      }}
                    >
                      {m.result}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 28, color: "#8fa0b5" }}>FC온라인 전적 · 슛맵 리포트</span>
          )}
          <span style={{ fontSize: 22, color: "#8fa0b5" }}>{SITE_HOST}</span>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // 카톡/디스코드 크롤러 반복 조회 → 엣지 캐시로 흡수 (넥슨 호출 증폭 방지)
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
      fonts: font
        ? [{ name: "NotoKR", data: font, weight: 700 as const, style: "normal" as const }]
        : undefined,
    }
  );
}
