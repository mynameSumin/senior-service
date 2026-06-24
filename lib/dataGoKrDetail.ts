// 국민건강보험공단_장기요양기관 시설별 상세조회 서비스 (실시간 호출, 서버 컴포넌트 전용)
// 서비스키는 NEXT_PUBLIC_ 접두사가 없으므로 클라이언트로 노출되지 않는다.

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

// 의존성 추가 없이 단순 XML(이 API는 평탄한 구조만 반환) → 객체 변환
function parseXmlItems<T>(xml: string): T | null {
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (itemBlocks.length === 0) return null;

  const parseFields = (block: string) => {
    const obj: Record<string, string> = {};
    for (const m of block.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
      obj[m[1]] = m[2];
    }
    return obj;
  };

  const items = itemBlocks.map((m) => parseFields(m[1]));
  return (items.length === 1 ? items[0] : items) as T;
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
  const nonBenefits = nonBenefitsRaw
    ? Array.isArray(nonBenefitsRaw)
      ? nonBenefitsRaw
      : [nonBenefitsRaw]
    : null;

  return { staff, acceptance, rooms, programs, nonBenefits };
}
