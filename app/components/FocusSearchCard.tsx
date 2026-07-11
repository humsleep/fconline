"use client";

/** 홈 히어로 검색 입력으로 스크롤+포커스하는 카드/버튼 래퍼 (죽은 카드 방지) */
export function focusHeroSearch() {
  const el = document.getElementById("hero-search") as HTMLInputElement | null;
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
  return true;
}

export default function FocusSearchCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={focusHeroSearch} className={`${className ?? ""} text-left`}>
      {children}
    </button>
  );
}
