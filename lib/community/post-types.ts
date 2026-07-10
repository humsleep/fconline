/** 커뮤니티 게시판 유형 정의 — 클라이언트/서버 공용(‘server-only’ 아님). */

export type PostType =
  | 'squad_show'
  | 'squad_rate'
  | 'squad_make'
  | 'club_recruit'
  | 'club_match'
  | 'tournament';

/** 유형별로 노출/입력하는 필드 키. */
export type PostField =
  | 'region'
  | 'positions'
  | 'contact'
  | 'squad'
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
}

export const POST_TYPE_ORDER: PostType[] = [
  'squad_show',
  'squad_rate',
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
  },
  squad_rate: {
    label: '스쿼드 평가 요청',
    emoji: '📝',
    blurb: '내 스쿼드, 어떤가요? 피드백을 받아보세요.',
    accent: 'lime',
    fields: ['squad', 'budget'],
    bodyLabel: '요청 내용',
    bodyPlaceholder: '고민되는 포지션, 예산, 목표 등급 등을 적으면 조언받기 좋아요.',
  },
  squad_make: {
    label: '스쿼드 만들어줘',
    emoji: '🛠️',
    blurb: '조건을 알려주면 다른 유저가 스쿼드를 제안해줘요.',
    accent: 'ink',
    fields: ['budget'],
    bodyLabel: '원하는 조건',
    bodyPlaceholder: '예산, 선호 포메이션, 좋아하는 리그·선수 등을 적어주세요.',
  },
  club_recruit: {
    label: '클럽원 모집',
    emoji: '🛡️',
    blurb: '같이 뛸 클럽원을 찾아요.',
    accent: 'lime',
    fields: ['region', 'positions', 'contact'],
    bodyLabel: '모집 내용',
    bodyPlaceholder: '활동 시간대, 클럽 분위기, 지원 방법 등을 적어주세요.',
  },
  club_match: {
    label: '클럽전 상대 구함',
    emoji: '⚔️',
    blurb: '클럽 친선전·연습경기 상대를 구해요.',
    accent: 'ink',
    fields: ['region', 'schedule', 'contact'],
    bodyLabel: '매치 내용',
    bodyPlaceholder: '우리 클럽 수준, 원하는 형식(정규/캐주얼), 가능 시간 등을 적어주세요.',
  },
  tournament: {
    label: '대회',
    emoji: '🏆',
    blurb: '유저 대회를 열거나 참가자를 모집해요.',
    accent: 'gold',
    fields: ['date', 'format', 'entry', 'contact'],
    bodyLabel: '대회 안내',
    bodyPlaceholder: '대회 규칙, 상품(명예/뱃지), 진행 방식, 참가 신청 방법 등을 적어주세요.',
  },
};

export function isPostType(v: string): v is PostType {
  return v in POST_TYPES;
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
