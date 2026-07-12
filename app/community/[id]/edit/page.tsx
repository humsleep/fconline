'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/lib/supabase/useUser';
import MySquadPicker from '@/app/components/MySquadPicker';
import {
  POST_TYPES,
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

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, loading } = useUser();
  const router = useRouter();

  const [type, setType] = useState<PostType | null>(null);
  const [notMine, setNotMine] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [region, setRegion] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [contact, setContact] = useState('');
  const [squadId, setSquadId] = useState('');
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = type ? POST_TYPES[type] : null;
  const fieldSet = useMemo(
    () => new Set<PostField>(cfg?.fields ?? []),
    [cfg]
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/community/${id}/edit`)}`);
      return;
    }
    fetch(`/api/community/posts/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ post }) => {
        if (post.author_id !== user.id) {
          setNotMine(true);
          return;
        }
        if (isPostType(post.type)) setType(post.type);
        setTitle(post.title ?? '');
        setBody(post.body ?? '');
        setRegion(post.region ?? '');
        setPositions(post.positions ?? []);
        setContact(post.contact ?? '');
        setSquadId(post.squad_id ?? '');
        setMeta(post.meta ?? {});
      })
      .catch(() => setNotMine(true));
  }, [user, loading, router, id]);

  const togglePos = (p: string) =>
    setPositions((cur) =>
      cur.includes(p)
        ? cur.filter((x) => x !== p)
        : cur.length < 6
          ? [...cur, p]
          : cur
    );

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 입력하세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const metaPayload: Record<string, string> = {};
    for (const k of META_KEYS)
      if (fieldSet.has(k) && meta[k]?.trim()) metaPayload[k] = meta[k].trim();
    try {
      const res = await fetch(`/api/community/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edit: true,
          title: title.trim(),
          body: body.trim(),
          region: fieldSet.has('region') ? region || null : null,
          positions: fieldSet.has('positions') ? positions : [],
          contact: fieldSet.has('contact') ? contact.trim() || null : null,
          squad_id: fieldSet.has('squad') ? squadId.trim() || null : null,
          ...metaPayload,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? '수정 실패');
      router.push(`/community/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
      setSubmitting(false);
    }
  };

  if (loading || (!type && !notMine))
    return <div className="p-12 text-center text-muted">불러오는 중…</div>;
  if (notMine || !cfg)
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm text-muted">본인이 쓴 글만 수정할 수 있어요.</p>
        <Link
          href={`/community/${id}`}
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          글로 돌아가기
        </Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold">글 수정</h1>
      <p className="mt-1 text-sm text-muted">
        {cfg.emoji} {cfg.label} · 유형은 변경할 수 없어요.
      </p>

      <div className="mt-5 space-y-5">
        <Field label={`제목 (${title.length}/${TITLE_MAX})`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        {fieldSet.has('squad') && (
          <Field label="스쿼드 첨부 (선택)">
            <MySquadPicker value={squadId} onChange={setSquadId} />
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
              onChange={(e) =>
                setMeta((m) => ({ ...m, [k]: e.target.value.slice(0, META_MAX) }))
              }
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
        ))}

        <Field label={`${cfg.bodyLabel} (${body.length}/${BODY_MAX})`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            rows={6}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        {fieldSet.has('contact') && (
          <Field label="연락 수단 (선택)">
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value.slice(0, META_MAX))}
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
            {submitting ? '저장 중…' : '수정 완료'}
          </button>
          <Link
            href={`/community/${id}`}
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface-2"
          >
            취소
          </Link>
        </div>
      </div>
    </div>
  );
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
