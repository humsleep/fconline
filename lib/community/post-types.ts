/** 커뮤니티 게시판 유형 정의 — 클라이언트/서버 공용(‘server-only’ 아님). */

export type PostType =
  | 'squad_show'
  | 'squad_rate'
  | 'squad_make'
  | 'club_recruit'
  | 'club_match'
  | 'tournament'
  | 'squad_battle';

/** 유형별로 노출/입력하는 필드 키. */
export type PostField =
  | 'region'
  | 'positions'
  | 'contact'
  | 'squad'
  | 'squad_b'
  | 'budget'
  | 'schedule'
  | 'date'
  | 'format'
  | 'entry';

export interface PostTypeConfig {
  label: string;
  emoji: string;
  blurb: string; // 목록/작성에서 유형 설명
  accent: 'lime' | 'gold' | 'ink';
  fields: PostField[];
  bodyLabel: string;
  bodyPlaceholder: string;
  /** "템플릿으로 시작" — 빈 본문에 삽입되는 유형별 글 틀 */
  template: string;
}

export const POST_TYPE_ORDER: PostType[] = [
  'squad_show',
  'squad_rate',
  'squad_battle',
  'squad_make',
  'club_recruit',
  'club_match',
  'tournament',
];

export const POST_TYPES: Record<PostType, PostTypeConfig> = {
  squad_show: {
    label: '스쿼드 자랑',
    emoji: '✨',
    blurb: '내가 만든 스쿼드를 공유하고 자랑해요.',
    accent: 'gold',
    fields: ['squad'],
    bodyLabel: '소개',
    bodyPlaceholder: '스쿼드 컨셉, 핵심 카드, 전술 등을 자유롭게 적어주세요.',
    template:
      '⚽ 포메이션:\n🌟 핵심 카드:\n🧠 운영 컨셉:\n💬 한마디:',
  },
  squad_rate: {
    label: '스쿼드 평가 요청',
    emoji: '📝',
    blurb: '내 스쿼드, 어떤가요? 피드백을 받아보세요.',
    accent: 'lime',
    fields: ['squad', 'budget'],
    bodyLabel: '요청 내용',
    bodyPlaceholder: '고민되는 포지션, 예산, 목표 등급 등을 적으면 조언받기 좋아요.',
    template:
      '🎯 현재 등급:\n⚽ 포메이션:\n😥 고민 포지션:\n💰 예산:\n🙏 이런 조언 부탁해요:',
  },
  squad_make: {
    label: '스쿼드 만들어줘',
    emoji: '🛠️',
    blurb: '조건을 알려주면 다른 유저가 스쿼드를 제안해줘요.',
    accent: 'ink',
    fields: ['budget'],
    bodyLabel: '원하는 조건',
    bodyPlaceholder: '예산, 선호 포메이션, 좋아하는 리그·선수 등을 적어주세요.',
    template:
      '💰 예산:\n⚽ 선호 포메이션:\n❤️ 좋아하는 리그/선수:\n🎯 목표 등급:\n📌 기타 조건:',
  },
  club_recruit: {
    label: '클럽원 모집',
    emoji: '🛡️',
    blurb: '같이 뛸 클럽원을 찾아요.',
    accent: 'lime',
    fields: ['region', 'positions', 'contact'],
    bodyLabel: '모집 내용',
    bodyPlaceholder: '활동 시간대, 클럽 분위기, 지원 방법 등을 적어주세요.',
    template:
      '🛡️ 클럽 이름:\n⏰ 주 활동 시간대:\n🎯 클럽 성향(빡겜/즐겜):\n✅ 이런 분 환영:\n📩 지원 방법:',
  },
  club_match: {
    label: '클럽전 상대 구함',
    emoji: '⚔️',
    blurb: '클럽 친선전·연습경기 상대를 구해요.',
    accent: 'ink',
    fields: ['region', 'schedule', 'contact'],
    bodyLabel: '매치 내용',
    bodyPlaceholder: '우리 클럽 수준, 원하는 형식(정규/캐주얼), 가능 시간 등을 적어주세요.',
    template:
      '🛡️ 우리 클럽:\n📊 평균 등급대:\n⏰ 가능 시간:\n⚔️ 원하는 형식(단판/홈앤어웨이):\n📩 연락 방법:',
  },
  tournament: {
    label: '대회',
    emoji: '🏆',
    blurb: '유저 대회를 열거나 참가자를 모집해요.',
    accent: 'gold',
    fields: ['date', 'format', 'entry', 'contact'],
    bodyLabel: '대회 안내',
    bodyPlaceholder: '대회 규칙, 상품(명예/뱃지), 진행 방식, 참가 신청 방법 등을 적어주세요.',
    template:
      '🏆 대회 이름:\n📅 일정:\n👥 모집 인원:\n📋 진행 방식:\n🎁 보상(명예/뱃지):\n📩 참가 신청:',
  },
  squad_battle: {
    label: '스쿼드 배틀',
    emoji: '⚔️',
    blurb: '두 스쿼드를 올리고 어느 쪽이 나은지 투표받아요.',
    accent: 'gold',
    fields: ['squad', 'squad_b'],
    bodyLabel: '배틀 설명',
    bodyPlaceholder: 'A vs B — 어떤 점을 비교하고 싶은지, 각 스쿼드 컨셉을 적어주세요.',
    template: '🅰️ A팀 컨셉:\n🅱️ B팀 컨셉:\n🤔 고민 포인트:',
  },
};

export function isPostType(v: string): v is PostType {
  // `in` 은 프로토타입 체인까지 봐서 ?type=constructor 크래시 가능 — 자기 속성만
  return Object.hasOwn(POST_TYPES, v);
}

// meta jsonb에 담기는 유형별 자유 텍스트 필드
export const META_FIELD_LABELS: Record<string, string> = {
  budget: '예산',
  schedule: '가능 시간',
  date: '일정',
  format: '형식',
  entry: '참가 방법',
};

export const TITLE_MAX = 60;
export const BODY_MAX = 2000;
export const META_MAX = 120;
