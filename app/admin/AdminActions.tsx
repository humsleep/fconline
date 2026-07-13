'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ModerateButtons({
  targetType,
  targetId,
  hidden,
}: {
  targetType: 'post' | 'comment';
  targetId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const act = async (action: 'hide' | 'unhide' | 'delete') => {
    if (action === 'delete' && !window.confirm('대상을 완전히 삭제할까요?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-none gap-1.5">
      <button
        onClick={() => act(hidden ? 'unhide' : 'hide')}
        disabled={busy}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-semibold hover:bg-surface-2 disabled:opacity-50"
      >
        {hidden ? '해제' : '숨김'}
      </button>
      <button
        onClick={() => act('delete')}
        disabled={busy}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-semibold text-lose hover:bg-surface-2 disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  );
}

interface SeedResult {
  results: { nickname: string; ok: boolean; matches: number; note?: string }[];
  combos: number;
  warmed: number;
  hint: string;
}

export function SeedForm() {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nicknames = [...new Set(raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];

  const run = async () => {
    if (nicknames.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicknames: nicknames.slice(0, 5) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '실패');
      setResult(d as SeedResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-[13px] text-muted">
        활동 중인 구단주명을 줄바꿈/쉼표로 최대 5개 입력 → 최근 공식경기 30판씩 수집(match_cache) +
        자주 쓰인 선수 조합의 랭커 스탯 워밍까지 한 번에 처리해요. 사이트에서 하나씩 검색할 필요 없음.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value.slice(0, 300))}
        placeholder={'닉네임1\n닉네임2\n닉네임3'}
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[13px] text-muted">
          {nicknames.length > 5 ? '앞의 5개만 실행됩니다' : `${nicknames.length}개 입력됨`}
        </span>
        <button
          onClick={run}
          disabled={busy || nicknames.length === 0}
          className="ml-auto flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? '수집 중… (최대 수 분)' : '시딩 실행'}
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-lose">{error}</p>}
      {result && (
        <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
          <ul className="space-y-1">
            {result.results.map((r) => (
              <li key={r.nickname} className="flex items-center gap-2">
                <span className={r.ok ? 'text-win' : 'text-lose'}>{r.ok ? '✓' : '✗'}</span>
                <span className="min-w-0 flex-1 truncate">{r.nickname}</span>
                <span className="flex-none text-[13px] text-muted">
                  {r.ok ? `경기 ${r.matches}건` : r.note}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-muted">
            조합 {result.combos}개 중 랭커 스탯 {result.warmed}건 워밍 — {result.hint}
          </p>
        </div>
      )}
    </div>
  );
}

export function PauseToggle({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(paused);

  const toggle = async () => {
    if (busy) return;
    const next = !state;
    if (next && !window.confirm('넥슨 전적/랭커/라이브 조회를 모두 일시 중단할까요?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/service-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'nexon_paused', enabled: next }),
      });
      if (res.ok) {
        setState(next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          넥슨 조회 {state ? '중단됨' : '정상'}
          <span
            className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${
              state ? 'bg-lose' : 'bg-win'
            }`}
          />
        </p>
        <p className="mt-0.5 text-[13px] text-muted">
          {state
            ? '전적·랭커·라이브 조회가 막혀 있어요. 사용자에겐 "잠시 멈췄어요" 안내가 표시됩니다.'
            : '넥슨 한도 소진·장애 시 이 스위치로 팬아웃을 즉시 멈출 수 있어요(최대 30초 내 전 서버 반영).'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`flex-none rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
          state
            ? 'bg-win/15 text-win hover:bg-win/25'
            : 'bg-lose/15 text-lose hover:bg-lose/25'
        }`}
      >
        {state ? '다시 열기' : '조회 중단'}
      </button>
    </div>
  );
}

export function NoticeForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const publish = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), link: link.trim() || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '실패');
      setText('');
      setLink('');
      setMsg('공지를 게시했어요.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '실패');
    } finally {
      setBusy(false);
    }
  };

  const takeDown = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/notice', { method: 'DELETE' });
      if (res.ok) {
        setMsg('공지를 내렸어요.');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {current && (
        <div className="flex items-center gap-2 rounded-lg bg-gold/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">📢 {current}</span>
          <button
            onClick={takeDown}
            disabled={busy}
            className="flex-none text-[13px] font-semibold text-lose"
          >
            내리기
          </button>
        </div>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 200))}
        placeholder="새 공지 내용 (게시 시 기존 공지는 자동 교체)"
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value.slice(0, 120))}
          placeholder="링크(선택, /community 처럼 내부 경로)"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={publish}
          disabled={busy || !text.trim()}
          className="flex-none rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          게시
        </button>
      </div>
      {msg && <p className="mt-2 text-[13px] text-accent">{msg}</p>}
    </div>
  );
}
