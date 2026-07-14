import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPlayerBySpid } from "@/lib/nexon/players";
import { getPlayerRankerMeta, type PlayerPositionStat } from "@/lib/nexon/player-meta";
import { getPositionLabel } from "@/lib/nexon/meta";
import SeasonBadge from "@/app/components/SeasonBadge";

export const revalidate = 3600;

function parseSpid(raw: string): number | null {
  if (!/^\d{4,10}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ spid: string }>;
}): Promise<Metadata> {
  const { spid: raw } = await params;
  const spid = parseSpid(raw);
  if (!spid) return { title: "선수" };
  const player = await getPlayerBySpid(spid).catch(() => null);
  const name = player?.name ?? `선수 ${spid}`;
  return {
    title: `${name} — 랭커 사용 데이터`,
    description: `${name}을(를) 상위 랭커가 어느 포지션에서 어떻게 쓰는지 — 평균 평점·득점·패스 성공률 등 실사용 스탯.`,
  };
}

function pct(s: number, t: number): string {
  return t > 0 ? `${Math.round((s / t) * 100)}%` : "–";
}
function per(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ spid: string }>;
}) {
  const { spid: raw } = await params;
  const spid = parseSpid(raw);

  if (!spid) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center">
        <h1 className="text-xl font-bold">잘못된 선수 링크예요</h1>
        <Link href="/meta" className="scoreboard mt-8 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink">
          랭커 픽 랭킹 보기
        </Link>
      </div>
    );
  }

  const [player, meta] = await Promise.all([
    getPlayerBySpid(spid).catch(() => null),
    getPlayerRankerMeta(spid),
  ]);
  const name = player?.name ?? `선수 ${spid}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pb-16">
      {/* 히어로 */}
      <section className="panel relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
        />
        <p className="scoreboard text-[13px] font-bold tracking-[0.2em] text-accent">
          PLAYER
        </p>
        <div className="mt-2 flex items-center gap-4">
          <Image
            src={`/api/player-image/${spid}`}
            alt=""
            width={72}
            height={72}
            unoptimized
            className="h-[72px] w-[72px] flex-none rounded-xl bg-surface-2 object-cover"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
            <div className="mt-1 flex items-center gap-1.5">
              <SeasonBadge spid={spid} season={player?.season} />
              {meta.totalMatches > 0 && (
                <span className="scoreboard text-[13px] text-muted">
                  랭커 경기 {meta.totalMatches.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 보유 시즌 변형 */}
        {player && player.seasons.length > 1 && (
          <div className="mt-4">
            <p className="scoreboard text-[12px] font-semibold tracking-[0.15em] text-muted">
              다른 시즌 카드
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {player.seasons.map((s) => (
                <Link
                  key={s.spid}
                  href={`/player/${s.spid}`}
                  className={`scoreboard flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-bold transition-colors ${
                    s.spid === spid
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-2 text-ink hover:bg-line"
                  }`}
                >
                  <SeasonBadge spid={s.spid} season={s.season} size="xs" />
                  {s.season || `S${Math.floor(s.spid / 1_000_000)}`}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 포지션별 랭커 실사용 스탯 */}
      {meta.positions.length > 0 ? (
        <section className="mt-4 space-y-3">
          <p className="scoreboard text-sm font-bold tracking-[0.2em] text-muted">
            랭커 실사용 스탯 (포지션별)
          </p>
          {meta.positions.map((p) => (
            <PositionCard key={p.position} stat={p} />
          ))}
          <p className="text-[13px] leading-relaxed text-muted">
            상위 랭커가 이 카드를 실제로 쓴 공식경기 평균({meta.date} 스냅샷). 카드
            오버롤·고유 특성은 넥슨 공식 API 미제공이라, 랭커 실사용 기록으로 대신 보여줍니다.
          </p>
        </section>
      ) : (
        <section className="panel mt-4 px-6 py-12 text-center text-sm text-muted">
          <p className="text-base font-semibold text-ink">아직 랭커 사용 데이터가 없어요</p>
          <p className="mt-2">
            이 카드를 쓴 랭커 경기가 쌓이면 포지션별 평균 스탯이 표시됩니다.
          </p>
        </section>
      )}

      {/* CTA */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/squad"
          className="scoreboard rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink"
        >
          스쿼드 빌더에서 배치
        </Link>
        <Link
          href="/meta"
          className="scoreboard rounded-lg bg-surface-2 px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-line"
        >
          랭커 픽 랭킹
        </Link>
      </div>
    </div>
  );
}

function PositionCard({ stat }: { stat: PlayerPositionStat }) {
  return (
    <div className="panel p-4">
      <div className="flex items-baseline justify-between">
        <span className="scoreboard text-base font-bold">
          {getPositionLabel(stat.position)}
        </span>
        <span className="scoreboard flex items-center gap-2 text-[13px] text-muted">
          <span className="rounded bg-gold/15 px-1.5 py-0.5 font-bold text-gold">
            평점 {stat.rating.toFixed(2)}
          </span>
          <span>랭커 {stat.matchCount.toLocaleString()}경기</span>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        {[
          ["경기당 골", per(stat.goal)],
          ["경기당 도움", per(stat.assist)],
          ["유효슛/슛", `${per(stat.effectiveShoot)}/${per(stat.shoot)}`],
          ["패스 성공", pct(stat.passSuccess, stat.passTry)],
          ["드리블 성공", pct(stat.dribbleSuccess, stat.dribbleTry)],
          ["태클·인터셉트", `${per(stat.tackle)}·${per(stat.intercept)}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded bg-surface-2 px-1 py-1.5">
            <dt className="text-[12px] text-muted">{label}</dt>
            <dd className="scoreboard mt-0.5 text-sm font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
