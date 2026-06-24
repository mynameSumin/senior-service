import Link from "next/link";
import RiskBadge from "./RiskBadge";

interface Props {
  id: string;
  name: string;
  type: string;
  address: string | null;
  capacityTotal: number | null;
  capacityCurrent: number | null;
  latestGrade?: string | null;
  riskScore?: number | null;
}

export default function FacilityCard({
  id,
  name,
  type,
  address,
  capacityTotal,
  capacityCurrent,
  latestGrade,
  riskScore,
}: Props) {
  return (
    <Link
      href={`/facility/${id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-purple-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{type}</p>
          <h3 className="text-lg font-semibold text-zinc-900">{name}</h3>
        </div>
        {riskScore != null && <RiskBadge score={riskScore} />}
      </div>
      <p className="mt-2 text-sm text-zinc-600">{address ?? "주소 정보 없음"}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
        {latestGrade && <span>평가등급 {latestGrade}</span>}
        {capacityTotal != null && (
          <span>
            정원 {capacityTotal}명{capacityCurrent != null ? ` · 현원 ${capacityCurrent}명` : ""}
          </span>
        )}
      </div>
    </Link>
  );
}
