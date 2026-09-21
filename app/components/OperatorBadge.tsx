/** 운영자 계정(ADMIN_EMAILS)이 쓴 글·댓글 옆 배지 — 제목에 "[운영자]"를 적는 대신 작성자에 붙인다. */
export default function OperatorBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-gold/15 px-1.5 py-0.5 text-[11px] font-bold leading-none text-gold ${className}`}
      title="FC Scope 운영자"
    >
      운영자
    </span>
  );
}
