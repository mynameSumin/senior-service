import { NURSING_HOME_FEE_2026 } from "@/lib/feeSchedule";

export default function FeeGuide() {
  return (
    <section className="mt-6 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
      <h2 className="text-sm font-semibold text-zinc-800">
        요양원 급여비용 안내{" "}
        <span className="text-xs font-normal text-zinc-400">(2026년 고시 기준, 월 30일)</span>
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        본인부담금은 시설이 아니라 입소자의 장기요양등급에 따라 전국 동일하게 책정됩니다 — 시설을
        골라서 줄일 수 있는 비용이 아니라는 뜻이에요. 아래는 일반(20%) 부담 기준이며, 저소득 감경
        대상이면 더 낮아집니다.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {NURSING_HOME_FEE_2026.map((tier) => (
          <div key={tier.grade} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-xs text-zinc-500">{tier.grade}</p>
            <p className="text-sm font-bold text-zinc-900">
              월 {tier.copay.general.toLocaleString()}원
            </p>
            <p className="text-xs text-zinc-400">
              식사재료비 포함 월 {tier.copayWithMeal.general.toLocaleString()}원
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
