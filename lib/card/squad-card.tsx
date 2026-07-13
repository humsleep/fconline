import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { loadKoreanFont } from "./font";
import { getFormation } from "@/lib/squad/formations";
import type { Squad } from "@/lib/squad/store";
import { topSeason } from "@/lib/squad/card-badges";

// 9:16 세로 카드
const W = 1080;
const H = 1920;

// 피치 영역 (헤더 아래 ~ 푸터 위). 앱의 스쿼드 피치(3:4, 공격이 위)와 동일한 좌표계.
const PITCH_X = 70;
const PITCH_Y = 300;
const PITCH_W = W - PITCH_X * 2; // 940
const PITCH_H = 1360;

function short(name: string, n = 6): string {
  const t = (name ?? "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/**
 * 스쿼드 카드의 엘리먼트 트리 + 폰트 서브셋 텍스트 (폰트 로딩과 분리해 테스트 가능).
 * 범용 텍스트 카드가 아니라 실제 포메이션 피치에 11명을 배치해 그린다(자유 배치 좌표 우선).
 */
export function squadCardTree(
  squad: Squad,
  seasonNames: Map<number, string>,
  fontLoaded: boolean
): { element: ReactElement; fontText: string } {
  const formation = getFormation(squad.formation);
  const bySlot = new Map(squad.slots.map((s) => [s.slotId, s]));
  const top = topSeason(squad, seasonNames);

  const nodes = formation.slots.map((slot) => {
    const p = bySlot.get(slot.id);
    const x = typeof p?.x === "number" ? p.x : slot.x;
    const y = typeof p?.y === "number" ? p.y : slot.y;
    return { pos: slot.pos, name: p?.name ? short(p.name) : "", x, y };
  });

  const fontText =
    "FC SCOPE FC온라인 데이터 랩 스쿼드 명 구성 시즌 " +
    squad.name +
    formation.name +
    nodes.map((n) => n.name + n.pos).join("") +
    (top ? top.season : "") +
    "0123456789×…-· fcscope";

  const element = (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a1119",
          backgroundImage:
            "radial-gradient(900px 500px at 50% 0%, rgba(200,245,66,0.16), transparent)",
          padding: 70,
          fontFamily: fontLoaded ? "NotoKR" : "sans-serif",
          color: "#e9eef6",
        }}
      >
        {/* 헤더 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 40, fontWeight: 700, color: "#c8f542" }}>FC</span>
            <span style={{ fontSize: 40, fontWeight: 700 }}>SCOPE</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: "#8fa0b5", marginLeft: 8 }}>
              스쿼드
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, color: "#c8f542" }}>
              {formation.name}
            </span>
            <span style={{ fontSize: 44, fontWeight: 700, color: "#e9eef6" }}>{squad.name}</span>
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
            border: "2px solid #22334a",
            backgroundImage:
              "linear-gradient(180deg, rgba(200,245,66,0.10) 0%, #0d1620 55%)",
            display: "flex",
          }}
        >
          {/* 중앙선 + 센터서클 */}
          <div style={{ position: "absolute", left: 0, top: PITCH_H / 2, width: PITCH_W, height: 2, backgroundColor: "rgba(233,238,246,0.12)" }} />
          <div style={{ position: "absolute", left: PITCH_W / 2 - 90, top: PITCH_H / 2 - 90, width: 180, height: 180, borderRadius: 90, border: "2px solid rgba(233,238,246,0.12)" }} />
          {/* 페널티 박스 (상단=공격 / 하단=우리) */}
          <div style={{ position: "absolute", left: PITCH_W / 2 - 170, top: 0, width: 340, height: 150, border: "2px solid rgba(233,238,246,0.10)" }} />
          <div style={{ position: "absolute", left: PITCH_W / 2 - 170, top: PITCH_H - 150, width: 340, height: 150, border: "2px solid rgba(233,238,246,0.10)" }} />

          {/* 선수 노드 */}
          {nodes.map((n, i) => {
            const cx = (n.x / 100) * PITCH_W;
            const cy = (n.y / 100) * PITCH_H;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: cx - 78,
                  top: cy - 78,
                  width: 156,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 92,
                    height: 92,
                    borderRadius: 46,
                    backgroundColor: "#101a26",
                    border: "3px solid #c8f542",
                    color: "#c8f542",
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  {n.pos}
                </div>
                {n.name && (
                  <div
                    style={{
                      marginTop: 8,
                      maxWidth: 156,
                      padding: "4px 10px",
                      borderRadius: 8,
                      backgroundColor: "rgba(10,17,25,0.75)",
                      fontSize: 26,
                      fontWeight: 700,
                      color: "#e9eef6",
                    }}
                  >
                    {n.name}
                  </div>
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
            color: "#8fa0b5",
          }}
        >
          <span>
            {squad.slots.length}명 구성
            {top ? `  ·  시즌 ${top.season} ×${top.count}` : ""}
          </span>
          <span style={{ color: "#c8f542", fontWeight: 700 }}>fcscope</span>
        </div>
      </div>
    );

  return { element, fontText };
}

/** 스쿼드 포메이션 피치 공유 카드 (ImageResponse). */
export async function renderSquadCard(
  squad: Squad,
  seasonNames: Map<number, string>
): Promise<ImageResponse> {
  // 폰트 서브셋 텍스트를 먼저 알아야 하므로 트리를 두 번 만든다(순수 함수라 저렴).
  const { fontText } = squadCardTree(squad, seasonNames, false);
  const font = await loadKoreanFont(fontText);
  const { element } = squadCardTree(squad, seasonNames, Boolean(font));

  return new ImageResponse(element, {
    width: W,
    height: H,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
    fonts: font
      ? [{ name: "NotoKR", data: font, weight: 700, style: "normal" }]
      : undefined,
  });
}
