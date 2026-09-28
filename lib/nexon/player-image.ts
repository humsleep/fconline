/**
 * 선수 이미지 주소 — 브라우저가 넥슨 CDN 을 직접 부른다.
 *
 * 2026-09-28 이전에는 전부 `/api/player-image/:spid` 서버 프록시를 거쳤다.
 * 그 결과 전적 화면 1회(선수 18~28장)마다 0.9~1.3MB 가 우리 서버를 통과했고,
 * Vercel Hobby 한도를 넘겨(Origin Transfer 19.5GB/10GB, 함수 1M/1M) 계정이 멈췄다.
 *
 * 프록시의 명분은 CORS 였지만, **`<img>` 태그는 CORS 를 필요로 하지 않는다**(fetch·canvas 만 해당).
 * 실측(2026-09-28): 넥슨 CDN 은 핫링크 차단 없이 200 을 준다 —
 *   playersAction/p100000041.png → 200 (24KB) · players/p41.png → 200 (19KB)
 * 네이티브 앱은 이미 같은 방식으로 CDN 을 직접 부르고 있었다(iOS `NexonCDN.swift`).
 *
 * 마지막 후보로 기존 프록시를 남겨 둔다. 넥슨이 나중에 핫링크를 막으면
 * 이미지가 깨지는 대신 조용히 프록시로 되돌아간다(프록시는 실루엣 SVG 로 끝난다).
 */
export const NEXON_CDN = 'https://fco.dn.nexoncdn.co.kr/live/externalAssets/common';

/** spid → 시도 순서대로의 이미지 주소. 앞에서부터 성공한 것을 쓴다. */
export function playerImageCandidates(spid: number | string): string[] {
  const id = String(spid);
  const pid = Number(spid) % 1_000_000;
  return [
    `${NEXON_CDN}/playersAction/p${id}.png`,
    `${NEXON_CDN}/players/p${pid}.png`,
    `/api/player-image/${id}`,
  ];
}
