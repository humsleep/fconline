# FC Online Lab

FC온라인 유저를 위한 데이터 도구 + 커뮤니티. 기존 서비스(조회·나열형)와 달리 **진단·자동화·검증**에 집중합니다.

- **스쿼드 클리닉** — AI 스쿼드 평가 + 예산 스쿼드 생성
- **VS 판독기** — 선수 비교 논쟁을 랭커 실사용 데이터로 판정
- **현실 라인업 스쿼드** — 실제 팀 최신 선발 11명 → FC온라인 카드 스쿼드
- **커뮤니티** — 클럽 모집 / 유저 대회(API 자동 검증) / 클럽 교류전

## 문서

| 문서 | 내용 |
|---|---|
| [docs/ROADMAP.md](docs/ROADMAP.md) | 전체 기획, 사이트맵, 단계별 로드맵, 리서치 요약 |
| [docs/NEXON-API.md](docs/NEXON-API.md) | 넥슨 오픈API FC온라인 전체 레퍼런스 |
| [docs/DB-SCHEMA.md](docs/DB-SCHEMA.md) | Supabase 스키마 초안 |
| [AGENTS.md](AGENTS.md) | 개발 원칙·컨벤션 (AI 에이전트용) |

## 개발

```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev
```

빌드 검증: `npm run build`

## 스택

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Supabase · Anthropic Claude · Vercel
