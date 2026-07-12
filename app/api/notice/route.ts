import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** 활성 공지 1건 (공개). 배너는 클라이언트에서 마운트 후 조회 — 정적 페이지에 영향 없음. */
export async function GET() {
  const db = getAdmin();
  if (!db) return NextResponse.json({ notice: null });
  try {
    const { data } = await db
      .from('notices')
      .select('id, text, link')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json(
      { notice: data ?? null },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch {
    return NextResponse.json({ notice: null });
  }
}
