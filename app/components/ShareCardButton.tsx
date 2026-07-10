"use client";

import { useState } from "react";

/**
 * 결과를 9:16 PNG 카드로 저장/공유 (회의 핵심 CTA "이미지 저장 원탭").
 * 모바일: Web Share로 카톡·디시 등에 파일 공유. 미지원 시 다운로드.
 */
export default function ShareCardButton({
  url,
  filename = "fcscope-card.png",
  label = "카드 저장 · 공유",
}: {
  url: string;
  filename?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("card fetch failed");
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (d?: { files?: File[] }) => boolean;
      };
      if (nav.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "FC Scope" });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
      }
    } catch {
      // 최후 폴백: 새 탭으로 열어 길게 눌러 저장
      window.open(url, "_blank");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="scoreboard inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-line disabled:opacity-50"
    >
      <span aria-hidden>⬇</span>
      {busy ? "만드는 중…" : label}
    </button>
  );
}
