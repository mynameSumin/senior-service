/**
 * 케어닥(caredoc.kr) 시설별 실제 페이지 존재 확인 크롤러
 *
 * data.go.kr로 시드한 요양원/주야간보호/방문요양 시설(17,131곳, seed-facilities.ts에서
 * external_urls를 데이터셋 페이지로만 채워뒀던 것들)에 대해, 케어닥에 같은 시설의
 * 실제 상세페이지가 있는지 확인해 있으면 그 페이지로 외부 링크를 바꾼다.
 *
 * 케어닥의 시설 상세 URL은 `/facility/{이름}-LTC-{long_term_admin_sym}-{admin_pttn_cd}`
 * 형태로, 우리가 이미 갖고 있는 기관코드로 직접 구성할 수 있다(별도 검색 API 불필요).
 * 다만 케어닥 자체 등록 시설만 다루므로 전국 시설을 다 갖고 있지는 않다 — 임의 샘플을
 * 확인해보니 상당수가 "존재하지 않음"이었다. 그래서 URL을 구성한 뒤 실제로 요청을
 * 보내 페이지가 진짜 있는지 하나씩 확인해야 한다(없으면 data.go.kr 링크를 그대로 둔다).
 *
 * 존재 여부 판별: 케어닥은 Next.js라 404(존재하지 않는 시설)여도 HTTP 200을 주지만,
 * 서버 렌더링된 원본 HTML에 `<title>` 태그 자체가 없다(클라이언트에서 채움). 실제
 * 시설 페이지는 `<title>{이름} - 케어닥</title>`이 처음부터 박혀 있다 — 이 차이로 구분한다.
 *
 * 17,131건을 정중한 속도(요청당 300ms)로 순차 처리하면 ~1.5시간이라 5개 동시처리로
 * ~17~20분으로 줄였다(레인당 간격은 그대로 유지해 서버 부담을 5배 이내로 제한).
 */
import axios from "axios";
import { UA } from "../shared/http";
import { db, startCrawlRun, finishCrawlRun, fetchAllRows } from "../shared/db";
import { FACILITY_STATUS_DATASET_URL } from "../data-go-kr/facilityStatusFile";

const SOURCE = "caredoc";
const CONCURRENCY = 5;
const LANE_INTERVAL_MS = 300;

interface FacilityRow {
  id: string;
  name: string;
  long_term_admin_sym: string;
  admin_pttn_cd: string;
}

function buildCandidateUrl(f: FacilityRow): string {
  return `https://www.caredoc.kr/facility/${encodeURIComponent(f.name)}-LTC-${f.long_term_admin_sym}-${f.admin_pttn_cd}`;
}

async function pageExists(url: string): Promise<boolean> {
  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": UA },
      timeout: 10000,
      validateStatus: () => true,
    });
    return /<title>[^<]+<\/title>/.test(res.data as string);
  } catch {
    return false;
  }
}

async function runLane(
  queue: FacilityRow[],
  onChecked: () => void,
  onHit: (f: FacilityRow, url: string) => void
) {
  let lastCall = 0;
  for (const f of queue) {
    const elapsed = Date.now() - lastCall;
    if (elapsed < LANE_INTERVAL_MS) await new Promise((r) => setTimeout(r, LANE_INTERVAL_MS - elapsed));
    lastCall = Date.now();

    const url = buildCandidateUrl(f);
    if (await pageExists(url)) onHit(f, url);
    onChecked();
  }
}

async function run() {
  const runId = await startCrawlRun(SOURCE);
  let checked = 0;
  let hits = 0;

  try {
    const targets = await fetchAllRows<FacilityRow>((from, to) =>
      db
        .from("facilities")
        .select("id, name, long_term_admin_sym, admin_pttn_cd")
        .in("type", ["요양원", "주야간보호", "방문요양"])
        .not("long_term_admin_sym", "is", null)
        .eq("external_urls->>datagokr", FACILITY_STATUS_DATASET_URL)
        .order("id").range(from, to)
    );
    console.log(`[${SOURCE}] 확인 대상 ${targets.length}곳, 동시처리 ${CONCURRENCY}개`);

    const lanes: FacilityRow[][] = Array.from({ length: CONCURRENCY }, () => []);
    targets.forEach((f, i) => lanes[i % CONCURRENCY].push(f));

    const hitBuffer: { id: string; url: string }[] = [];
    const flushHits = async () => {
      if (hitBuffer.length === 0) return;
      const chunk = hitBuffer.splice(0, hitBuffer.length);
      await Promise.all(
        chunk.map(({ id, url }) => db.from("facilities").update({ external_urls: { caredoc: url } }).eq("id", id))
      );
    };

    const onHit = (f: FacilityRow, url: string) => {
      hits++;
      hitBuffer.push({ id: f.id, url });
    };
    const onChecked = () => {
      checked++;
    };

    const progressTick = setInterval(() => {
      console.log(`[${SOURCE}] 진행: ${checked}/${targets.length} 확인, 케어닥 페이지 발견: ${hits}건`);
      void flushHits();
    }, 30000);

    await Promise.all(lanes.map((lane) => runLane(lane, onChecked, onHit)));
    clearInterval(progressTick);
    await flushHits();

    console.log(`[${SOURCE}] 완료 — 확인: ${targets.length}곳, 케어닥 페이지 발견 및 링크 교체: ${hits}곳`);
    await finishCrawlRun(runId, "success", hits);
  } catch (err) {
    console.error(`[${SOURCE}] 실패:`, err);
    await finishCrawlRun(runId, "failed", hits, String(err));
    throw err;
  }
}

run();
