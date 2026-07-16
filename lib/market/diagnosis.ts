import type { TradeRecord } from "../nexon/types";

/**
 * 이적시장 룰베이스 진단.
 * 최근 거래(영입/방출 각 최대 40건)에서 지표를 뽑아,
 * 사전 셋팅된 결과 100+개(MARKET_RULES) 중 해당되는 것을 보여준다.
 * - kind "type": 구단주 유형 — 우선순위(배열 순서)대로 첫 매칭 1개
 * - kind "note": 세부 코멘트 — 매칭 순서대로 최대 4개
 */

// 요즘 FC온라인 시세 반영 — 상위 카드 단건이 수십~수백조라 총액은 경 단위까지 감.
const EOK = 1e8; // 억
const JO = 1e12; // 조
const GYEONG = 1e16; // 경 (= 10,000조)
const DAY_MS = 86_400_000;

export interface MarketStats {
  buyCount: number;
  sellCount: number;
  totalBuy: number;
  totalSell: number;
  net: number;
  avgBuy: number;
  avgSell: number;
  maxBuy: number;
  maxSell: number;
  /** 영입 평균 강화 등급 */
  gradeAvgBuy: number;
  /** 8강 이상 영입 수 */
  highGradeBuys: number;
  /** 마지막 거래 후 경과일 (거래 없으면 null) */
  daysSinceLast: number | null;
  /** 거래가 발생한 서로 다른 날짜 수 */
  activeDays: number;
  /** 첫 거래~마지막 거래 기간(일) */
  spanDays: number;
  /** 같은 실선수(pid)를 2번 이상 영입한 선수 수 */
  repeatBuys: number;
  /** 최저가 영입/방출 (없으면 0) */
  minBuy: number;
  minSell: number;
  /** 영입 카드 중 최고 강화 등급 */
  maxGradeBuy: number;
  /** 심야(KST 0~6시) 거래 수 */
  nightTrades: number;
  /** 주말(KST 토·일) 거래 수 */
  weekendTrades: number;
}

function toTime(raw: string): number {
  const iso = raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`;
  return new Date(iso).getTime();
}

export function computeMarketStats(
  buy: TradeRecord[],
  sell: TradeRecord[],
  now: number = Date.now()
): MarketStats {
  const buyVals = buy.map((t) => t.value || 0);
  const sellVals = sell.map((t) => t.value || 0);
  const totalBuy = buyVals.reduce((a, b) => a + b, 0);
  const totalSell = sellVals.reduce((a, b) => a + b, 0);

  const times = [...buy, ...sell].map((t) => toTime(t.tradeDate)).filter((t) => !Number.isNaN(t));
  const dayKeys = new Set(times.map((t) => Math.floor(t / DAY_MS)));
  const last = times.length ? Math.max(...times) : null;
  const first = times.length ? Math.min(...times) : null;

  const pidBuyCounts = new Map<number, number>();
  for (const t of buy) {
    const pid = t.spid % 1_000_000;
    pidBuyCounts.set(pid, (pidBuyCounts.get(pid) ?? 0) + 1);
  }

  // KST 기준 심야/주말 거래 (UTC+9)
  let nightTrades = 0;
  let weekendTrades = 0;
  for (const t of times) {
    const kst = new Date(t + 9 * 3600_000);
    const h = kst.getUTCHours();
    const d = kst.getUTCDay();
    if (h < 6) nightTrades++;
    if (d === 0 || d === 6) weekendTrades++;
  }

  return {
    buyCount: buy.length,
    sellCount: sell.length,
    totalBuy,
    totalSell,
    net: totalSell - totalBuy,
    avgBuy: buy.length ? totalBuy / buy.length : 0,
    avgSell: sell.length ? totalSell / sell.length : 0,
    maxBuy: buyVals.length ? Math.max(...buyVals) : 0,
    maxSell: sellVals.length ? Math.max(...sellVals) : 0,
    gradeAvgBuy: buy.length ? buy.reduce((a, t) => a + (t.grade || 1), 0) / buy.length : 0,
    highGradeBuys: buy.filter((t) => (t.grade || 1) >= 8).length,
    daysSinceLast: last === null ? null : Math.floor((now - last) / DAY_MS),
    activeDays: dayKeys.size,
    spanDays: first !== null && last !== null ? Math.floor((last - first) / DAY_MS) : 0,
    repeatBuys: [...pidBuyCounts.values()].filter((n) => n >= 2).length,
    minBuy: buyVals.length ? Math.min(...buyVals) : 0,
    minSell: sellVals.length ? Math.min(...sellVals) : 0,
    maxGradeBuy: buy.length ? Math.max(...buy.map((t) => t.grade || 1)) : 0,
    nightTrades,
    weekendTrades,
  };
}

export type RuleTone = "win" | "lose" | "gold" | "info";

export interface MarketRule {
  id: string;
  kind: "type" | "note";
  tone: RuleTone;
  title: string;
  desc: string;
  when: (s: MarketStats) => boolean;
}

const S = (
  id: string,
  kind: "type" | "note",
  tone: RuleTone,
  title: string,
  desc: string,
  when: (s: MarketStats) => boolean
): MarketRule => ({ id, kind, tone, title, desc, when });

export const MARKET_RULES: MarketRule[] = [
  // ═══════════ 구단주 유형 (우선순위 순 — 첫 매칭 1개) ═══════════
  S("t-whale-surplus", "type", "gold", "흑자 큰손", "경 단위를 굴리면서도 순수지가 흑자 — 시장을 지배하는 트레이더입니다.", (s) => s.totalBuy >= 1 * GYEONG && s.net > 0),
  S("t-whale-deficit", "type", "gold", "화끈한 큰손", "경 단위 지출을 아끼지 않는 승부사. 스쿼드가 답을 줄 차례입니다.", (s) => s.totalBuy >= 1 * GYEONG && s.net <= 0),
  S("t-oneshot", "type", "gold", "한 방 승부사", "거래는 적지만 한 건 한 건이 초고가 — 확신이 설 때만 지릅니다.", (s) => s.buyCount > 0 && s.buyCount <= 8 && s.avgBuy >= 100 * JO),
  S("t-flipper", "type", "win", "정리의 달인", "방출이 영입을 압도 — 선수단을 팔아 곳간을 채우는 중입니다.", (s) => s.sellCount >= 15 && s.sellCount >= s.buyCount * 2),
  S("t-collector", "type", "info", "수집가", "사기만 하고 팔지 않는 타입 — 창고에 잠든 카드가 늘고 있어요.", (s) => s.buyCount >= 15 && s.sellCount <= Math.max(2, s.buyCount * 0.2)),
  S("t-daytrader", "type", "info", "마켓 단타러", "짧은 기간에 사고팔기를 반복 — 이적시장이 곧 콘텐츠인 유형.", (s) => s.buyCount + s.sellCount >= 40 && s.spanDays <= 14),
  S("t-grinder", "type", "win", "완성형 선호", "8강 이상 완성 카드를 자주 영입 — 직접 강화 대신 시장에서 완성품을 사는 타입입니다.", (s) => s.highGradeBuys >= 10),
  S("t-thrifty-surplus", "type", "win", "알뜰 흑자 상인", "적게 쓰고 더 벌었습니다 — BP 관리 교과서.", (s) => s.net > 0 && s.totalBuy < 100 * JO && s.sellCount > 0),
  S("t-bigdeficit", "type", "lose", "과감한 투자자", "수입 대비 지출이 큽니다 — 스쿼드 업그레이드에 올인한 시즌.", (s) => s.net < 0 && s.totalBuy >= s.totalSell * 3 && s.totalBuy >= 100 * JO),
  S("t-dormant", "type", "info", "휴식기 구단주", "최근 2주 넘게 거래가 없어요 — 시장 복귀를 기다립니다.", (s) => (s.daysSinceLast ?? 0) >= 14 && s.buyCount + s.sellCount > 0),
  S("t-nightowl", "type", "info", "심야 상인", "거래 절반 이상이 새벽 — 모두가 잘 때 매물을 낚아챕니다.", (s) => s.buyCount + s.sellCount >= 10 && s.nightTrades >= (s.buyCount + s.sellCount) * 0.5),
  S("t-weekender", "type", "info", "주말 장꾼", "거래가 주말에 집중 — 주말이 곧 이적시장 데이입니다.", (s) => s.buyCount + s.sellCount >= 10 && s.weekendTrades >= (s.buyCount + s.sellCount) * 0.6),
  S("t-margin", "type", "win", "마진 장인", "팔 때 평균가가 살 때보다 높습니다 — 시세 읽는 눈이 남다르네요.", (s) => s.buyCount >= 5 && s.sellCount >= 5 && s.avgSell >= s.avgBuy * 1.5),
  S("t-highroller", "type", "gold", "하이롤러", "평균 단가 자체가 최상위권 — 시장의 VIP 고객입니다.", (s) => s.buyCount >= 3 && s.avgBuy >= 80 * JO),
  S("t-fresh", "type", "info", "갓 개장한 상점", "이적시장 기록이 이제 막 쌓이기 시작했어요.", (s) => s.buyCount + s.sellCount <= 5),
  S("t-balanced", "type", "info", "균형 잡힌 구단주", "영입과 방출이 고르게 — 필요할 때 사고 팔 줄 아는 유형입니다.", () => true),

  // ═══════════ 총지출 (note) ═══════════
  S("n-spend-0", "note", "info", "무지출 런", "이번 표본에서 영입 지출이 없습니다 — 무과금 근육이 단단하네요.", (s) => s.buyCount === 0 && s.sellCount > 0),
  S("n-spend-t1", "note", "info", "소액 지출", "총 영입 지출 1조 미만 — 시장을 조심스럽게 탐색 중입니다.", (s) => s.buyCount > 0 && s.totalBuy < 1 * JO),
  S("n-spend-t2", "note", "info", "가벼운 지출", "총 영입 지출 1~10조 — 필요한 자리만 채우는 실속형.", (s) => s.totalBuy >= 1 * JO && s.totalBuy < 10 * JO),
  S("n-spend-t3", "note", "info", "중간 지출", "총 영입 지출 10~100조 — 로테이션까지 챙기기 시작했군요.", (s) => s.totalBuy >= 10 * JO && s.totalBuy < 100 * JO),
  S("n-spend-t4", "note", "gold", "큰 지출", "총 영입 지출 100~1,000조 — 주전 라인업 대공사 규모입니다.", (s) => s.totalBuy >= 100 * JO && s.totalBuy < 1000 * JO),
  S("n-spend-t5", "note", "gold", "초대형 지출", "총 영입 지출 1,000조~1경 — 리그에서 소문나는 수준의 투자.", (s) => s.totalBuy >= 1000 * JO && s.totalBuy < 1 * GYEONG),
  S("n-spend-t6", "note", "gold", "천문학적 지출", "총 영입 지출 1경 이상 — 이적시장의 큰손입니다.", (s) => s.totalBuy >= 1 * GYEONG),

  // ═══════════ 총수입 (note) ═══════════
  S("n-income-0", "note", "info", "방출 제로", "판 선수가 없습니다 — 정든 선수는 못 보내는 타입인가요?", (s) => s.sellCount === 0 && s.buyCount > 0),
  S("n-income-t1", "note", "info", "소소한 수입", "방출 수입 1조 미만 — 정리보다는 유지에 가깝습니다.", (s) => s.sellCount > 0 && s.totalSell < 1 * JO),
  S("n-income-t2", "note", "info", "쏠쏠한 수입", "방출 수입 1~10조 — 벤치 정리로 용돈벌이 성공.", (s) => s.totalSell >= 1 * JO && s.totalSell < 10 * JO),
  S("n-income-t3", "note", "win", "짭짤한 수입", "방출 수입 10~100조 — 파는 감각이 있습니다.", (s) => s.totalSell >= 10 * JO && s.totalSell < 100 * JO),
  S("n-income-t4", "note", "win", "대형 수입", "방출 수입 100~1,000조 — 셀링 클럽의 풍모.", (s) => s.totalSell >= 100 * JO && s.totalSell < 1000 * JO),
  S("n-income-t5", "note", "win", "초대형 수입", "방출 수입 1,000조 이상 — 팔 때를 아는 구단주.", (s) => s.totalSell >= 1000 * JO),

  // ═══════════ 순수지 (note) ═══════════
  S("n-net-bigplus", "note", "win", "대흑자", "순수지 +1,000조 이상 — 이적시장이 당신의 수익원입니다.", (s) => s.net >= 1000 * JO),
  S("n-net-plus", "note", "win", "흑자 운영", "순수지 흑자 — 사고팔며 오히려 BP가 늘었습니다.", (s) => s.net > 0 && s.net < 1000 * JO),
  S("n-net-zeroish", "note", "info", "본전 사수", "수입과 지출이 거의 같습니다 — 손해는 안 보는 장사꾼.", (s) => s.buyCount + s.sellCount > 0 && Math.abs(s.net) <= Math.max(s.totalBuy, s.totalSell) * 0.05),
  S("n-net-minus", "note", "lose", "적자 운영", "순수지 적자 — 그만큼 스쿼드에 투자했다는 뜻이기도 합니다.", (s) => s.net < 0 && s.net > -1000 * JO),
  S("n-net-bigminus", "note", "lose", "대적자", "순수지 -1,000조 이하 — 스쿼드가 그 값을 해줘야 합니다.", (s) => s.net <= -1000 * JO),

  // ═══════════ 최고가 영입 (note) ═══════════
  S("n-maxbuy-t1", "note", "info", "신중한 최고가", "가장 비싼 영입이 10조 미만 — 고가 카드엔 아직 신중합니다.", (s) => s.maxBuy > 0 && s.maxBuy < 10 * JO),
  S("n-maxbuy-t2", "note", "info", "중형 최고가", "최고가 영입 10~50조 — 핵심 자리엔 지갑을 엽니다.", (s) => s.maxBuy >= 10 * JO && s.maxBuy < 50 * JO),
  S("n-maxbuy-t3", "note", "gold", "대형 영입 한 방", "최고가 영입 50~200조 — 팀의 얼굴이 될 카드군요.", (s) => s.maxBuy >= 50 * JO && s.maxBuy < 200 * JO),
  S("n-maxbuy-t4", "note", "gold", "슈퍼스타 영입", "최고가 영입 200조 이상 — 리그 최고 수준의 베팅입니다.", (s) => s.maxBuy >= 200 * JO),
  S("n-maxbuy-half", "note", "gold", "몰빵 영입", "단 한 건이 전체 지출의 절반 이상 — 확실한 에이스 픽.", (s) => s.buyCount >= 3 && s.maxBuy >= s.totalBuy * 0.5),

  // ═══════════ 최고가 방출 (note) ═══════════
  S("n-maxsell-t1", "note", "info", "잔잔한 방출", "최고가 방출이 10조 미만 — 고가 카드는 아직 품고 있습니다.", (s) => s.maxSell > 0 && s.maxSell < 10 * JO),
  S("n-maxsell-t2", "note", "win", "중형 방출", "최고가 방출 10~50조 — 팔 건 파는 결단력.", (s) => s.maxSell >= 10 * JO && s.maxSell < 50 * JO),
  S("n-maxsell-t3", "note", "win", "대형 방출", "최고가 방출 50조 이상 — 에이스급도 값이 맞으면 보냅니다.", (s) => s.maxSell >= 50 * JO),
  S("n-maxsell-half", "note", "win", "한 방 정리", "방출 수입 절반이 단 한 건 — 제값 받고 보냈습니다.", (s) => s.sellCount >= 3 && s.maxSell >= s.totalSell * 0.5),

  // ═══════════ 평균 단가 (note) ═══════════
  S("n-avgbuy-t1", "note", "info", "가성비 쇼핑", "영입 평균 단가 1조 미만 — 저평가 카드 발굴형.", (s) => s.buyCount >= 3 && s.avgBuy < 1 * JO),
  S("n-avgbuy-t2", "note", "info", "실속 쇼핑", "영입 평균 단가 1~10조 — 중저가 시장의 단골.", (s) => s.buyCount >= 3 && s.avgBuy >= 1 * JO && s.avgBuy < 10 * JO),
  S("n-avgbuy-t3", "note", "info", "프리미엄 쇼핑", "영입 평균 단가 10~50조 — 검증된 카드 위주로 삽니다.", (s) => s.buyCount >= 3 && s.avgBuy >= 10 * JO && s.avgBuy < 50 * JO),
  S("n-avgbuy-t4", "note", "gold", "명품관 단골", "영입 평균 단가 50조 이상 — 카탈로그 맨 윗줄만 봅니다.", (s) => s.buyCount >= 3 && s.avgBuy >= 50 * JO),
  S("n-avgsell-high", "note", "win", "고가 판매 장인", "방출 평균 단가 10조 이상 — 헐값에 넘기지 않습니다.", (s) => s.sellCount >= 3 && s.avgSell >= 10 * JO),
  S("n-avg-sellgtbuy", "note", "win", "마진 트레이더", "방출 평균가가 영입 평균가보다 높습니다 — 싸게 사서 비싸게 파는 감각.", (s) => s.buyCount >= 3 && s.sellCount >= 3 && s.avgSell > s.avgBuy),

  // ═══════════ 거래 빈도 (note) ═══════════
  S("n-vol-t1", "note", "info", "과묵한 시장", "총 거래 5건 이하 — 이적시장과는 거리를 두는 편.", (s) => s.buyCount + s.sellCount > 0 && s.buyCount + s.sellCount <= 5),
  S("n-vol-t2", "note", "info", "가끔 들르는 시장", "총 거래 6~15건 — 필요할 때만 방문합니다.", (s) => s.buyCount + s.sellCount >= 6 && s.buyCount + s.sellCount <= 15),
  S("n-vol-t3", "note", "info", "시장 단골", "총 거래 16~40건 — 매물 보는 눈이 밝아지고 있어요.", (s) => s.buyCount + s.sellCount >= 16 && s.buyCount + s.sellCount <= 40),
  S("n-vol-t4", "note", "gold", "시장 죽돌이", "총 거래 40건 초과 — 경기보다 시장이 더 재밌는 거 아닌가요?", (s) => s.buyCount + s.sellCount > 40),
  S("n-vol-burst", "note", "info", "폭풍 쇼핑", "거래 대부분이 며칠 사이에 몰렸습니다 — 이벤트 기간이었나요?", (s) => s.buyCount + s.sellCount >= 10 && s.activeDays <= 3),
  S("n-vol-steady", "note", "win", "꾸준한 거래", "10일 이상에 걸쳐 거래 — 시장을 상시 모니터링하는 타입.", (s) => s.activeDays >= 10),

  // ═══════════ 영입/방출 밸런스 (note) ═══════════
  S("n-bal-buyheavy", "note", "info", "영입 편중", "영입이 방출의 3배 이상 — 스쿼드 몸집이 커지는 중.", (s) => s.sellCount > 0 && s.buyCount >= s.sellCount * 3),
  S("n-bal-sellheavy", "note", "info", "방출 편중", "방출이 영입의 3배 이상 — 다이어트 시즌이군요.", (s) => s.buyCount > 0 && s.sellCount >= s.buyCount * 3),
  S("n-bal-even", "note", "win", "완벽한 균형", "영입과 방출 건수가 거의 같습니다 — 들어오면 나간다, 원칙이 있네요.", (s) => s.buyCount >= 5 && Math.abs(s.buyCount - s.sellCount) <= 2),
  S("n-bal-onlybuy", "note", "info", "일방통행 영입", "이번 표본은 전부 영입 — 팔 생각이 없는 순수 바이어.", (s) => s.buyCount >= 5 && s.sellCount === 0),
  S("n-bal-onlysell", "note", "info", "일방통행 방출", "이번 표본은 전부 방출 — 대청소가 진행 중입니다.", (s) => s.sellCount >= 5 && s.buyCount === 0),

  // ═══════════ 강화 등급 (note) ═══════════
  S("n-grade-low", "note", "info", "원카 선호", "영입 카드의 평균 강화가 3강 미만 — 낮은 강화 카드 위주로 담습니다.", (s) => s.buyCount >= 3 && s.gradeAvgBuy > 0 && s.gradeAvgBuy < 3),
  S("n-grade-mid", "note", "info", "중강 실속파", "영입 평균 강화 3~6강 — 가격과 성능의 균형점을 압니다.", (s) => s.buyCount >= 3 && s.gradeAvgBuy >= 3 && s.gradeAvgBuy < 6),
  S("n-grade-high", "note", "gold", "고강 지향", "영입 평균 강화 6강 이상 — 완성품만 삽니다.", (s) => s.buyCount >= 3 && s.gradeAvgBuy >= 6),
  S("n-grade-8plus", "note", "gold", "8강 클럽", "8강 이상 카드를 여러 장 영입 — 강화 실패의 아픔을 돈으로 건너뛰었군요.", (s) => s.highGradeBuys >= 3 && s.highGradeBuys < 10),
  S("n-grade-8heavy", "note", "gold", "초고강 컬렉션", "8강 이상 영입이 10장 이상 — 번쩍이는 스쿼드가 그려집니다.", (s) => s.highGradeBuys >= 10),

  // ═══════════ 활동성 (note) ═══════════
  S("n-act-today", "note", "win", "오늘도 거래", "오늘 거래 기록이 있습니다 — 시장 감각이 살아있어요.", (s) => s.daysSinceLast === 0),
  S("n-act-week", "note", "info", "최근 활동", "일주일 내 거래 — 스쿼드 조정이 진행 중입니다.", (s) => s.daysSinceLast !== null && s.daysSinceLast >= 1 && s.daysSinceLast <= 7),
  S("n-act-2week", "note", "info", "숨 고르기", "마지막 거래가 1~2주 전 — 다음 매물을 노리는 중인가요?", (s) => s.daysSinceLast !== null && s.daysSinceLast > 7 && s.daysSinceLast <= 14),
  S("n-act-month", "note", "info", "장기 관망", "마지막 거래가 2주~한 달 전 — 시장을 관망하고 있습니다.", (s) => s.daysSinceLast !== null && s.daysSinceLast > 14 && s.daysSinceLast <= 30),
  S("n-act-old", "note", "info", "동면 중", "한 달 넘게 거래가 없습니다 — 지금 스쿼드에 만족한다는 뜻이겠죠.", (s) => s.daysSinceLast !== null && s.daysSinceLast > 30),

  // ═══════════ 재영입/특수 패턴 (note) ═══════════
  S("n-rebuy-1", "note", "info", "재영입 경험", "같은 선수를 다시 영입한 적이 있습니다 — 팔고 나서 그리웠나 봐요.", (s) => s.repeatBuys === 1),
  S("n-rebuy-multi", "note", "info", "환승 반복", "같은 선수 재영입이 여러 명 — 이별과 재회를 반복하는 로맨티스트.", (s) => s.repeatBuys >= 2),
  S("n-span-long", "note", "info", "장기 기록", "첫 거래와 마지막 거래 사이가 한 달 이상 — 긴 호흡의 운영입니다.", (s) => s.spanDays >= 30),
  S("n-span-short", "note", "info", "단기 집중", "모든 거래가 일주일 안에 — 목표가 뚜렷했던 쇼핑.", (s) => s.buyCount + s.sellCount >= 5 && s.spanDays <= 7),

  // ═══════════ 조합 코멘트 (note) ═══════════
  S("n-combo-sellwell", "note", "win", "곳간 지킴이", "많이 팔고 적게 썼습니다 — BP 잔고가 웃고 있겠네요.", (s) => s.totalSell >= s.totalBuy * 2 && s.sellCount >= 5),
  S("n-combo-allin", "note", "lose", "올인 시즌", "수입의 3배 넘게 지출 — 이번 시즌에 승부를 걸었습니다.", (s) => s.totalBuy >= s.totalSell * 3 && s.buyCount >= 5),
  S("n-combo-luxfew", "note", "gold", "미니멀 럭셔리", "거래는 적지만 전부 고가 — 양보다 질입니다.", (s) => s.buyCount + s.sellCount <= 10 && s.avgBuy >= 50 * JO && s.buyCount >= 2),
  S("n-combo-manytiny", "note", "info", "티끌 모아 스쿼드", "저가 카드 다건 거래 — 발품으로 스쿼드를 완성하는 중.", (s) => s.buyCount >= 15 && s.avgBuy < 5 * JO),
  S("n-combo-bigboth", "note", "gold", "큰물 트레이더", "지출과 수입 모두 100조 이상 — 시장의 유동성 공급자.", (s) => s.totalBuy >= 100 * JO && s.totalSell >= 100 * JO),
  S("n-combo-quietrich", "note", "gold", "조용한 부자", "거래는 드물지만 단가가 높습니다 — 움직일 때만 크게 움직이는 타입.", (s) => s.buyCount + s.sellCount <= 8 && (s.avgBuy >= 100 * JO || s.avgSell >= 100 * JO)),

  // ═══════════ 최저가/헐값 (note) ═══════════
  S("n-minbuy-tiny", "note", "info", "천원샵 발견", "1,000억 BP 미만 영입 기록 — 잡초 속 보석을 노리는 눈썰미.", (s) => s.minBuy > 0 && s.minBuy < 0.1 * JO),
  S("n-minbuy-none-cheap", "note", "gold", "저가 카드 무관심", "가장 싼 영입도 10조 이상 — 애초에 싼 매물은 안 봅니다.", (s) => s.buyCount >= 3 && s.minBuy >= 10 * JO),
  S("n-minsell-tiny", "note", "info", "떨이 처분", "1,000억 BP 미만 방출 기록 — 자리 정리가 우선이었군요.", (s) => s.minSell > 0 && s.minSell < 0.1 * JO),
  S("n-buyrange-wide", "note", "info", "전천후 쇼핑", "최저가와 최고가 영입이 100배 이상 차이 — 시장 전 구간을 훑습니다.", (s) => s.minBuy > 0 && s.maxBuy >= s.minBuy * 100),
  S("n-sellrange-wide", "note", "info", "전천후 판매", "헐값 정리부터 프리미엄 판매까지 — 방출 스펙트럼이 넓습니다.", (s) => s.minSell > 0 && s.maxSell >= s.minSell * 100),

  // ═══════════ 심야/주말 (note) ═══════════
  S("n-night-some", "note", "info", "새벽 손님", "심야(0~6시) 거래가 있습니다 — 새벽 매물 체크는 국룰이죠.", (s) => s.nightTrades >= 1 && s.nightTrades <= 4),
  S("n-night-many", "note", "info", "올빼미 트레이더", "심야 거래 5건 이상 — 새벽 시장의 단골입니다.", (s) => s.nightTrades >= 5),
  S("n-weekend-many", "note", "info", "주말 집중 거래", "주말 거래 비중이 높습니다 — 주중은 관찰, 주말은 실행.", (s) => s.buyCount + s.sellCount >= 5 && s.weekendTrades >= (s.buyCount + s.sellCount) * 0.4),
  S("n-weekday-only", "note", "info", "평일 전문가", "거래가 전부 평일 — 주말엔 경기에 집중하시는군요.", (s) => s.buyCount + s.sellCount >= 8 && s.weekendTrades === 0),

  // ═══════════ 건수 세분 (note) ═══════════
  S("n-buycount-t1", "note", "info", "영입 1~4건", "영입이 4건 이하 — 확실한 타깃만 노렸습니다.", (s) => s.buyCount >= 1 && s.buyCount <= 4),
  S("n-buycount-t2", "note", "info", "영입 5~14건", "영입 5~14건 — 스쿼드 개편이 착실히 진행 중.", (s) => s.buyCount >= 5 && s.buyCount <= 14),
  S("n-buycount-t3", "note", "info", "영입 15~29건", "영입 15~29건 — 사실상 리빌딩 수준의 쇼핑입니다.", (s) => s.buyCount >= 15 && s.buyCount <= 29),
  S("n-buycount-t4", "note", "gold", "영입 30건 이상", "표본 한도급 영입 — 스쿼드가 통째로 바뀌었겠는데요?", (s) => s.buyCount >= 30),
  S("n-sellcount-t1", "note", "info", "방출 1~4건", "방출 4건 이하 — 꼭 필요한 정리만 했습니다.", (s) => s.sellCount >= 1 && s.sellCount <= 4),
  S("n-sellcount-t2", "note", "info", "방출 5~14건", "방출 5~14건 — 벤치가 한결 가벼워졌습니다.", (s) => s.sellCount >= 5 && s.sellCount <= 14),
  S("n-sellcount-t3", "note", "info", "방출 15~29건", "방출 15~29건 — 창고 대방출 시즌.", (s) => s.sellCount >= 15 && s.sellCount <= 29),
  S("n-sellcount-t4", "note", "win", "방출 30건 이상", "표본 한도급 방출 — 안 쓰는 카드는 남기지 않습니다.", (s) => s.sellCount >= 30),

  // ═══════════ 강화 최고치 (note) ═══════════
  S("n-maxgrade-10", "note", "gold", "10강+ 헌터", "10강 이상 카드를 영입 — 강화 확률과의 싸움을 돈으로 이겼습니다.", (s) => s.maxGradeBuy >= 10),
  S("n-maxgrade-1only", "note", "info", "순정 원카파", "영입 카드가 전부 1강 — 완성품 대신 원카만 담습니다.", (s) => s.buyCount >= 3 && s.maxGradeBuy <= 1),

  // ═══════════ 수익률/회전 (note) ═══════════
  S("n-roi-double", "note", "win", "2배 회수", "방출 수입이 영입 지출의 2배 이상 — 투자 수익률이 훌륭합니다.", (s) => s.totalBuy > 0 && s.totalSell >= s.totalBuy * 2),
  S("n-roi-tenth", "note", "lose", "회수율 10% 미만", "지출 대비 회수가 10%도 안 됩니다 — 판 카드보다 산 카드가 압도적.", (s) => s.totalBuy > 0 && s.sellCount > 0 && s.totalSell < s.totalBuy * 0.1),
  S("n-turnover-fast", "note", "info", "빠른 회전", "하루 평균 2건 이상 거래한 기간 — 손이 빠른 트레이더.", (s) => s.spanDays >= 3 && (s.buyCount + s.sellCount) / Math.max(1, s.spanDays) >= 2),

  // ═══════════ 추가 조합 (note) ═══════════
  S("n-combo-starseller", "note", "win", "스타 판매상", "최고가 방출이 최고가 영입보다 큽니다 — 파는 쪽이 주력이군요.", (s) => s.maxSell > s.maxBuy && s.maxBuy > 0),
  S("n-combo-upgrade", "note", "info", "업그레이드 사이클", "싸게 팔고 비싸게 삽니다 — 전형적인 스쿼드 상향 패턴.", (s) => s.buyCount >= 5 && s.sellCount >= 5 && s.avgBuy > s.avgSell * 2),
  S("n-combo-window", "note", "info", "이적시장 개장 러시", "활동일 대비 거래량이 높습니다 — 열리면 바로 움직이는 타입.", (s) => s.activeDays >= 2 && (s.buyCount + s.sellCount) / s.activeDays >= 5),
  S("n-combo-patient", "note", "info", "느긋한 시장가", "긴 기간에 드문드문 거래 — 급할 것 없는 관록의 운영.", (s) => s.spanDays >= 20 && (s.buyCount + s.sellCount) / Math.max(1, s.activeDays) <= 2),
  S("n-combo-jackpot", "note", "gold", "잭팟 한 건", "단일 방출로 50조 이상 — 그날은 발 뻗고 주무셨겠어요.", (s) => s.maxSell >= 50 * JO && s.totalSell > 0 && s.maxSell >= s.totalSell * 0.7),
] as const as MarketRule[];

export interface MarketDiagnosis {
  type: MarketRule | null;
  notes: MarketRule[];
}

const MAX_NOTES = 4;

export function diagnoseMarket(s: MarketStats): MarketDiagnosis {
  if (s.buyCount + s.sellCount === 0) return { type: null, notes: [] };
  const type = MARKET_RULES.find((r) => r.kind === "type" && r.when(s)) ?? null;
  const notes = MARKET_RULES.filter((r) => r.kind === "note" && r.when(s)).slice(0, MAX_NOTES);
  return { type, notes };
}
