import { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 세션 쿠키 롤오버가 필요 없는 이미지/카드 프록시는 제외 — 스쿼드 뷰 1회에 선수 이미지가
    // 십수 장 뜨는데 매 요청마다 Supabase auth 왕복이 붙는 낭비를 막는다.
    // (프리픽스를 정확히 한정 — /api/community, /api/me 등 세션이 필요한 API는 계속 통과)
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|api/player-image|api/season-image|api/card|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
