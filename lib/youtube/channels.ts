/**
 * 홈 영상 스트립에 노출할 유튜브 채널 화이트리스트 (RSS 기반 — API 키·비용 0).
 * channelId는 반드시 `UC`로 시작하는 24자. 채널 교체는 이 배열만 수정하면 됨.
 *
 * ⚠️ 아래 ID는 여러 분석 사이트(NoxInfluencer/Playboard/vling 등)에서 교차 확인했으나,
 *    개발 샌드박스가 youtube.com 접근을 차단(403)해 RSS 피드로 직접 검증하지는 못함.
 *    프로덕션(egress 오픈)에서는 정상 동작하며, ID가 틀린 채널은 자동으로 빈 피드로 처리되어
 *    스트립에서 조용히 빠진다(크래시 없음). 배포 후 각 채널이 뜨는지 한 번 확인 권장.
 *    (채널ID 확인: 채널 페이지의 "channelId":"UC..." 또는
 *     https://www.youtube.com/feeds/videos.xml?channel_id=UC... 가 XML 반환하는지)
 */
export interface YtChannel {
  name: string;
  channelId: string;
}

/** FC온라인 / 피파온라인 게임 유튜버 */
export const FCONLINE_CHANNELS: YtChannel[] = [
  { name: "EA SPORTS FC 온라인", channelId: "UC9otskL_kd-0CDib_5Lj-mQ" }, // 넥슨 공식
  { name: "즐인권", channelId: "UC3ozN5tHi449NhCDE6Xtmwg" },
  { name: "혁나브리", channelId: "UCkg-p8nRSPFPPDjGPrbHsPA" },
  { name: "평범한술범이", channelId: "UCoDK5O35bvp8ssIMZKqOoyA" },
  { name: "바란TV", channelId: "UCag3ovS3tfpIosFbbEt4DXg" },
];

/** 실제 축구(뉴스·하이라이트·해외축구·해설) 채널 */
export const FOOTBALL_CHANNELS: YtChannel[] = [
  { name: "이스타TV", channelId: "UCn9mJ4htO64-1osMWYu9k5Q" },
  { name: "감스트GAMST", channelId: "UCbFzvzDu17eDZ3RIeaLRswQ" },
  { name: "달수네라이브", channelId: "UCRDowcnvz5ZVh-3NVAdfiqg" },
  { name: "KFATV 대한민국 축구 국가대표팀", channelId: "UCpjOmwiy88a9EV3Rv8ukJgw" },
  { name: "SPOTV", channelId: "UCtm_QoN2SIxwCE-59shX7Qg" },
];
