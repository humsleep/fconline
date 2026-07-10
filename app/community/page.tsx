import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '커뮤니티',
  description: 'FC온라인 클럽 모집·유저 대회·교류전 커뮤니티.',
};

const MENUS = [
  {
    href: '/community/clubs',
    emoji: '🛡️',
    title: '클럽 모집',
    desc: '같이 뛸 클럽원을 찾아요. 구단주명 연동 시 전적 카드가 자동으로 붙습니다.',
    ready: true,
  },
  {
    href: '#',
    emoji: '🏆',
    title: '유저 대회',
    desc: '유저가 여는 대회. 매치 API로 대진 결과를 자동 검증합니다.',
    ready: false,
  },
  {
    href: '#',
    emoji: '🤝',
    title: '클럽 교류전',
    desc: '클럽 간 친선 매치. 멤버별 결과 집계 + 팀 스코어.',
    ready: false,
  },
];

export default function CommunityHub() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">커뮤니티</h1>
      <p className="mt-1 text-sm text-muted">
        데이터로 노는 FC온라인 커뮤니티. 클럽을 모으고, 곧 대회도 열 수 있어요.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {MENUS.map((m) =>
          m.ready ? (
            <Link
              key={m.title}
              href={m.href}
              className="panel group flex flex-col p-5 transition hover:border-accent"
            >
              <span className="text-3xl">{m.emoji}</span>
              <span className="mt-3 text-lg font-bold group-hover:text-accent">
                {m.title}
              </span>
              <span className="mt-1 text-[13px] leading-relaxed text-muted">
                {m.desc}
              </span>
            </Link>
          ) : (
            <div
              key={m.title}
              className="panel flex flex-col p-5 opacity-70"
              aria-disabled
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{m.emoji}</span>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-muted">
                  준비 중
                </span>
              </div>
              <span className="mt-3 text-lg font-bold">{m.title}</span>
              <span className="mt-1 text-[13px] leading-relaxed text-muted">
                {m.desc}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
