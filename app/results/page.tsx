import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { matchFacilityType, type Cognition, type MedicalNeed, type Mobility } from "@/lib/matching";
import FacilityCard from "@/components/FacilityCard";
import FeeGuide from "@/components/FeeGuide";
import RiskScoreInfo from "@/components/RiskScoreInfo";

interface SearchParams {
  mobility?: string;
  cognition?: string;
  medicalNeed?: string;
  region?: string;
  hasReviews?: string;
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const mobility = (sp.mobility ?? "partial") as Mobility;
  const cognition = (sp.cognition ?? "normal") as Cognition;
  const medicalNeed = (sp.medicalNeed ?? "low") as MedicalNeed;
  const region = sp.region;
  const hasReviewsOnly = sp.hasReviews === "1";

  const match = matchFacilityType({ mobility, cognition, medicalNeed, region });

  // hasReviews=1일 때만 reviews를 !inner로 묶어 후기가 1건도 없는 시설은 DB 단계에서 제외한다.
  // (먼저 60건으로 잘라낸 뒤 후기 유무로 거르면 대부분 0건처럼 보이는 문제를 피하기 위함)
  const reviewsField = hasReviewsOnly ? "reviews!inner(id)" : "reviews(id)";
  let query = supabase
    .from("facilities")
    .select(
      `id, name, type, address, region_sido, capacity_total, capacity_current, evaluations(eval_year, grade), risk_scores(score), ${reviewsField}`
    )
    .in("type", match.recommendedTypes)
    .limit(60);

  if (region) query = query.eq("region_sido", region);

  const { data: facilities, error } = await query;

  const ranked = (facilities ?? [])
    .map((f) => {
      const evals = Array.isArray(f.evaluations) ? f.evaluations : [];
      const latest = [...evals].sort((a, b) => b.eval_year - a.eval_year)[0];
      const riskRow = Array.isArray(f.risk_scores) ? f.risk_scores[0] : f.risk_scores;
      const reviewCount = Array.isArray(f.reviews) ? f.reviews.length : 0;
      return {
        ...f,
        latestGrade: latest?.grade ?? null,
        riskScore: riskRow?.score ?? null,
        reviewCount,
      };
    })
    .sort((a, b) => (a.riskScore ?? 0) - (b.riskScore ?? 0));

  const reviewToggleParams = new URLSearchParams();
  reviewToggleParams.set("mobility", mobility);
  reviewToggleParams.set("cognition", cognition);
  reviewToggleParams.set("medicalNeed", medicalNeed);
  if (region) reviewToggleParams.set("region", region);
  if (!hasReviewsOnly) reviewToggleParams.set("hasReviews", "1");

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col px-6 py-12">
      <Link href="/match" className="text-sm text-zinc-500 hover:text-purple-700 hover:underline">
        ← 조건 다시 입력
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-zinc-900">추천 시설 유형: {match.recommendedTypes.join(", ")}</h1>
      <p className="mt-2 text-sm text-zinc-600">{match.reason}</p>
      <div className="mt-3 flex items-center gap-2">
        <RiskScoreInfo />
        <Link
          href={`/results?${reviewToggleParams.toString()}`}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            hasReviewsOnly
              ? "border-purple-600 bg-purple-600 text-white"
              : "border-zinc-300 text-zinc-600 hover:border-purple-300 hover:text-purple-700"
          }`}
        >
          ✓ 이용자 후기 있는 시설만
        </Link>
      </div>

      {match.recommendedTypes.includes("요양원") && <FeeGuide />}

      {error && (
        <p className="mt-6 text-sm text-red-600">
          데이터를 불러오지 못했습니다. (데이터 적재가 아직 진행 중일 수 있습니다)
        </p>
      )}

      {!error && ranked.length === 0 && hasReviewsOnly && (
        <p className="mt-10 text-sm text-zinc-500">
          이용자 후기가 등록된 시설이 없습니다. 필터를 해제하면 더 많은 시설을 볼 수 있습니다.
        </p>
      )}

      {!error && ranked.length === 0 && !hasReviewsOnly && (
        <p className="mt-10 text-sm text-zinc-500">
          조건에 맞는 시설을 아직 찾지 못했습니다. 지역을 &ldquo;전국&rdquo;으로 넓혀보세요.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {ranked.map((f) => (
          <FacilityCard
            key={f.id}
            id={f.id}
            name={f.name}
            type={f.type}
            address={f.address}
            capacityTotal={f.capacity_total}
            capacityCurrent={f.capacity_current}
            latestGrade={f.latestGrade}
            riskScore={f.riskScore}
            reviewCount={f.reviewCount}
          />
        ))}
      </div>
    </main>
  );
}
