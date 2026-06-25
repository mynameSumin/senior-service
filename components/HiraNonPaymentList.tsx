import type { HiraNonPaymentItem } from "@/lib/hiraNonPayment";

export default function HiraNonPaymentList({ items }: { items: HiraNonPaymentItem[] }) {
  const sorted = [...items].sort((a, b) => Number(b.curAmt ?? 0) - Number(a.curAmt ?? 0));

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <ul className="divide-y divide-zinc-100">
        {sorted.map((item, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">{item.npayKorNm}</p>
              {item.yadmNpayCdNm && item.yadmNpayCdNm !== item.npayKorNm && (
                <p className="text-xs text-zinc-400">{item.yadmNpayCdNm}</p>
              )}
            </div>
            <p className="shrink-0 text-sm font-semibold text-zinc-900">
              {Number(item.curAmt ?? 0).toLocaleString()}원
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
