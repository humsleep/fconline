import 'server-only';

import { isNexonPaused } from './pause';

const BASE = 'https://open.api.nexon.com';

/** 넥슨 오픈API 에러. code는 OPENAPI00003 같은 공통 에러 코드 또는 NOT_CONFIGURED. */
export class NexonApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'NexonApiError';
    this.status = status;
    this.code = code;
  }
}

export function isUserNotFound(err: unknown): boolean {
  return err instanceof NexonApiError && err.code === 'OPENAPI00003';
}

export function isNotConfigured(err: unknown): boolean {
  return err instanceof NexonApiError && err.code === 'NOT_CONFIGURED';
}

export function isMaintenance(err: unknown): boolean {
  return (
    err instanceof NexonApiError &&
    (err.code === 'OPENAPI00010' || err.code === 'OPENAPI00011')
  );
}

/** 넥슨 호출 한도 초과(429) — 재시도 유도 대신 "잠시 후" 안내가 맞는 상태 */
export function isRateLimited(err: unknown): boolean {
  return err instanceof NexonApiError && err.status === 429;
}

/** 넥슨 응답 지연(8초 초과) — 재시도하면 대개 정상 */
export function isTimeout(err: unknown): boolean {
  return err instanceof NexonApiError && err.code === 'TIMEOUT';
}

/** 운영자 수동 kill-switch로 넥슨 팬아웃을 정지시킨 상태 */
export function isPaused(err: unknown): boolean {
  return err instanceof NexonApiError && err.code === 'PAUSED';
}

/** 캐시 정책: 초 단위 revalidate 또는 불변 데이터(match-detail)용 'immutable' */
type CachePolicy = number | 'immutable';

// 넥슨 API는 병렬 호출에 민감(429 빈발 사례 확인) → 인스턴스 내 순차 큐
let queue: Promise<unknown> = Promise.resolve();

export function nexonFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cachePolicy: CachePolicy
): Promise<T> {
  const run = async (): Promise<T> => {
    const key = process.env.NEXON_API_KEY;
    if (!key) {
      throw new NexonApiError(
        'NEXON_API_KEY가 설정되지 않았습니다',
        503,
        'NOT_CONFIGURED'
      );
    }

    const url = new URL(`/fconline/v1/${path}`, BASE);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    // 행 걸린 소켓 하나가 인스턴스 큐 전체를 동결시키지 않도록 per-request 타임아웃
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'x-nxopen-api-key': key },
        signal: AbortSignal.timeout(8000),
        ...(cachePolicy === 'immutable'
          ? { cache: 'force-cache' as const }
          : { next: { revalidate: cachePolicy } }),
      });
    } catch (err) {
      if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError') {
        throw new NexonApiError('넥슨 API 응답 지연(8초 초과)', 504, 'TIMEOUT');
      }
      throw err;
    }

    if (!res.ok) {
      let code = `HTTP${res.status}`;
      let message = `넥슨 API 오류 (HTTP ${res.status})`;
      try {
        const body = (await res.json()) as {
          error?: { name?: string; message?: string };
        };
        if (body.error?.name) code = body.error.name;
        if (body.error?.message) message = body.error.message;
      } catch {
        // 에러 본문이 JSON이 아니면 상태 코드만 사용
      }
      throw new NexonApiError(message, res.status, code);
    }

    return res.json() as Promise<T>;
  };

  // kill-switch는 순차 큐 '진입 전'에 검사한다(임계경로에 Supabase 왕복을 넣지 않음).
  // 정지 상태면 넥슨을 아예 호출하지 않고 PAUSED로 단락.
  return (async () => {
    if (await isNexonPaused()) {
      throw new NexonApiError('넥슨 조회가 일시 중단되었습니다', 503, 'PAUSED');
    }
    // 앞선 요청의 성공/실패와 무관하게 순차 실행
    const result = queue.then(run, run);
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  })();
}
