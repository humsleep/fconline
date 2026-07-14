'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/lib/supabase/useUser';
import MySquadPicker from '@/app/components/MySquadPicker';
import {
  POST_TYPES,
  POST_TYPE_ORDER,
  isPostType,
  META_FIELD_LABELS,
  TITLE_MAX,
  BODY_MAX,
  META_MAX,
  type PostType,
  type PostField,
} from '@/lib/community/post-types';
import { REGIONS, POSITION_OPTIONS } from '@/lib/community/constants';

const META_KEYS: PostField[] = ['budget', 'schedule', 'date', 'format', 'entry'];

function NewPostForm() {
  const { user, loading, configured } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialType: PostType = (() => {
    const t = searchParams.get('type');
    return t && isPostType(t) ? t : 'squad_show';
  })();

  const [type, setType] = useState<PostType>(initialType);
  const [hasNickname, setHasNickname] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [region, setRegion] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [contact, setContact] = useState('');
  const [squadId, setSquadId] = useState('');
  const [squadIdB, setSquadIdB] = useState('');
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = POST_TYPES[type];
  const fieldSet = useMemo(() => new Set<PostField>(cfg.fields), [cfg]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // 선택한 유형(type)을 로그인 후에도 유지
      router.replace(
        `/login?next=${encodeURIComponent(`/community/new?type=${initialType}`)}`
      );
      return;
    }
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : { profile: null }))
      .then((d) => setHasNickname(Boolean(d.profile?.nickname)))
      .catch(() => setHasNickname(false));
  }, [user, loading, router, initialType]);

  const togglePos = (p: string) =>
    setPositions((cur) =>
      cur.includes(p)
        ? cur.filter((x) => x !== p)
        : cur.length < 6
          ? [...cur, p]
          : cur
    );

  const setMetaField = (k: string, v: string) =>
    setMeta((m) => ({ ...m, [k]: v }));

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 입력하세요.');
      return;
    }
    if (type === 'squad_battle' && (!squadId.trim() || !squadIdB.trim())) {
      setError('스쿼드 배틀은 A·B 두 스쿼드를 모두 첨부해야 해요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const metaPayload: Record<string, string> = {};
    for (const k of META_KEYS)
      if (fieldSet.has(k) && meta[k]?.trim()) metaPayload[k] = meta[k].trim();

    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          body: body.trim(),
          region: fieldSet.has('region') ? region || null : null,
          positions: fieldSet.has('positions') ? positions : [],
          contact: fieldSet.has('contact') ? contact.trim() || null : null,
          squad_id: fieldSet.has('squad') ? squadId.trim() || null : null,
          squad_b: fieldSet.has('squad_b') ? squadIdB.trim() || null : null,
          ...metaPayload,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '등록 실패');
      if (!d.id) throw new Error('등록됐지만 이동 실패. 목록에서 확인하세요.');
      router.push(`/community/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
      setSubmitting(false);
    }
  };

  if (loading || hasNickname === null)
    return <div className="p-12 text-center text-muted">불러오는 중…</div>;
  if (!configured)
    return (
      <div className="mx-auto max-w-md p-12 text-center text-muted">
        로그인 준비 중이에요. 잠시 후 다시 시도해 주세요.
      </div>
    );
  if (!hasNickname)
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm text-muted">
          글을 쓰려면 커뮤니티 닉네임이 필요합니다.
        </p>
        <Link
          href="/profile/setup"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          닉네임 등록하기
        </Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold">글쓰기</h1>

      {/* 유형 선택 */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {POST_TYPE_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={
              'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
              (type === t
                ? 'bg-accent text-accent-ink'
                : 'bg-surface-2 text-muted hover:text-ink')
            }
          >
            {POST_TYPES[t].emoji} {POST_TYPES[t].label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{cfg.blurb}</p>

      <div className="mt-5 space-y-5">
        <Field label={`제목 (${title.length}/${TITLE_MAX})`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="제목을 입력하세요"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        {fieldSet.has('squad') && (
          <Field
            label={
              fieldSet.has('squad_b') ? 'A팀 스쿼드' : '스쿼드 첨부 (선택)'
            }
          >
            <MySquadPicker value={squadId} onChange={setSquadId} />
          </Field>
        )}

        {fieldSet.has('squad_b') && (
          <Field label="B팀 스쿼드">
            <MySquadPicker
              value={squadIdB}
              onChange={setSquadIdB}
              placeholder="B팀 스쿼드 공유코드"
            />
          </Field>
        )}

        {fieldSet.has('region') && (
          <Field label="지역">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">선택 안 함</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        )}

        {fieldSet.has('positions') && (
          <Field label={`모집 포지션 (${positions.length}/6)`}>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePos(p)}
                  className={
                    'scoreboard rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ' +
                    (positions.includes(p)
                      ? 'bg-accent text-accent-ink'
                      : 'bg-surface-2 text-muted hover:text-ink')
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
        )}

        {META_KEYS.filter((k) => fieldSet.has(k)).map((k) => (
          <Field key={k} label={`${META_FIELD_LABELS[k]} (선택)`}>
            <input
              value={meta[k] ?? ''}
              onChange={(e) => setMetaField(k, e.target.value.slice(0, META_MAX))}
              placeholder={metaPlaceholder(k)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
        ))}

        <Field label={`${cfg.bodyLabel} (${body.length}/${BODY_MAX})`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            rows={6}
            placeholder={cfg.bodyPlaceholder}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {!body.trim() && (
            <button
              type="button"
              onClick={() => setBody(cfg.template)}
              className="mt-1 text-[13px] text-accent underline underline-offset-2"
            >
              📋 템플릿으로 시작하기
            </button>
          )}
        </Field>

        {fieldSet.has('contact') && (
          <Field label="연락 수단 (선택)">
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value.slice(0, META_MAX))}
              placeholder="오픈채팅 링크, 디스코드 등"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
        )}

        {error && <p className="text-sm text-lose">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {submitting ? '등록 중…' : '등록'}
          </button>
          <Link
            href="/community"
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface-2"
          >
            취소
          </Link>
        </div>
      </div>
    </div>
  );
}

function metaPlaceholder(k: string): string {
  switch (k) {
    case 'budget':
      return '예) 500억, 상관없음';
    case 'schedule':
      return '예) 평일 저녁 9시 이후';
    case 'date':
      return '예) 7/20(토) 오후 8시';
    case 'format':
      return '예) 8강 토너먼트, 단판';
    case 'entry':
      return '예) 디스코드 신청, 선착순 16명';
    default:
      return '';
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function NewPostPage() {
  return (
    <Suspense
      fallback={<div className="p-12 text-center text-muted">불러오는 중…</div>}
    >
      <NewPostForm />
    </Suspense>
  );
}
