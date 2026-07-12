// 페이지 전환 즉시 피드백 — 스켈레톤
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="skeleton h-8 w-40" />
      <div className="mt-2 skeleton h-4 w-64" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
