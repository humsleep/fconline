'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'fcscope-my-squads';
export const MAX_MY_SQUADS = 10; // 개인당 최대 스쿼드 등록 개수
const MAX = MAX_MY_SQUADS;

export interface MySquad {
  id: string;
  name: string;
  formation: string;
  at: number;
}

function loadMySquads(): MySquad[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((s) => s && typeof s.id === 'string').slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

/** 이 기기에 저장된 내 스쿼드 개수 (10개 제한 체크용). SSR에서는 0. */
export function countMySquads(): number {
  if (typeof window === 'undefined') return 0;
  return loadMySquads().length;
}

/** 스쿼드 저장 성공 시 호출 — "내가 만든 스쿼드" 목록(localStorage)에 기록 */
export function rememberMySquad(s: Omit<MySquad, 'at'>) {
  try {
    const next = [
      { ...s, at: Date.now() },
      ...loadMySquads().filter((x) => x.id !== s.id),
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage 불가 환경 무시
  }
}

/**
 * 스쿼드 첨부 피커 — 내가 저장한 스쿼드를 선택(공유코드 복붙 제거).
 * 목록이 없거나 다른 기기라면 수동 코드 입력으로 폴백.
 */
export default function MySquadPicker({
  value,
  onChange,
  placeholder = '스쿼드 공유코드',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [mine, setMine] = useState<MySquad[]>([]);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const list = loadMySquads();
    setMine(list);
    if (list.length === 0) setManual(true);
  }, []);

  if (manual || mine.length === 0) {
    return (
      <div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.trim().slice(0, 32))}
          placeholder={placeholder}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <p className="mt-1 text-[13px] text-muted">
          <Link href="/squad" className="text-accent underline underline-offset-2">
            스쿼드 빌더
          </Link>
          에서 저장하면 여기서 바로 고를 수 있어요.
          {mine.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange(''); // 모드 전환 시 값 초기화 (목록에 없는 코드 잔존 방지)
                setManual(false);
              }}
              className="ml-2 text-accent underline underline-offset-2"
            >
              내 스쿼드에서 고르기
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">첨부 안 함</option>
        {mine.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.formation})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          onChange('');
          setManual(true);
        }}
        className="mt-1 text-[13px] text-muted underline underline-offset-2"
      >
        공유코드 직접 입력
      </button>
    </div>
  );
}
