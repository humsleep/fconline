import { ImageResponse } from "next/og";
import { loadKoreanFont } from "./font";
import type { VerdictColor } from "@/lib/verdict";

// 9:16 세로 카드 (모바일 커뮤니티 업로드 최적 비율)
const W = 1080;
const H = 1920;

const HEX: Record<VerdictColor, string> = {
  gold: "#f2c14e",
  lime: "#c8f542",
  ink: "#e9eef6",
  muted: "#8fa0b5",
  lose: "#fb7185",
};

export interface CardBadge {
  label: string;
  value: string;
  color?: VerdictColor;
}

export interface CardData {
  kicker: string; // 상단 라벨 (예: "매치 리포트")
  title: string; // 대형 헤드라인 (예: "3 : 1")
  subtitle?: string; // 보조 (예: "승리 · 완벽한 경기력")
  stamp?: { text: string; icon: string; color: VerdictColor };
  badges?: CardBadge[]; // 최대 3
  footerUrl: string;
}

// 전광판 타이포그래피 카드 — 사진 임베드 없이 색+숫자로 승부(안정·고속).
export async function renderCard(data: CardData): Promise<ImageResponse> {
  const badges = (data.badges ?? []).slice(0, 3);
  const stampHex = data.stamp ? HEX[data.stamp.color] : HEX.lime;

  const fontText =
    "FC SCOPE FC온라인 데이터 랩 " +
    data.kicker +
    data.title +
    (data.subtitle ?? "") +
    (data.stamp?.text ?? "") +
    badges.map((b) => b.label + b.value).join("") +
    data.footerUrl +
    "0123456789:.%승무패-";

  const font = await loadKoreanFont(fontText);

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
            "radial-gradient(900px 500px at 50% 0%, rgba(200,245,66,0.16), transparent)",
          padding: 96,
          fontFamily: font ? "NotoKR" : "sans-serif",
          color: "#e9eef6",
        }}
      >
        {/* 상단 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: "#c8f542" }}>
              FC
            </span>
            <span style={{ fontSize: 44, fontWeight: 700 }}>SCOPE</span>
          </div>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 6,
              color: "#8fa0b5",
            }}
          >
            {data.kicker}
          </span>
        </div>

        {/* 중앙 히어로 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 200, fontWeight: 700, lineHeight: 1 }}>
            {data.title}
          </span>
          {data.subtitle && (
            <span style={{ fontSize: 48, fontWeight: 700, color: "#8fa0b5" }}>
              {data.subtitle}
            </span>
          )}
          {data.stamp && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 8,
                padding: "20px 40px",
                borderRadius: 20,
                alignSelf: "flex-start",
                backgroundColor: "rgba(255,255,255,0.06)",
                border: `3px solid ${stampHex}`,
                color: stampHex,
              }}
            >
              {/* 아이콘 글리프는 서브셋 폰트에 없어 생략 — 테두리 색 + 텍스트로 인코딩 */}
              <span style={{ fontSize: 52, fontWeight: 700 }}>
                {data.stamp.text}
              </span>
            </div>
          )}
        </div>

        {/* 배지 + 푸터 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {badges.length > 0 && (
            <div style={{ display: "flex", gap: 20 }}>
              {badges.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: 8,
                    padding: "24px 28px",
                    borderRadius: 20,
                    backgroundColor: "#101a26",
                    border: "1px solid #22334a",
                  }}
                >
                  <span style={{ fontSize: 28, color: "#8fa0b5" }}>
                    {b.label}
                  </span>
                  <span
                    style={{
                      fontSize: 56,
                      fontWeight: 700,
                      color: b.color ? HEX[b.color] : "#e9eef6",
                    }}
                  >
                    {b.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 30,
              color: "#8fa0b5",
            }}
          >
            <span>FC온라인 데이터 랩</span>
            <span style={{ color: "#c8f542", fontWeight: 700 }}>
              {data.footerUrl}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: font
        ? [{ name: "NotoKR", data: font, weight: 700, style: "normal" }]
        : undefined,
    }
  );
}
