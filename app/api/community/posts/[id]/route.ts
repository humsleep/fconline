import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  POST_TYPES,
  TITLE_MAX,
  BODY_MAX,
  META_MAX,
  type PostField,
  type PostType,
} from '@/lib/community/post-types';
import { REGIONS, POSITION_OPTIONS } from '@/lib/community/constants';

const REGION_SET = new Set<string>(REGIONS);
const POSITION_SET = new Set<string>(POSITION_OPTIONS);
const META_KEYS: PostField[] = ['budget', 'schedule', 'date', 'format', 'entry'];

/** 수정 폼 프리필용 단건 조회 (공개 데이터) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('community_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!data)
    return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
  return NextResponse.json({ post: data });
}

async function requireOwner(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, owns: false };
  const { data } = await supabase
    .from('community_posts')
    .select('author_id')
    .eq('id', id)
    .maybeSingle();
  return { supabase, user, owns: data?.author_id === user.id };
}

/** 상태 토글(status) 또는 내용 수정(edit:true) — 둘 다 작성자만 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, owns } = await requireOwner(id);
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!owns)
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  // 모드 1: 상태 토글
  if (!payload.edit) {
    const status = payload?.status === 'closed' ? 'closed' : 'open';
    const { error } = await supabase
      .from('community_posts')
      .update({ status })
      .eq('id', id);
    if (error)
      return NextResponse.json({ error: '변경에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ ok: true, status });
  }

  // 모드 2: 내용 수정 — 유형은 변경 불가, 해당 유형의 허용 필드만 반영
  const { data: current } = await supabase
    .from('community_posts')
    .select('type')
    .eq('id', id)
    .maybeSingle();
  const type = current?.type as PostType | undefined;
  if (!type || !POST_TYPES[type])
    return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
  const allowed = new Set<PostField>(POST_TYPES[type].fields);

  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  if (!title || !body)
    return NextResponse.json({ error: '제목과 내용을 입력하세요.' }, { status: 400 });
  if (title.length > TITLE_MAX || body.length > BODY_MAX)
    return NextResponse.json({ error: '입력이 너무 깁니다.' }, { status: 400 });

  const region =
    allowed.has('region') && payload.region && REGION_SET.has(String(payload.region))
      ? String(payload.region)
      : null;
  const positions =
    allowed.has('positions') && Array.isArray(payload.positions)
      ? [...new Set(payload.positions.map(String))]
          .filter((p) => POSITION_SET.has(p))
          .slice(0, 6)
      : [];
  const contact =
    allowed.has('contact') && payload.contact
      ? String(payload.contact).trim().slice(0, META_MAX) || null
      : null;
  const rawSquad =
    allowed.has('squad') && payload.squad_id
      ? String(payload.squad_id).trim().slice(0, 32)
      : '';
  const squad_id = /^[a-zA-Z0-9]{1,32}$/.test(rawSquad) ? rawSquad : null;

  const meta: Record<string, string> = {};
  for (const k of META_KEYS) {
    if (allowed.has(k) && payload[k]) {
      const v = String(payload[k]).trim().slice(0, META_MAX);
      if (v) meta[k] = v;
    }
  }

  const { error } = await supabase
    .from('community_posts')
    .update({ title, body, region, positions, contact, squad_id, meta })
    .eq('id', id);
  if (error)
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user, owns } = await requireOwner(id);
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!owns)
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
