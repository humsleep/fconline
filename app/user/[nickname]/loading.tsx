export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
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
    </div>
  );
}
