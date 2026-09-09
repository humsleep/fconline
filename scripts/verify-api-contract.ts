/**
 * 앱 응답 계약 실검증 — 실제 배포된 서버를 호출해 `lib/api/contract.ts` 와 대조한다.
 *
 * 단위 테스트는 검증기만 검사한다. 라우트가 실제로 무엇을 내려주는지는 여기서만 알 수 있다.
 * 넥슨·DB 가 붙어 있어야 의미 있는 응답이 나오므로 로컬 dev 보다 프로덕션/프리뷰를 권한다.
 *
 *   npm run verify:api                      # https://www.fcscope.xyz
 *   npm run verify:api -- <baseUrl> [닉네임]
 *
 * 위반이 하나라도 있으면 exit 1. 배포 전(특히 v1 라우트를 건드린 PR)에 돌린다.
 */
import { checkRoute, ROUTES, AUTH_ONLY, WRITE_ONLY, type Violation } from '../lib/api/contract';

const BASE = (process.argv[2] || 'https://www.fcscope.xyz').replace(/\/$/, '');
const NICK = process.argv[3] || '보엠';

interface Case { key: string; url: string; note?: string }

let failures = 0;
let checked = 0;
const skipped: string[] = [];

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function report(key: string, url: string, violations: Violation[]) {
  const path = url.slice(BASE.length);
  if (violations.length === 0) {
    console.log(`  ✓ ${key}`);
    return;
  }
  failures += violations.length;
  console.log(`  ✗ ${key}  (${path})`);
  for (const v of violations) console.log(`      ${v.path} — ${v.detail}`);
}

async function run(c: Case) {
  const { status, body } = await getJson(c.url);
  if (status !== 200) {
    // 404/503 은 계약 위반이 아니라 데이터·설정 문제 — 건너뛰되 눈에 띄게 남긴다.
    skipped.push(`${c.key} — HTTP ${status}${c.note ? ` (${c.note})` : ''}`);
    console.log(`  – ${c.key}  HTTP ${status}`);
    return;
  }
  checked++;
  report(c.key, c.url, checkRoute(c.key, body));
}

/** 응답에서 후속 검증에 쓸 id 를 뽑는다. 없으면 해당 라우트를 건너뛴다. */
function pick<T>(v: unknown, path: string[]): T | null {
  let cur: unknown = v;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = Array.isArray(cur) ? cur[Number(seg)] : (cur as Record<string, unknown>)[seg];
  }
  return (cur ?? null) as T | null;
}

async function main() {
  console.log(`앱 응답 계약 검증 — ${BASE} (구단주: ${NICK})\n`);
  const n = encodeURIComponent(NICK);

  // 고정 경로
  for (const c of [
    { key: 'GET /api/v1/home', url: `${BASE}/api/v1/home` },
    { key: 'GET /api/v1/meta', url: `${BASE}/api/v1/meta` },
    { key: 'GET /api/v1/community/posts', url: `${BASE}/api/v1/community/posts` },
    { key: 'GET /api/players/search', url: `${BASE}/api/players/search?q=손흥민` },
    { key: 'GET /api/v1/user/:nickname', url: `${BASE}/api/v1/user/${n}` },
    { key: 'GET /api/v1/user/:nickname/report', url: `${BASE}/api/v1/user/${n}/report` },
    { key: 'GET /api/v1/user/:nickname/players', url: `${BASE}/api/v1/user/${n}/players` },
    { key: 'GET /api/v1/user/:nickname/playstyle', url: `${BASE}/api/v1/user/${n}/playstyle` },
    // 구 라우트 — 앱이 v1 과 똑같이 의존한다.
    { key: 'GET /api/me/notifications', url: `${BASE}/api/me/notifications` },
    { key: 'GET /api/squad/preset', url: `${BASE}/api/squad/preset?id=mancity` },
    { key: 'GET /api/squad/from-user', url: `${BASE}/api/squad/from-user?nickname=${n}` },
  ] satisfies Case[]) {
    await run(c);
  }

  // 파라미터가 필요한 경로 — 앞선 응답에서 실제 id 를 뽑아 쓴다.
  const user = await getJson(`${BASE}/api/v1/user/${n}`);
  const matchId = pick<string>(user.body, ['matches', '0', 'matchId']);
  if (matchId) await run({ key: 'GET /api/v1/match/:matchId', url: `${BASE}/api/v1/match/${matchId}` });
  else skipped.push('GET /api/v1/match/:matchId — 경기 기록이 없어 matchId 를 못 구함');

  // 픽 랭킹이 비어 있을 수 있으므로(랭커 스냅샷 미갱신) 전적의 선수 목록으로 대체한다.
  const meta = await getJson(`${BASE}/api/v1/meta`);
  let spid = pick<number>(meta.body, ['lines', '0', 'rows', '0', 'spId']);
  if (!spid) {
    const players = await getJson(`${BASE}/api/v1/user/${n}/players`);
    spid = pick<number>(players.body, ['players', '0', 'spId']);
  }
  if (spid) await run({ key: 'GET /api/v1/player/:spid', url: `${BASE}/api/v1/player/${spid}` });
  else skipped.push('GET /api/v1/player/:spid — 픽 랭킹·전적 어디서도 spid 를 못 구함');

  const list = await getJson(`${BASE}/api/v1/community/posts`);
  const postId = pick<string>(list.body, ['posts', '0', 'id']);
  if (postId) await run({ key: 'GET /api/v1/community/posts/:id', url: `${BASE}/api/v1/community/posts/${postId}` });
  else skipped.push('GET /api/v1/community/posts/:id — 게시글이 없어 id 를 못 구함');

  // battle 투표 · 스쿼드 상세 — 커뮤니티 글에서 실제 id 를 뽑아 쓴다.
  if (postId) await run({ key: 'GET /api/community/battle', url: `${BASE}/api/community/battle?postId=${postId}` });
  else skipped.push('GET /api/community/battle — postId 를 못 구함');

  const squadId = pick<string>(list.body, ['posts', '0', 'squad_id'])
    ?? pick<string>(await getJson(`${BASE}/api/v1/community/posts`).then((r) => r), ['body', 'posts', '1', 'squad_id']);
  if (squadId) await run({ key: 'GET /api/squad/:id', url: `${BASE}/api/squad/${squadId}` });
  else skipped.push('GET /api/squad/:id — 스쿼드가 붙은 글이 없어 id 를 못 구함');

  // 익명으로는 확인할 수 없는 라우트를 명시적으로 남긴다(조용히 빠지지 않도록).
  for (const k of AUTH_ONLY) skipped.push(`${k} — 로그인 필요(익명 검증 불가)`);
  for (const k of WRITE_ONLY) skipped.push(`${k} — 쓰기 라우트(자동 호출 안 함)`);

  const defined = Object.keys(ROUTES).length;
  const auto = defined - AUTH_ONLY.size - WRITE_ONLY.size;
  console.log(`\n검증 ${checked}/${auto} 라우트(자동 검증 대상) · 계약 정의 ${defined}개 · 위반 ${failures}건`);
  if (skipped.length) {
    console.log('\n건너뜀:');
    for (const s of skipped) console.log(`  – ${s}`);
  }
  if (failures) {
    console.log('\n🔴 계약 위반입니다. 앱이 이 응답을 디코딩하지 못합니다.');
    console.log('   Swift Decodable 은 필수 필드가 하나만 없어도 응답 전체가 실패합니다.');
    console.log('   AGENTS.md 의 "/api/v1 은 깨뜨릴 수 없는 공개 계약" 항목을 확인하세요.');
    process.exit(1);
  }
  console.log('✓ 계약 위반 없음');
}

main().catch((e) => {
  console.error('검증 실행 실패:', e instanceof Error ? e.message : e);
  process.exit(1);
});
