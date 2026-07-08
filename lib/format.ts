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
