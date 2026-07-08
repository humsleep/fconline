import 'server-only';

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

    const res = await fetch(url, {
      headers: { 'x-nxopen-api-key': key },
      ...(cachePolicy === 'immutable'
        ? { cache: 'force-cache' as const }
        : { next: { revalidate: cachePolicy } }),
    });

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

  // 앞선 요청의 성공/실패와 무관하게 순차 실행
  const result = queue.then(run, run);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}
