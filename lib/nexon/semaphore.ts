/**
 * 넥슨 API 호출 동시 실행 제한.
 *
 * 과거엔 완전 순차(동시 1)였다. 무제한 병렬로 30건을 한 번에 쏘면 429 가 빈발했기 때문인데,
 * **제한된 동시 실행은 다르다.** 라이브 실측(2026-09-05, 실제 30경기 콜드 조회 워크로드):
 *   동시 1 → 약 9,000ms · 동시 3 → **2,883ms, 비200 응답 0건**
 *
 * 콜드 조회의 지배적 비용이 match-detail 30콜이라 체감 지연이 3배 줄고,
 * Vercel 은 함수 실행 시간으로 과금하므로 비용도 함께 줄어든다.
 *
 * 안전장치: 429 를 한 번이라도 보면 그 인스턴스는 남은 수명 동안 동시 1로 강등한다.
 * 서버리스 인스턴스는 수명이 짧아 다음 인스턴스에서 자연히 회복된다.
 * (자동 복귀 로직은 두지 않는다 — 되돌리는 순간 429 를 다시 유발하는 진동이 생긴다)
 */
export const MAX_CONCURRENCY = 3;

export class Semaphore {
  private limit: number;
  private active = 0;
  private waiters: (() => void)[] = [];

  constructor(limit: number = MAX_CONCURRENCY) {
    this.limit = Math.max(1, limit);
  }

  get inFlight(): number {
    return this.active;
  }
  get currentLimit(): number {
    return this.limit;
  }

  async acquire(): Promise<void> {
    // while: 대기 중에 limit 이 낮아졌거나(강등) 다른 대기자가 먼저 슬롯을 가져갔을 수 있다
    while (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active++;
  }

  release(): void {
    this.active--;
    this.waiters.shift()?.();
  }

  /** 429 관측 → 순차로 강등. 대기자를 모두 깨워 조건을 다시 평가하게 한다. */
  demote(): void {
    if (this.limit === 1) return;
    this.limit = 1;
    while (this.waiters.length) this.waiters.shift()?.();
  }

  /** 테스트 전용 — 상태 초기화 */
  reset(limit: number = MAX_CONCURRENCY): void {
    this.limit = Math.max(1, limit);
    this.active = 0;
    this.waiters = [];
  }
}

/** 인스턴스 전역 세마포어 */
export const nexonSemaphore = new Semaphore();
