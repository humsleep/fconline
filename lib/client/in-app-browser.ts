/**
 * 인스타/페북/카톡 등 "인앱 웹뷰" 감지 (순수 함수, userAgent 문자열 입력).
 *
 * 인스타그램·페이스북 인앱 브라우저는 구글 OAuth를 차단(`disallowed_useragent`)해
 * 로그인 버튼이 막다른 길이 된다. 감지해서 "외부 브라우저로 열기" 안내를 띄우기 위함.
 * 전적 검색·카드·메타 등 핵심 기능은 비로그인 동작이라 웹뷰에서도 정상이며, 이 힌트는
 * 로그인이 필요한 사용자에게만 의미가 있다.
 */
export function isInAppBrowser(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Instagram|FBAN|FBAV|FB_IAB|Threads|KAKAOTALK|NAVER\(inapp|Line\/|DaumApps/i.test(
    ua
  );
}

/** 감지된 인앱 브라우저 이름(안내 문구용). 모르면 '앱'. */
export function inAppBrowserName(ua: string | null | undefined): string {
  if (!ua) return '앱';
  if (/Instagram/i.test(ua)) return '인스타그램';
  if (/Threads/i.test(ua)) return '스레드';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return '페이스북';
  if (/KAKAOTALK/i.test(ua)) return '카카오톡';
  if (/NAVER\(inapp|DaumApps/i.test(ua)) return '네이버/다음';
  if (/Line\//i.test(ua)) return '라인';
  return '앱';
}
