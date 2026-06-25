// data.go.kr 공개 다운로드 파일 "국민건강보험공단_장기요양기관 시설별 현황"(publicDataPk=15124763)
// 전국 장기요양기관 전수(일반현황/입소인원/인력현황)가 들어있다.
// match-admin-sym.ts(기존 시설에 기관코드 매칭)와 seed-facilities.ts(전국 시설 자체를 채우기)가 공유한다.
import XLSX from "xlsx";
import { fetchJson } from "../shared/http";

const FACILITY_STATUS_PUBLIC_DATA_PK = "15124763";
export const FACILITY_STATUS_DATASET_URL = `https://www.data.go.kr/data/${FACILITY_STATUS_PUBLIC_DATA_PK}/fileData.do`;

export async function downloadFacilityStatusWorkbook(): Promise<XLSX.WorkBook> {
  const info = await fetchJson<{ atchFileId: string; fileDetailSn: string; status: boolean }>(
    "https://www.data.go.kr/tcs/dss/selectFileDataDownload.do",
    { publicDataPk: FACILITY_STATUS_PUBLIC_DATA_PK }
  );
  if (!info.status) throw new Error("시설별 현황 파일 다운로드 정보 조회 실패");

  const res = await fetch(
    `https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=${info.atchFileId}&fileDetailSn=${info.fileDetailSn}&dataNm=facility_status`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const buf = Buffer.from(await res.arrayBuffer());
  return XLSX.read(buf, { type: "buffer" });
}

// 같은 이름+주소로 기관코드가 여러 개 등록된 경우(운영자 변경 등) 데이터가 더
// 채워진 코드를 우선하기 위한 인력현황 합계(직종 무관, 숫자 컬럼 전부 합산).
export function computeStaffRichnessByCode(
  staffRows: Record<string, string | number>[]
): Map<string, number> {
  const richnessByCode = new Map<string, number>();
  for (const row of staffRows) {
    const code = String(row["장기요양기관코드"]);
    let sum = 0;
    for (const [key, value] of Object.entries(row)) {
      if (key === "장기요양기관코드" || key === "기관유형코드" || key === "기관유형코드명") continue;
      const n = Number(value);
      if (!isNaN(n)) sum += n;
    }
    richnessByCode.set(code, (richnessByCode.get(code) ?? 0) + sum);
  }
  return richnessByCode;
}

export type ResolvedType = "요양원" | "주야간보호" | "방문요양";

// 기관유형명 한 건 → 우리 서비스가 다루는 시설 유형(방문목욕/방문간호/단기보호/
// 복지용구는 우리 타겟 외라 null).
export function categorizeFacilityTypeName(name: string): ResolvedType | null {
  if (/노인요양시설|노인전문요양시설|노인요양공동생활가정|입소시설/.test(name)) return "요양원";
  if (/주야간보호/.test(name)) return "주야간보호";
  if (/방문요양/.test(name)) return "방문요양";
  return null;
}

// 한 기관이 여러 유형을 겸하면 입소시설 > 주야간보호 > 방문요양 순으로 우선한다.
export function resolveFacilityType(typeNames: Set<string>): ResolvedType | null {
  let best: ResolvedType | null = null;
  for (const t of typeNames) {
    const cat = categorizeFacilityTypeName(t);
    if (cat === "요양원") return "요양원";
    if (cat === "주야간보호") best = "주야간보호";
    else if (cat === "방문요양" && !best) best = "방문요양";
  }
  return best;
}
