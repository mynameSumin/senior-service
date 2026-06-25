// 건강보험심사평가원_비급여진료비정보조회서비스 (요양병원 비급여 비용, 실시간 호출, 서버 컴포넌트 전용)
// 요양원 등(국민건강보험공단 API)과 제공기관이 달라 서비스키를 따로 활용신청해야 했다 —
// 자세한 내용은 docs/troubleshooting.md 참고.
import { parseXmlItems } from "./xml";

const BASE = "https://apis.data.go.kr/B551182/nonPaymentDamtInfoService";

function serviceKey() {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) throw new Error("DATA_GO_KR_SERVICE_KEY가 설정되지 않았습니다.");
  return key;
}

export interface HiraNonPaymentItem {
  npayKorNm?: string; // 비급여 항목명(대분류)
  yadmNpayCdNm?: string; // 세부 항목명
  curAmt?: string; // 현재 금액(원)
  adtFrDd?: string; // 등재 시작일 YYYYMMDD
  adtEndDd?: string; // 등재 종료일(99991231=현재까지 유효)
}

export async function fetchHiraNonPaymentItems(
  ykiho: string
): Promise<HiraNonPaymentItem[] | null> {
  const url = new URL(`${BASE}/getNonPaymentItemHospDtlList`);
  url.searchParams.set("serviceKey", serviceKey());
  url.searchParams.set("ykiho", ykiho);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    const xml = await res.text();
    if (!xml.includes("<resultCode>00<")) return null;
    const result = parseXmlItems<HiraNonPaymentItem | HiraNonPaymentItem[]>(xml);
    if (!result) return null;
    return Array.isArray(result) ? result : [result];
  } catch {
    return null;
  }
}
