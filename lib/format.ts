/** 넥슨 API 날짜(UTC, 'Z' 없이 올 수 있음)를 KST로 표시 */
export function formatMatchDate(raw: string): string {
  const iso = raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatAchievementDate(raw: string): string {
  const iso = raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

const BP_UNITS = [
  { v: 1e16, name: '경' },
  { v: 1e12, name: '조' },
  { v: 1e8, name: '억' },
  { v: 1e4, name: '만' },
] as const;

/** BP 금액을 한국식 단위 두 자리로. 예: 4_7500_0000 → "4억 7,500만" */
export function formatKoreanBP(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  for (let i = 0; i < BP_UNITS.length; i++) {
    const { v, name } = BP_UNITS[i];
    if (n < v) continue;
    const major = Math.floor(n / v);
    const next = BP_UNITS[i + 1];
    const rest = next ? Math.floor((n % v) / next.v) : Math.floor(n % v);
    const restLabel = rest > 0 ? ` ${rest.toLocaleString()}${next?.name ?? ''}` : '';
    return `${major.toLocaleString()}${name}${restLabel}`;
  }
  return n.toLocaleString();
}

/** BP 금액 축약 한 단어. 예: 4_7500_0000 → "4.75억", 123_0000_0000 → "123억" */
export function formatKoreanBPShort(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  for (const { v, name } of BP_UNITS) {
    if (n < v) continue;
    const x = n / v;
    const s =
      x >= 100
        ? Math.round(x).toLocaleString()
        : x >= 10
          ? x.toFixed(1).replace(/\.0$/, '')
          : x.toFixed(2).replace(/\.?0+$/, '');
    return `${s}${name}`;
  }
  return n.toLocaleString();
}

/** 상대 시간(방금·N분·N시간·N일 전). 그 이상은 날짜로. timestamptz(ISO) 입력. */
export function formatRelativeKr(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}
