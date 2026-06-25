import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RiskBadge from "@/components/RiskBadge";
import StaffStatusGrid from "@/components/StaffStatusGrid";
import ProgramGrid from "@/components/ProgramGrid";
import NonBenefitGrid from "@/components/NonBenefitGrid";
import HiraNonPaymentList from "@/components/HiraNonPaymentList";
import { fetchFacilityLiveDetail } from "@/lib/dataGoKrDetail";
import { fetchHiraNonPaymentItems } from "@/lib/hiraNonPayment";

const SOURCE_LABEL: Record<string, string> = {
  silvercarekorea: "실버케어코리아",
  datagokr: "공공데이터포털(data.go.kr)",
  hira: "건강보험심사평가원",
  caredoc: "케어닥",
};

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: facility } = await supabase.from("facilities").select("*").eq("id", id).single();
  if (!facility) notFound();

  const [{ data: evaluations }, { data: violations }, { data: reviews }, { data: riskScore }] =
    await Promise.all([
      supabase
        .from("evaluations")
        .select("*")
        .eq("facility_id", id)
        .order("eval_year", { ascending: false }),
      supabase.from("violations").select("*").eq("facility_id", id),
      supabase
        .from("reviews")
        .select("*")
        .eq("facility_id", id)
        .order("review_date", { ascending: false })
        .limit(10),
      supabase.from("risk_scores").select("*").eq("facility_id", id).maybeSingle(),
    ]);

  const liveDetail = facility.long_term_admin_sym
    ? await fetchFacilityLiveDetail(facility.long_term_admin_sym, facility.admin_pttn_cd)
    : null;

  // 요양병원은 장기요양보험 영역 밖이라 위 API에 없다 — 평가등급 적재 시 같이 저장해둔
  // ykiho(심평원 기관코드)로 별도 비급여 비용 API를 부른다.
  const hiraYkiho = evaluations?.find((e) => e.source === "심평원")?.raw?.ykiho as
    | string
    | undefined;
  const hiraNonPayments = hiraYkiho ? await fetchHiraNonPaymentItems(hiraYkiho) : null;

  // external_urls에는 caredocCheckedAt처럼 URL이 아닌 내부용 마커도 같이 들어있어
  // 실제 http(s) 링크만 걸러서 "원본 페이지 보기" 버튼으로 보여준다.
  const externalLinks = Object.entries(
    (facility.external_urls ?? {}) as Record<string, string>
  ).filter(([, url]) => /^https?:\/\//.test(url));

  return (
    <div className="min-h-full w-full flex-1 bg-purple-100">
      <main className="mx-auto flex max-w-3xl flex-1 flex-col bg-white px-6 py-12 shadow-sm">
      <Link href="/results" className="text-sm text-zinc-500 hover:text-purple-700 hover:underline">
        ← 목록으로
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{facility.type}</p>
          <h1 className="text-2xl font-bold text-zinc-900">{facility.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">{facility.address}</p>
        </div>
        {riskScore && <RiskBadge score={riskScore.score} />}
      </div>

      {riskScore && (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-800">왜 이 점수인가요?</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-zinc-600">
            {riskScore.explanation.map((line: string, i: number) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-800">평가등급 추이</h2>
        {evaluations && evaluations.length > 0 ? (
          <div className="mt-2 flex gap-3">
            {evaluations.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center"
              >
                <p className="text-xs text-zinc-500">{e.eval_year}년</p>
                <p className="text-lg font-bold text-zinc-900">{e.grade}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">아직 등급 데이터가 없습니다.</p>
        )}
      </section>

      {liveDetail?.acceptance && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-800">
            입소 현황 <span className="text-xs font-normal text-zinc-400">(공공데이터 실시간 조회)</span>
          </h2>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              정원 {liveDetail.acceptance.totPer ?? "-"}명
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              현원{" "}
              {Number(liveDetail.acceptance.maNowPer ?? 0) +
                Number(liveDetail.acceptance.fmNowPer ?? 0)}
              명
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
              대기{" "}
              {Number(liveDetail.acceptance.maRsvPer ?? 0) +
                Number(liveDetail.acceptance.fmRsvPer ?? 0)}
              명
            </div>
          </div>
        </section>
      )}

      {liveDetail?.nonBenefits && liveDetail.nonBenefits.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-800">
            비급여 비용 <span className="text-xs font-normal text-zinc-400">(공공데이터 실시간 조회)</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            급여(보험 적용) 비용은 등급에 따라 전국 동일하지만, 아래 항목은 시설마다 다르게 책정하는
            비급여(실비) 비용입니다.
          </p>
          <div className="mt-2">
            <NonBenefitGrid items={liveDetail.nonBenefits} />
          </div>
        </section>
      )}

      {hiraNonPayments && hiraNonPayments.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-800">
            비급여 비용 <span className="text-xs font-normal text-zinc-400">(공공데이터 실시간 조회)</span>
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            건강보험심사평가원에 등재된 항목별 비급여(실비) 비용입니다. 시설마다 항목·가격이
            다릅니다.
          </p>
          <div className="mt-2">
            <HiraNonPaymentList items={hiraNonPayments} />
          </div>
        </section>
      )}

      {liveDetail?.staff && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-800">
            인력 현황 <span className="text-xs font-normal text-zinc-400">(공공데이터 실시간 조회)</span>
          </h2>
          <div className="mt-2">
            <StaffStatusGrid staff={liveDetail.staff} />
          </div>
        </section>
      )}

      {liveDetail?.programs && liveDetail.programs.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-800">
            운영 프로그램 <span className="text-xs font-normal text-zinc-400">(공공데이터 실시간 조회)</span>
          </h2>
          <div className="mt-2">
            <ProgramGrid programs={liveDetail.programs} />
          </div>
        </section>
      )}

      {violations && violations.length > 0 && (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">행정처분 이력</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-red-700">
            {violations.map((v) => (
              <li key={v.id}>
                {v.violation_date} — {v.violation_type} ({v.penalty})
                {v.match_confidence != null && v.match_confidence < 0.6 && (
                  <span className="ml-1 text-xs text-red-400">(매칭 신뢰도 낮음 — 참고용)</span>
                )}
                {v.source_url && (
                  <a
                    href={v.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-red-400 underline hover:text-red-600"
                  >
                    명단공표 원문 보기 ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-800">이용자 후기</h2>
        {reviews && reviews.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{r.author_label ?? "익명"}</span>
                  <span>{r.review_date}</span>
                </div>
                <p className="mt-1 text-zinc-700">{r.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">아직 집계된 후기가 없습니다.</p>
        )}
      </section>

      {externalLinks.length > 0 && (
        <section className="mt-8 flex flex-wrap gap-2">
          {externalLinks.map(([src, url]) => (
            <a
              key={src}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-purple-200 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50"
            >
              {SOURCE_LABEL[src] ?? src} 원본 페이지 보기 ↗
            </a>
          ))}
        </section>
      )}
      </main>
    </div>
  );
}
