import { NONPAY_KIND_LABELS, type NonBenefitItem } from "@/lib/dataGoKrDetail";

const NONPAY_KIND_ICONS: Record<string, string> = {
  "1": "🍚",
  "2": "🛏️",
  "3": "✂️",
  "4": "💧",
  "5": "🍪",
  "6": "🛏️",
  "7": "📋",
};

function formatDate(uptDt?: string) {
  if (!uptDt || uptDt.length !== 8) return null;
  return `${uptDt.slice(0, 4)}. ${uptDt.slice(4, 6)}. ${uptDt.slice(6, 8)}`;
}

export default function NonBenefitGrid({ items }: { items: NonBenefitItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item, i) => {
        const daily = Number(item.nonpayTgtAmt ?? 0);
        const monthly = daily * 30;
        const label = NONPAY_KIND_LABELS[item.nonpayKind ?? ""] ?? "기타 비급여";
        const icon = NONPAY_KIND_ICONS[item.nonpayKind ?? ""] ?? "📋";
        const registeredAt = formatDate(item.uptDt);

        return (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-base">
                {icon}
              </span>
              <span className="font-semibold text-zinc-900">{label}</span>
            </div>

            <div className="mt-4 text-right">
              <p className="text-lg font-bold text-zinc-900">월 {monthly.toLocaleString()}원</p>
              <p className="mt-0.5 text-sm text-zinc-400">1일 {daily.toLocaleString()}원</p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-400">
              <span>{registeredAt ? `등록일 ${registeredAt}` : "등록일 정보 없음"}</span>
              <span>{item.prodBase}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
