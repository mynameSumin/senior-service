import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  matchFacilityType,
  type Cognition,
  type MedicalNeed,
  type Mobility,
} from "@/lib/matching";
import FacilityCard from "@/components/FacilityCard";
import FeeGuide from "@/components/FeeGuide";
import RiskScoreInfo from "@/components/RiskScoreInfo";

const PAGE_SIZE = 10;

interface SearchParams {
  mobility?: string;
  cognition?: string;
  medicalNeed?: string;
  region?: string;
  hasReviews?: string;
  page?: string;
  q?: string;
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
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const match = matchFacilityType({ mobility, cognition, medicalNeed, region });

  // 정렬 기준(위험도 점수)이 facilities가 아니라 risk_scores 쪽에 있어서, risk_scores를
  // 기준 테이블로 두고 facilities를 !inner로 묶어야 DB 단계에서 정확히 정렬 + 페이지네이션된다
  // (반대로 facilities에서 risk_scores를 embed해 정렬하면 PostgREST가 부모 행이 아니라
  // 묶인 배열 내부만 정렬해서 전혀 의도대로 동작하지 않았다).
  // hasReviews=1일 때만 reviews도 !inner로 묶어 후기가 1건도 없는 시설은 DB 단계에서 제외한다.
  const reviewsField = hasReviewsOnly ? "reviews!inner(id)" : "reviews(id)";
  let query = supabase
    .from("risk_scores")
    .select(
      `score, facilities!inner(id, name, type, address, region_sido, capacity_total, capacity_current, evaluations(eval_year, grade), ${reviewsField})`,
      { count: "exact" },
    )
    .in("facilities.type", match.recommendedTypes)
    .order("score", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (region) query = query.eq("facilities.region_sido", region);
  if (q) query = query.ilike("facilities.name", `%${q}%`);

  const { data: rows, error, count } = await query;

  const ranked = (rows ?? []).map((row) => {
    const f = Array.isArray(row.facilities)
      ? row.facilities[0]
      : row.facilities;
    const evals = Array.isArray(f.evaluations) ? f.evaluations : [];
    const latest = [...evals].sort((a, b) => b.eval_year - a.eval_year)[0];
    const reviewCount = Array.isArray(f.reviews) ? f.reviews.length : 0;
    return {
      ...f,
      latestGrade: latest?.grade ?? null,
      riskScore: row.score,
      reviewCount,
    };
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const baseParams = new URLSearchParams();
  baseParams.set("mobility", mobility);
  baseParams.set("cognition", cognition);
  baseParams.set("medicalNeed", medicalNeed);
  if (region) baseParams.set("region", region);
  if (hasReviewsOnly) baseParams.set("hasReviews", "1");
  if (q) baseParams.set("q", q);

  const pageHref = (p: number) => {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set("page", String(p));
    return `/results?${params.toString()}`;
  };

  const paramsWithoutQuery = new URLSearchParams(baseParams);
  paramsWithoutQuery.delete("q");

  const reviewToggleParams = new URLSearchParams(baseParams);
  if (hasReviewsOnly) reviewToggleParams.delete("hasReviews");
  else reviewToggleParams.set("hasReviews", "1");

  return (
    <div className="min-h-full w-full flex-1 bg-purple-100">
      <main className="mx-auto flex max-w-3xl flex-1 flex-col bg-white px-6 py-12 shadow-sm">
        <Link
          href="/match"
          className="text-sm text-zinc-500 hover:text-purple-700 hover:underline"
        >
          ← 조건 다시 입력
        </Link>
      <h1 className="mt-3 text-2xl font-bold text-zinc-900">
        추천 시설 유형: {match.recommendedTypes.join(", ")}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">{match.reason}</p>
      <div className="mt-3 flex flex-col items-start gap-2">
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

      <form action="/results" method="get" className="mt-4 flex gap-2">
        <input type="hidden" name="mobility" value={mobility} />
        <input type="hidden" name="cognition" value={cognition} />
        <input type="hidden" name="medicalNeed" value={medicalNeed} />
        {region && <input type="hidden" name="region" value={region} />}
        {hasReviewsOnly && <input type="hidden" name="hasReviews" value="1" />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="시설 이름으로 검색"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg text-nowrap bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          검색
        </button>
        {q && (
          <Link
            href={`/results?${paramsWithoutQuery.toString()}`}
            className="flex text-nowrap items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            초기화
          </Link>
        )}
      </form>

      {match.recommendedTypes.includes("요양원") && <FeeGuide />}

      {error && (
        <p className="mt-6 text-sm text-red-600">
          데이터를 불러오지 못했습니다. (데이터 적재가 아직 진행 중일 수
          있습니다)
        </p>
      )}

      {!error && ranked.length === 0 && q && (
        <p className="mt-10 text-sm text-zinc-500">
          &ldquo;{q}&rdquo;와 일치하는 시설을 찾지 못했습니다.
        </p>
      )}

      {!error && ranked.length === 0 && !q && hasReviewsOnly && (
        <p className="mt-10 text-sm text-zinc-500">
          이용자 후기가 등록된 시설이 없습니다. 필터를 해제하면 더 많은 시설을
          볼 수 있습니다.
        </p>
      )}

      {!error && ranked.length === 0 && !q && !hasReviewsOnly && (
        <p className="mt-10 text-sm text-zinc-500">
          조건에 맞는 시설을 아직 찾지 못했습니다. 지역을 &ldquo;전국&rdquo;으로
          넓혀보세요.
        </p>
      )}

      {!error && (count ?? 0) > 0 && (
        <p className="mt-6 text-xs text-zinc-400">
          총 {count}곳 중 {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, count ?? 0)}번째
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
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

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-1 text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page === 1}
            className={`rounded-md px-3 py-1.5 ${
              page === 1
                ? "pointer-events-none text-zinc-300"
                : "text-zinc-600 hover:bg-purple-50 hover:text-purple-700"
            }`}
          >
            이전
          </Link>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
            )
            .map((p, i, arr) => (
              <span key={p} className="flex items-center">
                {i > 0 && arr[i - 1] !== p - 1 && (
                  <span className="px-1 text-zinc-300">…</span>
                )}
                <Link
                  href={pageHref(p)}
                  className={`min-w-9 rounded-md px-3 py-1.5 text-center ${
                    p === page
                      ? "bg-purple-600 font-semibold text-white"
                      : "text-zinc-600 hover:bg-purple-50 hover:text-purple-700"
                  }`}
                >
                  {p}
                </Link>
              </span>
            ))}
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page === totalPages}
            className={`rounded-md px-3 py-1.5 ${
              page === totalPages
                ? "pointer-events-none text-zinc-300"
                : "text-zinc-600 hover:bg-purple-50 hover:text-purple-700"
            }`}
          >
            다음
          </Link>
        </nav>
      )}
      </main>
    </div>
  );
}
