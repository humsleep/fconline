import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { loadKoreanFont } from "./font";
import { getFormation } from "@/lib/squad/formations";
import { squadFormationTitle } from "@/lib/squad/title";
import type { Squad } from "@/lib/squad/store";
import { topSeason } from "@/lib/squad/card-badges";
import { QrTile } from "./render";
import { APPSTORE_CAPTION } from "./appstore-qr";
import { CARD, CARD_GLOW, Wordmark } from "./brand";

// 9:16 세로 카드
const W = 1080;
const H = 1920;

// 피치 영역 (앱의 스쿼드 피치(3:4, 공격이 위)와 동일한 좌표계).
const PITCH_X = 70;
const PITCH_Y = 300;
const PITCH_W = W - PITCH_X * 2; // 940
const PITCH_H = 1360;

const NEXON_CDN = "https://fco.dn.nexoncdn.co.kr/live/externalAssets/common";
const SEASON_META = "https://open.api.nexon.com/static/fconline/meta/seasonid.json";

interface CardNode {
  pos: string;
  name: string;
  x: number;
  y: number;
  photo?: string | null; // data URI (선수 사진)
  season?: string | null; // data URI (시즌 엠블럼)
}

function short(name: string, n = 6): string {
  const t = (name ?? "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function seasonIdOf(spid: number): number {
  return Math.floor(spid / 1_000_000);
}

/** 원격 이미지를 data URI로. 실패/비이미지/빈 응답은 null → 노드가 라벨 폴백으로 렌더. */
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "image/png";
    if (!ct.startsWith("image/")) return null; // 실루엣 SVG 등은 제외
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** 선수 사진: 액션샷(spid) → 기본(pid) 순으로 시도. */
async function playerPhoto(spid: number): Promise<string | null> {
  const pid = spid % 1_000_000;
  return (
    (await toDataUri(`${NEXON_CDN}/playersAction/p${spid}.png`)) ??
    (await toDataUri(`${NEXON_CDN}/players/p${pid}.png`))
  );
}

/** seasonid.json에서 seasonId → seasonImg URL (넥슨 도메인만 허용). */
async function seasonImgUrls(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const res = await fetch(SEASON_META, { next: { revalidate: 86400 } });
    if (!res.ok) return map;
    const list = (await res.json()) as { seasonId: number; seasonImg?: string }[];
    for (const s of list) {
      const img = s.seasonImg?.trim();
      if (!img) continue;
      try {
        const u = new URL(img);
        if (
          u.protocol === "https:" &&
          (u.hostname.endsWith(".nexon.com") || u.hostname.endsWith(".nexoncdn.co.kr"))
        )
          map.set(s.seasonId, img);
      } catch {
        // 무시
      }
    }
  } catch {
    // 빈 맵
  }
  return map;
}

function baseNodes(squad: Squad): CardNode[] {
  const formation = getFormation(squad.formation);
  const bySlot = new Map(squad.slots.map((s) => [s.slotId, s]));
  return formation.slots.map((slot) => {
    const p = bySlot.get(slot.id);
    return {
      pos: slot.pos,
      name: p?.name ? short(p.name) : "",
      x: typeof p?.x === "number" ? p.x : slot.x,
      y: typeof p?.y === "number" ? p.y : slot.y,
    };
  });
}

/**
 * 카드 엘리먼트 트리 + 폰트 서브셋 텍스트 (폰트/이미지 로딩과 분리해 테스트 가능).
 * node.photo/season 이 있으면 이미지로, 없으면 포지션 라벨로 렌더(graceful).
 */
export function buildSquadCardElement(opts: {
  formationName: string;
  squadName: string;
  nodes: CardNode[];
  top: { season: string; count: number } | null;
  playerCount: number;
  fontLoaded: boolean;
}): { element: ReactElement; fontText: string } {
  const { formationName, squadName, nodes, top, playerCount, fontLoaded } = opts;

  const fontText =
    "FC SCOPE FC온라인 데이터 랩 스쿼드 명 구성 시즌 " +
    squadName +
    formationName +
    nodes.map((n) => n.name + n.pos).join("") +
    (top ? top.season : "") +
    "0123456789×…-· " + APPSTORE_CAPTION;

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: CARD.bg,
        backgroundImage: CARD_GLOW,
        padding: 70,
        fontFamily: fontLoaded ? "NotoKR" : "sans-serif",
        color: CARD.ink,
      }}
    >
      {/* 헤더 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Wordmark size={40} />
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: CARD.muted, marginLeft: 8 }}>
            스쿼드
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, color: CARD.tint }}>{formationName}</span>
          <span style={{ fontSize: 44, fontWeight: 700, color: CARD.ink }}>{squadName}</span>
        </div>
      </div>

      {/* 피치 */}
      <div
        style={{
          position: "absolute",
          left: PITCH_X,
          top: PITCH_Y,
          width: PITCH_W,
          height: PITCH_H,
          borderRadius: 32,
          border: `2px solid ${CARD.line}`,
          backgroundImage: "linear-gradient(180deg, #123322 0%, #0d2419 100%)",
          display: "flex",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: PITCH_H / 2, width: PITCH_W, height: 2, backgroundColor: "rgba(255,255,255,0.14)" }} />
        <div style={{ position: "absolute", left: PITCH_W / 2 - 90, top: PITCH_H / 2 - 90, width: 180, height: 180, borderRadius: 90, border: "2px solid rgba(255,255,255,0.14)" }} />
        <div style={{ position: "absolute", left: PITCH_W / 2 - 170, top: 0, width: 340, height: 150, border: "2px solid rgba(255,255,255,0.12)" }} />
        <div style={{ position: "absolute", left: PITCH_W / 2 - 170, top: PITCH_H - 150, width: 340, height: 150, border: "2px solid rgba(255,255,255,0.12)" }} />

        {nodes.map((n, i) => {
          const cx = (n.x / 100) * PITCH_W;
          const cy = (n.y / 100) * PITCH_H;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx - 100,
                top: cy - 88,
                width: 200,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {n.photo ? (
                <img
                  src={n.photo}
                  width={96}
                  height={96}
                  style={{ width: 96, height: 96, borderRadius: 48, objectFit: "cover", border: `3px solid ${CARD.tint}`, backgroundColor: CARD.surface }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 92,
                    height: 92,
                    borderRadius: 46,
                    backgroundColor: CARD.surface,
                    border: `3px solid ${CARD.tint}`,
                    color: CARD.tint,
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  {n.pos}
                </div>
              )}
              {n.name && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginTop: 8,
                    padding: "4px 10px",
                    borderRadius: 8,
                    backgroundColor: "rgba(11,10,31,0.78)",
                    fontSize: 24,
                    fontWeight: 700,
                    color: CARD.ink,
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.name}
                </div>
              )}
              {n.season && (
                <img src={n.season} height={30} style={{ height: 30, marginTop: 6 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* 푸터 */}
      <div
        style={{
          position: "absolute",
          left: 70,
          top: PITCH_Y + PITCH_H + 28,
          width: PITCH_W,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 30,
          color: CARD.muted,
        }}
      >
        <span>
          {playerCount}명 구성{top ? `  ·  시즌 ${top.season} ×${top.count}` : ""}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 24 }}>{APPSTORE_CAPTION}</span>
          <QrTile />
        </div>
      </div>
    </div>
  );

  return { element, fontText };
}

/** 이미지 없는 동기 트리 빌더 (단위 테스트용 — 포지션 라벨 폴백 렌더). */
export function squadCardTree(
  squad: Squad,
  _seasonNames: Map<number, string>,
  fontLoaded: boolean
): { element: ReactElement; fontText: string } {
  return buildSquadCardElement({
    formationName: squadFormationTitle(squad),
    squadName: squad.name,
    nodes: baseNodes(squad),
    top: topSeason(squad, _seasonNames),
    playerCount: squad.slots.length,
    fontLoaded,
  });
}

/** 스쿼드 포메이션 피치 공유 카드 — 선수 사진 + 시즌 엠블럼 임베드(실패 시 라벨 폴백). */
export async function renderSquadCard(
  squad: Squad,
  seasonNames: Map<number, string>
): Promise<ImageResponse> {
  const nodes = baseNodes(squad);
  const slots = getFormation(squad.formation).slots;
  const bySlot = new Map(squad.slots.map((s) => [s.slotId, s]));

  // 선수 사진 + 시즌 엠블럼을 서버에서 받아 data URI로 (병렬). 실패는 null → 폴백.
  const seasonUrls = await seasonImgUrls();
  await Promise.all(
    nodes.map(async (node, i) => {
      const p = bySlot.get(slots[i].id);
      if (!p) return;
      const [photo, season] = await Promise.all([
        playerPhoto(p.spid),
        (async () => {
          const url = seasonUrls.get(seasonIdOf(p.spid));
          return url ? toDataUri(url) : null;
        })(),
      ]);
      node.photo = photo;
      node.season = season;
    })
  );

  const top = topSeason(squad, seasonNames);
  const built = buildSquadCardElement({
    formationName: squadFormationTitle(squad),
    squadName: squad.name,
    nodes,
    top,
    playerCount: squad.slots.length,
    fontLoaded: false,
  });
  const font = await loadKoreanFont(built.fontText);
  const { element } = buildSquadCardElement({
    formationName: squadFormationTitle(squad),
    squadName: squad.name,
    nodes,
    top,
    playerCount: squad.slots.length,
    fontLoaded: Boolean(font),
  });

  return new ImageResponse(element, {
    width: W,
    height: H,
    headers: {
      // 스쿼드는 저장 후 거의 안 바뀜 → 1일 엣지 캐시로 무거운 22-이미지 래스터 재실행 억제
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
    fonts: font ? [{ name: "NotoKR", data: font, weight: 700, style: "normal" }] : undefined,
  });
}
