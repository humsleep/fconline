"use client";

import { useState } from "react";

/**
 * 등급 아이콘 — 넥슨 CDN 이미지를 시도하고, 로드 실패 시 아무것도 렌더하지 않는다
 * (텍스트 등급명은 항상 별도로 표시되므로 이미지가 없어도 정보 손실 없음).
 */
export default function DivisionIcon({
  src,
  size = 20,
}: {
  src: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="inline-block flex-none object-contain"
      style={{ width: size, height: size }}
    />
  );
}
