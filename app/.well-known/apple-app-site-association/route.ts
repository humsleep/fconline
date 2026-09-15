import { NextResponse } from 'next/server';

/**
 * iOS 유니버설 링크 — https://www.fcscope.xyz/user/… 같은 공유 링크를 탭하면 앱으로 열린다.
 * `APPLE_TEAM_ID`(Apple Developer 팀 ID) 미설정 시 404 → 앱 설치 전엔 아무 영향 없음.
 * 앱 쪽: Associated Domains 엔타이틀먼트 `applinks:www.fcscope.xyz`, `applinks:fcscope.xyz`.
 * 인증/API/운영 경로는 제외(앱에서 열면 안 됨).
 */
const BUNDLE_ID = process.env.NEXT_PUBLIC_IOS_BUNDLE_ID ?? 'xyz.fcscope.app';

export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return new NextResponse('Not Found', { status: 404 });
  const appID = `${team}.${BUNDLE_ID}`;
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [appID],
          components: [
            { '/': '/auth/*', exclude: true },
            { '/': '/api/*', exclude: true },
            { '/': '/admin*', exclude: true },
            { '/': '/qr*', exclude: true },
            { '/': '/login*', exclude: true },
            // 앱 설정의 약관·방침 링크가 앱 자신으로 되돌아오면 방침을 볼 수 없다(App Store 5.1.1(i)).
            { '/': '/terms*', exclude: true },
            { '/': '/privacy*', exclude: true },
            { '/': '*' },
          ],
        },
      ],
    },
    webcredentials: { apps: [appID] },
  };
  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
