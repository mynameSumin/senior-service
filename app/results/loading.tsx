import Spinner from "@/components/Spinner";

export default function Loading() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
      <div className="mt-3 flex items-center gap-2">
        <Spinner size={20} />
        <span className="text-sm text-zinc-500">맞는 시설을 찾고 있어요…</span>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-200" />
                <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-purple-100" />
            </div>
            <div className="mt-3 h-3 w-56 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    </main>
  );
}
