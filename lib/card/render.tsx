import { ImageResponse } from "next/og";
import { loadKoreanFont } from "./font";
import type { VerdictColor } from "@/lib/verdict";
import { APPSTORE_QR_DATA_URI, APPSTORE_QR_SIZE, APPSTORE_CAPTION } from "./appstore-qr";
import { CARD, CARD_GLOW, VERDICT_HEX, Wordmark } from "./brand";

// 9:16 세로 카드 (모바일 커뮤니티 업로드 최적 비율)
const W = 1080;
const H = 1920;

/** 카드 색 — 판정색(VerdictColor) + 중립 강조 tint(바이올렛, iOS CardStamp 기본값). */
export type CardColor = VerdictColor | "tint";
const HEX: Record<CardColor, string> = { ...VERDICT_HEX, tint: CARD.tint };

export interface CardBadge {
  label: string;
  value: string;
  color?: CardColor;
}

export interface CardData {
  kicker: string; // 상단 라벨 (예: "매치 리포트")
  title: string; // 대형 헤드라인 (예: "3 : 1")
  subtitle?: string; // 보조 (예: "승리 · 완벽한 경기력")
  stamp?: { text: string; icon: string; color: CardColor };
  badges?: CardBadge[]; // 최대 3
  footerUrl: string;
}

// 카드 이미지 캐시 기본값 — 하루(엣지). 콘텐츠가 하루보다 자주 안 바뀌므로
// satori+resvg 재래스터를 24×↓. 불변 콘텐츠(끝난 매치)는 호출부에서 immutable 전달.
const DEFAULT_CARD_CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800';

// 전광판 타이포그래피 카드 — 사진 임베드 없이 색+숫자로 승부(안정·고속).
export async function renderCard(
  data: CardData,
  opts?: { cacheControl?: string }
): Promise<ImageResponse> {
  const badges = (data.badges ?? []).slice(0, 3);
  const stampHex = data.stamp ? HEX[data.stamp.color] : CARD.tint;

  const fontText =
    "FC SCOPE FC온라인 데이터 랩 내 전적도 검색 " +
    APPSTORE_CAPTION +
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
          backgroundColor: CARD.bg,
          backgroundImage: CARD_GLOW,
          padding: 96,
          fontFamily: font ? "NotoKR" : "sans-serif",
          color: CARD.ink,
        }}
      >
        {/* 상단 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Wordmark size={44} />
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 6,
              color: CARD.muted,
            }}
          >
            {data.kicker}
          </span>
        </div>

        {/* 중앙 히어로 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: titleFontSize(data.title), fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>
            {data.title}
          </span>
          {data.subtitle && (
            <span style={{ fontSize: 48, fontWeight: 700, color: CARD.muted }}>
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
                    backgroundColor: CARD.surface,
                    border: `1px solid ${CARD.line}`,
                  }}
                >
                  <span style={{ fontSize: 28, color: CARD.muted }}>
                    {b.label}
                  </span>
                  <span
                    style={{
                      // 긴 값(날짜 등)은 배지 폭을 넘쳤다 — iOS minimumScaleFactor 처럼 글자 수로 줄인다
                      fontSize: badgeFontSize(b.value),
                      fontWeight: 700,
                      color: b.color ? HEX[b.color] : CARD.ink,
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
              color: CARD.muted,
            }}
          >
            {/* 리포스트된 카드가 곧 광고 — 도메인 대신 App Store QR(카메라로 바로 설치, iOS 카드와 같은 문법) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span>내 전적도 검색 →</span>
              <span style={{ fontSize: 26 }}>{APPSTORE_CAPTION}</span>
            </div>
            <QrTile />
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        // 공유 직후 반복 조회(크롤러·재공유)를 엣지 캐시로 흡수(기본 1일)
        "Cache-Control": opts?.cacheControl ?? DEFAULT_CARD_CACHE,
      },
      fonts: font
        ? [{ name: "NotoKR", data: font, weight: 700, style: "normal" }]
        : undefined,
    }
  );
}

/**
 * 히어로 제목 크기 — 200px 기준으로 한 줄(본문 폭 888px)에 들어가게 줄인다(iOS minimumScaleFactor 0.35 대응).
 * "반등 준비 중" 같은 긴 라벨이 두 줄로 꺾이던 것을 막는다. 폭은 글자 종류로 어림(한글 1em · 그 외 0.6em · 공백 0.3em).
 */
function titleFontSize(title: string): number {
  let em = 0;
  for (const ch of title) em += /[\u3131-\uD7A3]/.test(ch) ? 1 : ch === " " ? 0.3 : 0.6;
  return Math.max(70, Math.min(200, Math.floor(880 / Math.max(em, 1))));
}

/** 배지 값 글자 크기 — 3칸 배지 내부 폭(~230px)에 맞춘다. */
function badgeFontSize(value: string): number {
  const n = [...value].length;
  return n <= 6 ? 56 : n <= 8 ? 44 : 36;
}

/** 흰 둥근 타일 + 검정 모듈 QR(원본 크기 그대로) — 공유 카드 공용 */
export function QrTile() {
  const pad = 8;
  return (
    <div
      style={{
        display: "flex",
        width: APPSTORE_QR_SIZE + pad * 2,
        height: APPSTORE_QR_SIZE + pad * 2,
        background: "#ffffff",
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={APPSTORE_QR_DATA_URI} width={APPSTORE_QR_SIZE} height={APPSTORE_QR_SIZE} alt="" />
    </div>
  );
}
