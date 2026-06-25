"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Spinner from "./Spinner";

export default function ReviewFilterToggle({ href, active }: { href: string; active: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.push(href))}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-wait ${
        active
          ? "border-purple-600 bg-purple-600 text-white"
          : "border-zinc-300 text-zinc-600 hover:border-purple-300 hover:text-purple-700"
      }`}
    >
      {isPending ? (
        <Spinner size={12} className={active ? "text-white" : "text-purple-600"} />
      ) : (
        <span>✓</span>
      )}
      이용자 후기 있는 시설만
    </button>
  );
}
