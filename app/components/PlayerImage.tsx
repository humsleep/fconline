"use client";

import { useCallback, useState } from "react";
import { playerImageCandidates } from "@/lib/nexon/player-image";

type Props = {
  spid: number | string;
  /** 정사각형 한 변(px). 레이아웃 점프를 막으려고 width/height 로도 내려간다. */
  size: number;
  className?: string;
  alt?: string;
  draggable?: boolean;
  /** 첫 화면에 바로 보이는 큰 이미지에만 (lazy 대신 eager) */
  priority?: boolean;
};

/**
 * 선수 이미지 — 넥슨 CDN 직접 로드 + 실패 시 폴백(액션샷 → 기본 → 서버 프록시).
 *
 * `next/image` 를 쓰지 않는다: 원래도 전부 `unoptimized` 였고(최적화 이득 없음),
 * 외부 도메인을 쓰려면 remotePatterns 설정이 필요한 데다 폴백 체인을 붙일 수 없다.
 * 왜 프록시를 벗어났는지는 `lib/nexon/player-image.ts` 주석 참고.
 */
export default function PlayerImage({
  spid,
  size,
  className,
  alt = "",
  draggable,
  priority,
}: Props) {
  const srcs = playerImageCandidates(spid);
  // spid 가 바뀌면(목록 재사용) 폴백 단계를 처음으로 되돌린다.
  const [state, setState] = useState({ id: String(spid), step: 0 });
  const step = state.id === String(spid) ? state.step : 0;

  const next = useCallback(
    (id: string, from: number, total: number) =>
      setState({ id, step: Math.min(from + 1, total - 1) }),
    []
  );

  // SSR 로 내려온 <img> 는 하이드레이션 전에 이미 로드를 끝낸다 → 그때 난 error 는
  // onError 로 잡히지 않는다(실측: 액션샷 없는 선수가 빈칸으로 남았다).
  // ref 가 붙는 시점에 "로드가 끝났는데 크기가 0" 이면 실패로 보고 다음 후보로 넘긴다.
  const check = useCallback(
    (el: HTMLImageElement | null) => {
      if (el && el.complete && el.naturalWidth === 0 && step < srcs.length - 1) {
        next(String(spid), step, srcs.length);
      }
    },
    [spid, step, srcs.length, next]
  );

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={check}
      src={srcs[step]}
      alt={alt}
      width={size}
      height={size}
      draggable={draggable}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => next(String(spid), step, srcs.length)}
      className={className}
    />
  );
}
