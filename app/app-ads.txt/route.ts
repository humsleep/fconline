import { NextResponse } from 'next/server';

/**
 * AdMob app-ads.txt — 앱스토어 등록 시 "마케팅 URL/개발자 웹사이트"를 fcscope.xyz 로 두면
 * AdMob 이 이 파일로 앱 소유를 확인한다(없으면 광고 수익 제한). `ADMOB_PUBLISHER_ID`(pub-…) 설정 시만 노출.
 */
export function GET() {
  const pub = process.env.ADMOB_PUBLISHER_ID;
  if (!pub || !/^pub-\d{10,20}$/.test(pub)) return new NextResponse('Not Found', { status: 404 });
  return new NextResponse(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}
