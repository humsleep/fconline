export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8" aria-label="전적 불러오는 중">
      <div className="skeleton h-10 w-48" />
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="skeleton h-[74px]" />
        <div className="skeleton hidden h-[74px] sm:block" />
        <div className="skeleton hidden h-[74px] sm:block" />
      </div>
      <div className="mt-8 flex gap-1.5">
        <div className="skeleton h-8 w-20" />
        <div className="skeleton h-8 w-20" />
        <div className="skeleton h-8 w-24" />
      </div>
      <div className="mt-4 space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[62px]" />
        ))}
      </div>
      {/* 콜드 조회(getOuid+basic)는 몇 초 걸릴 수 있음 — 텍스트 없는 스켈레톤이
          '멈춤'처럼 보이지 않도록 대기 사유를 여기(느린 구간 동안)에 명시. */}
      <p className="pt-4 text-center text-xs text-muted">
        넥슨 서버에서 전적을 불러오는 중… 첫 조회는 몇 초 걸릴 수 있어요.
      </p>
    </div>
  );
}
