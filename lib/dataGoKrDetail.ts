// 국민건강보험공단_장기요양기관 시설별 상세조회 서비스 (실시간 호출, 서버 컴포넌트 전용)
// 서비스키는 NEXT_PUBLIC_ 접두사가 없으므로 클라이언트로 노출되지 않는다.
import { parseXmlItems } from "./xml";

const BASE = "http://apis.data.go.kr/B550928/getLtcInsttDetailInfoService02";

function serviceKey() {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) throw new Error("DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다.");
  return key;
}

async function callOperation<T>(
  operation: string,
  params: Record<string, string>
): Promise<T | null> {
  const url = new URL(`${BASE}/${operation}`);
  url.searchParams.set("serviceKey", serviceKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    const xml = await res.text();
    if (!xml.includes("<resultCode>00<")) return null;
    return parseXmlItems<T>(xml);
  } catch {
    return null;
  }
}

export interface StaffStatus {
  equipLong?: string; // 시설장
  hdOfce?: string; // 사무국장
  ofceEmp?: string; // 사무원
  mgmtPrsn?: string; // 관리인
  socWel?: string; // 사회복지사
  physicalMTret?: string; // 물리치료사
  wrkMTret?: string; // 작업치료사
  chrgDoc?: string; // 의사(전임)
  chargeDoc?: string; // 의사(촉탁)
  nur?: string; // 간호사
  nurArticle?: string; // 간호조무사
  dent?: string; // 치위생사
  recuProt_1?: string; // 요양보호사 1급
  recuProt_2?: string; // 요양보호사 2급
  recuProtDelay?: string; // 요양보호사 유예인원
  nut?: string; // 영양사
  cook?: string; // 조리원
  hygiPrsn?: string; // 위생원
  suppPrsn?: string; // 보조원
  etcPer?: string; // 기타인원
}

export interface AcceptanceStatus {
  totPer?: string; // 정원
  maNowPer?: string; // 현원(남)
  fmNowPer?: string; // 현원(여)
  maRsvPer?: string; // 대기(남)
  fmRsvPer?: string; // 대기(여)
}

export interface FacilityRoomStatus {
  prsnRoomreal1?: string;
  prsnRoomreal2?: string;
  prsnRoomreal3?: string;
  prsnRoomreal4?: string;
  medRoomreal?: string;
  pgmRoomreal?: string;
  batRoom?: string;
}

export interface ProgramItem {
  pgmNm?: string;
  cyclTm?: string;
  runPlc?: string;
  tgtNop?: string;
}

export interface NonBenefitItem {
  adminPttnCd?: string; // 등록 당시 기관유형코드
  nonpayKind?: string; // 비급여항목 종류 코드 — NONPAY_KIND_LABELS 참조
  nonpayTgtAmt?: string; // 1일 기준 금액
  prodBase?: string; // 산출근거 (예: "3500*3")
  uptDt?: string; // 등록일 YYYYMMDD
}

export const NONPAY_KIND_LABELS: Record<string, string> = {
  "1": "식재료비",
  "2": "상급침실사용료",
  "3": "이미용비",
  "4": "경관영양유동식비",
  "5": "간식비",
  "6": "상급침실사용료(2인실)",
  "7": "기타",
};

// 기관유형코드(adminPttnCd)가 바뀐 적이 있는 시설은 과거 기관유형으로 등록했던
// 비급여 내역이 새 기관유형 내역과 함께 조회된다(예: G31/G32 → A03 변경).
// 같은 항목(간식비 등)이 기관유형별로 중복 노출되므로, 가장 최근에 갱신된
// 기관유형 묶음만 남긴다. 같은 묶음 안의 동일 종류(nonpayKind) 다건은 진짜로
// 별개 항목일 수 있어(예: 1인실/2인실 상급침실료) 그대로 둔다 — 완전히 같은
// (종류, 금액, 산출근거) 조합만 중복으로 보고 제거한다.
function latestNonBenefits(items: NonBenefitItem[]): NonBenefitItem[] {
  const latestUptDtByGroup = new Map<string, string>();
  for (const item of items) {
    const key = item.adminPttnCd ?? "";
    const current = latestUptDtByGroup.get(key) ?? "";
    if ((item.uptDt ?? "") > current) latestUptDtByGroup.set(key, item.uptDt ?? "");
  }
  let bestGroup = "";
  let bestUptDt = "";
  for (const [key, uptDt] of latestUptDtByGroup) {
    if (uptDt > bestUptDt) {
      bestUptDt = uptDt;
      bestGroup = key;
    }
  }

  const seen = new Set<string>();
  const result: NonBenefitItem[] = [];
  for (const item of items) {
    if ((item.adminPttnCd ?? "") !== bestGroup) continue;
    const dedupeKey = `${item.nonpayKind}|${item.nonpayTgtAmt}|${item.prodBase}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(item);
  }
  return result;
}

export interface FacilityLiveDetail {
  staff: StaffStatus | null;
  acceptance: AcceptanceStatus | null;
  rooms: FacilityRoomStatus | null;
  programs: ProgramItem[] | null;
  nonBenefits: NonBenefitItem[] | null;
}

export async function fetchFacilityLiveDetail(
  longTermAdminSym: string,
  adminPttnCd: string | null
): Promise<FacilityLiveDetail> {
  const [staff, acceptance, rooms, programsRaw, nonBenefitsRaw] = await Promise.all([
    adminPttnCd
      ? callOperation<StaffStatus>("getStaffSttusDetailInfoItem02", {
          longTermAdminSym,
          adminPttnCd,
        })
      : Promise.resolve(null),
    adminPttnCd
      ? callOperation<AcceptanceStatus>("getAceptncNmprDetailInfoItem02", {
          longTermAdminSym,
          adminPttnCd,
        })
      : Promise.resolve(null),
    adminPttnCd
      ? callOperation<FacilityRoomStatus>("getInsttSttusDetailInfoItem02", {
          longTermAdminSym,
          adminPttnCd,
        })
      : Promise.resolve(null),
    callOperation<ProgramItem | ProgramItem[]>("getProgramSttusDetailInfoList02", {
      longTermAdminSym,
      pageNo: "1",
      numOfRows: "10",
    }),
    callOperation<NonBenefitItem | NonBenefitItem[]>("getNonBenefitSttusDetailInfoList02", {
      longTermAdminSym,
      pageNo: "1",
      numOfRows: "20",
    }),
  ]);

  const programs = programsRaw ? (Array.isArray(programsRaw) ? programsRaw : [programsRaw]) : null;
  const nonBenefitsList = nonBenefitsRaw
    ? Array.isArray(nonBenefitsRaw)
      ? nonBenefitsRaw
      : [nonBenefitsRaw]
    : null;
  const nonBenefits = nonBenefitsList ? latestNonBenefits(nonBenefitsList) : null;

  return { staff, acceptance, rooms, programs, nonBenefits };
}
