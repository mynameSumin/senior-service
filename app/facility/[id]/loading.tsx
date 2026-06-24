import Spinner from "@/components/Spinner";

export default function Loading() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />

      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
          <div className="h-7 w-56 animate-pulse rounded bg-zinc-200" />
          <div className="h-3 w-72 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-purple-100" />
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
        <Spinner size={20} />
        공공데이터 실시간 조회 중…
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </main>
  );
}
