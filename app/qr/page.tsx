"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SITE_URL } from "@/lib/site";

/**
 * 홍보용 QR 생성기 (운영자 도구). 포스터·오프라인·인스타 게시물(링크 스티커가 안 되는 피드)용.
 * URL에 utm을 붙여 유입 소스를 추적할 수 있게 프리셋 제공. 전부 클라이언트에서 생성.
 */
const PRESETS = [
  { label: "인스타 프로필", utm: "utm_source=instagram&utm_medium=bio" },
  { label: "인스타 스토리", utm: "utm_source=instagram&utm_medium=story" },
  { label: "인스타 게시물", utm: "utm_source=instagram&utm_medium=post" },
  { label: "오프라인/포스터", utm: "utm_source=offline&utm_medium=qr" },
] as const;

export default function QrPage() {
  const [preset, setPreset] = useState(0);
  const [dataUrl, setDataUrl] = useState<string>("");

  const target = useMemo(
    () => `${SITE_URL}/?${PRESETS[preset].utm}&utm_campaign=launch`,
    [preset]
  );

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(target, {
      width: 720,
      margin: 2,
      color: { dark: "#0a1119", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((u) => {
        if (alive) setDataUrl(u);
      })
      .catch(() => {
        if (alive) setDataUrl("");
      });
    return () => {
      alive = false;
    };
  }, [target]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `fcscope-qr-${PRESETS[preset].label}.png`;
    a.click();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-8 md:pb-16">
      <p className="scoreboard text-[13px] font-bold tracking-[0.25em] text-accent">
        PROMO QR
      </p>
      <h1 className="mt-1 text-2xl font-bold">홍보용 QR</h1>
      <p className="mt-2 text-sm text-muted">
        스캔하면 FC Scope 홈으로 이동해요. 유입 경로별로 QR을 만들어 포스터·오프라인·
        인스타 게시물에 쓰면, GA4에서 어디서 들어왔는지 볼 수 있어요.
      </p>

      {/* 유입 소스 프리셋 */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPreset(i)}
            className={`scoreboard min-h-11 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              i === preset
                ? "bg-accent text-accent-ink"
                : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="panel mt-4 flex flex-col items-center p-5">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="FC Scope QR"
            width={240}
            height={240}
            className="h-60 w-60 rounded-lg bg-white"
          />
        ) : (
          <div className="skeleton h-60 w-60 rounded-lg" />
        )}
        <p className="mt-3 break-all text-center text-[12px] text-muted">{target}</p>
        <button
          onClick={download}
          disabled={!dataUrl}
          className="scoreboard mt-4 min-h-11 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          ⬇ QR 이미지 저장
        </button>
      </div>
    </div>
  );
}
