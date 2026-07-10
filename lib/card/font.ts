// OG/공유 카드용 한국어 폰트 서브셋 로더 (satori는 woff2 미지원 → TTF 유도).
// 카드에 실제 쓰이는 글자만 서브셋으로 받아 가볍게.
export async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(
          text
        )}`,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } }
      )
    ).text();
    const url = css.match(
      /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/
    )?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}
