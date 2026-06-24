function riskTier(score: number) {
  if (score >= 60) return { label: "위험", className: "bg-red-100 text-red-700 border-red-300" };
  if (score >= 30)
    return { label: "주의", className: "bg-amber-100 text-amber-700 border-amber-300" };
  return { label: "안전", className: "bg-emerald-100 text-emerald-700 border-emerald-300" };
}

export default function RiskBadge({ score }: { score: number }) {
  const tier = riskTier(score);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tier.className}`}
    >
      {tier.label} · {Math.round(score)}점
    </span>
  );
}
