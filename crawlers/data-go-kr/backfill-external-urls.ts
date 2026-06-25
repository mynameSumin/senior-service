/**
 * 일회성 백필: seed-facilities.ts/hira/run.ts가 external_urls를 비워둔 채로
 * 적재했던(과제 제출 요건 — "크롤링 원본 페이지로 이동하는 외부 링크" — 발견 전) 기존 행을
 * 채운다. 두 크롤러는 이미 고쳐졌으니 이 스크립트는 한 번만 돌리면 된다.
 */
import { db, fetchAllRows } from "../shared/db";
import { FACILITY_STATUS_DATASET_URL } from "./facilityStatusFile";

async function main() {
  let datagokrUpdated = 0;
  let hiraUpdated = 0;

  const ltcFacilities = await fetchAllRows<{ id: string; external_urls: Record<string, string> }>(
    (from, to) =>
      db
        .from("facilities")
        .select("id, external_urls")
        .in("type", ["요양원", "주야간보호", "방문요양"])
        .range(from, to)
  );
  const ltcToFix = ltcFacilities.filter((f) => Object.keys(f.external_urls ?? {}).length === 0);
  for (let i = 0; i < ltcToFix.length; i += 500) {
    const chunk = ltcToFix.slice(i, i + 500);
    await Promise.all(
      chunk.map((f) =>
        db
          .from("facilities")
          .update({ external_urls: { datagokr: FACILITY_STATUS_DATASET_URL } })
          .eq("id", f.id)
      )
    );
    datagokrUpdated += chunk.length;
  }

  const hospEvals = await fetchAllRows<{ facility_id: string; raw: { ykiho?: string } }>(
    (from, to) => db.from("evaluations").select("facility_id, raw").eq("source", "심평원").range(from, to)
  );
  const hospFacilities = await fetchAllRows<{ id: string; external_urls: Record<string, string> }>(
    (from, to) => db.from("facilities").select("id, external_urls").eq("type", "요양병원").range(from, to)
  );
  const emptyHospIds = new Set(
    hospFacilities.filter((f) => Object.keys(f.external_urls ?? {}).length === 0).map((f) => f.id)
  );
  const ykihoByFacility = new Map<string, string>();
  for (const e of hospEvals) {
    if (emptyHospIds.has(e.facility_id) && e.raw?.ykiho) ykihoByFacility.set(e.facility_id, e.raw.ykiho);
  }
  const hospEntries = [...ykihoByFacility.entries()];
  for (let i = 0; i < hospEntries.length; i += 500) {
    const chunk = hospEntries.slice(i, i + 500);
    await Promise.all(
      chunk.map(([facilityId, ykiho]) =>
        db
          .from("facilities")
          .update({
            external_urls: { hira: `https://www.hira.or.kr/ra/hosp/hospInfoAjax.do?ykiho=${ykiho}` },
          })
          .eq("id", facilityId)
      )
    );
    hiraUpdated += chunk.length;
  }

  console.log(`백필 완료 — data.go.kr 링크: ${datagokrUpdated}곳, HIRA 링크: ${hiraUpdated}곳`);
}

main();
