import { castVote, getVoteCounts } from '@/lib/vs';

export const dynamic = 'force-dynamic';

// GET /api/vs/vote?key=... → 현재 투표 수
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return Response.json({ error: 'missing key' }, { status: 400 });
  return Response.json(await getVoteCounts(key));
}

// POST { key, voter, pick } → 투표 반영 후 최신 수
export async function POST(req: Request) {
  let body: { key?: string; voter?: string; pick?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  const { key, voter, pick } = body;
  if (
    typeof key !== 'string' ||
    typeof voter !== 'string' ||
    (pick !== 'A' && pick !== 'B')
  ) {
    return Response.json({ error: 'invalid vote' }, { status: 400 });
  }
  // key는 정규 vsKey 형식(spId:spId:pos)만 — 정크 row 삽입 차단
  if (!/^\d{1,9}:\d{1,9}:\d{1,2}$/.test(key) || voter.length < 4 || voter.length > 64) {
    return Response.json({ error: 'invalid format' }, { status: 400 });
  }

  return Response.json(await castVote(key, voter, pick));
}
