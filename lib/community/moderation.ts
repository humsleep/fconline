import 'server-only';

/**
 * UGC 금칙어 필터 (App Store 가이드라인 1.2) — 커뮤니티 글·댓글·닉네임 저장 전에 서버에서 검사한다.
 * 목록이 클라이언트 번들에 실리지 않도록 server-only.
 *
 * 설계 원칙: **오탐이 미탐보다 비싸다.** 정상 축구 대화("다시 발로", "날씨 벌써", "슈바인슈타이거",
 * "시발점", "hamstring niggle", "Scunthorpe")가 막히면 커뮤니티가 죽는다. 그래서
 *  - 한글: 한글·자모 외 문자(숫자·기호·라틴·이모지)만 지워 "씨1발/시.발/씨a발"을 잡고,
 *    띄어쓰기는 **한 글자 토큰만** 다음 토큰에 붙인다("씨 발", "ㅅ ㅂ", "개 새끼").
 *    두 글자 이상 단어 사이의 공백은 유지해 단어 경계를 넘는 우연한 조합을 막는다.
 *  - 영어: 공백으로 나눈 단어 안에서만 본다(leet 치환 후). "goals hit" 가 "shit" 이 되지 않게.
 *  - 뜻이 둘인 짧은 말(보지/자지/새끼/미친/토토/졸라/씹 단독 등)은 넣지 않는다.
 * 완벽한 차단이 목적이 아니라 명백한 욕설·혐오·도박/성인 스팸의 1차 거름망이다. 나머지는 신고(0010)가 받는다.
 */

export const MODERATION_MESSAGE = '부적절한 표현이 포함돼 있어요.';

/** 정규화된 한글 문자열에서 먼저 지우는 정상 단어(오탐 방지). */
const KO_ALLOW = /시발(점|역|택시|자동차)/g;

const KO_BANNED: RegExp[] = [
  /씨+이*[발빨팔]|시발|시팔|쓰발|씨부랄/,
  /ㅅㅂ|ㅆㅂ|ㅅㅃ/,
  /[병븅빙]신|ㅂㅅ|ㅄ/,
  /좆|ㅈ같|ㅈㄹ/,
  /개[새섀색](끼|꺄|캬|키)/,
  /니애미|느금|ㄴㄱㅁ|니기미|니미럴|느개비|느그애미|애미뒤/,
  /존나|존니/,
  /지랄|엠창|염병|썅/,
  /씹(새|년|창|할|쌔)/,
  /(쌍|미친|걸레)년/,
  // 혐오 표현
  /한남충|김치녀|틀딱|짱깨|쪽바리|깜둥이/,
  // 성인·불법 스팸
  /섹스|창녀|야동|몸캠|섹파|조건만남|출장(안마|샵|마사지)/,
  // 불법 도박 스팸 (단독 '토토'는 토토 스킬라치 등 선수명과 겹쳐 제외)
  /바카라|카지노|사설토토|토토사이트|먹튀검증|슬롯사이트|꽁머니/,
];

/** 영어 단어(leet 치환·기호 제거 후) 안에 포함되면 차단. 한글 욕을 영타로 친 것(tlqkf=시발 등) 포함. */
const EN_SUBSTR = /fuck|fck|shit|bitch|nigger|nigga|faggot|whore|slut|porn|casino|baccarat|tlqkf|qudtls|rotorl|ssibal/;
/** 부분 일치하면 오탐이 큰 말(Scunthorpe 등)은 단어 전체 일치만. */
const EN_EXACT = /^(cunts?|fags?|retards?)$/;
/** 도박 사이트 도메인 */
const GAMBLING_URL = /(^|[^a-z])(casino|baccarat|toto|slot|bet)[a-z0-9-]*\.(com|net|org|xyz|io|kr|co|me|top|site|club|vip|live|bet|cc|tv)\b/;

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

// zero-width(U+200B~200F)·word joiner(U+2060)·BOM(U+FEFF)·soft hyphen(U+00AD) — 소스에 원문자를 두지 않으려 코드포인트로 만든다.
const INVISIBLE = new RegExp(`[${String.fromCharCode(0x200b)}-${String.fromCharCode(0x200f)}${String.fromCharCode(0x2060, 0xfeff, 0xad)}]`, 'g');

/** 영어·URL 판정용 — NFKC 로 전각 문자(ｓｈｉｔ)를 반각으로. */
function base(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE, '').toLowerCase();
}

/**
 * 한글 판정용 정규화 — 한글·자모·공백만 남기고, 한 글자 토큰은 다음 토큰에 붙인다.
 * NFC 를 쓴다: NFKC 는 호환 자모(ㅅ U+3131)를 조합형 자모(U+1109)로 바꿔 "ㅅㅂ"을 놓친다.
 */
export function normalizeKorean(text: string): string {
  const cleaned = text.normalize('NFC').replace(INVISIBLE, '').replace(/[^가-힣ㄱ-ㆎ\s]/g, '');
  const out: string[] = [];
  let carry = '';
  for (const t of cleaned.split(/\s+/)) {
    if (!t) continue;
    if (t.length === 1) {
      carry += t;
      continue;
    }
    out.push(carry + t);
    carry = '';
  }
  if (carry) out.push(carry);
  return out.join(' ').replace(KO_ALLOW, '');
}

/** 걸린 규칙(디버그·테스트용)을, 깨끗하면 null. */
export function findBannedTerm(text: string | null | undefined): string | null {
  if (!text) return null;
  const ko = normalizeKorean(text);
  for (const re of KO_BANNED) {
    const m = ko.match(re);
    if (m) return m[0];
  }
  const lower = base(text);
  const url = lower.match(GAMBLING_URL);
  if (url) return url[0].trim();
  for (const raw of lower.split(/\s+/)) {
    if (!raw) continue;
    const word = [...raw].map((ch) => LEET[ch] ?? ch).join('').replace(/[^a-z]/g, '');
    if (!word) continue;
    const m = word.match(EN_SUBSTR);
    if (m) return m[0];
    if (EN_EXACT.test(word)) return word;
  }
  return null;
}

/** 여러 필드 중 하나라도 금칙어가 있으면 true. */
export function containsBannedWords(...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => findBannedTerm(f) !== null);
}
