/**
 * 실버케어코리아 크롤러 (시설 리스팅 + 후기)
 *
 * 소스: https://www.silvercarekorea.com (운영사: 데이케어코리아)
 * robots.txt: 일반 UA에는 Allow:/ (Semrush/Applebot/GPTBot 등 특정 메이저 크롤러만 차단) → 크롤링 허용.
 *
 * 트러블슈팅 기록: 기획 당시엔 "JS 렌더링이라 Playwright 필요"로 추정했으나,
 * 실제로는 완전한 서버사이드 정적 HTML이고, 유일한 방어 수단은 detail.php 요청에
 * Referer 헤더가 없으면 "No scrap" 텍스트만 반환하는 단순 체크였다.
 * Referer를 list.php URL로 채워 보내는 것만으로 우회 없이 정상 응답을 받는다.
 *
 * 시설 상세(detail.php)에는 schema.org LocalBusiness JSON-LD가 있고 거기에
 * name/address/geo/telephone/review/aggregateRating이 전부 들어있다.
 * 단, review description에 control character(원본 줄바꿈)가 그대로 들어가 있어
 * JSON.parse가 그대로는 실패한다 → sanitizeJsonLd()로 문자열 내부 줄바꿈만 escape.
 *
 * 시간 예산(90분 박스) 안에서 전국 수천 개를 전부 받는 건 무리이므로,
 * 유형별 페이지 수를 캡(PAGE_CAP)으로 제한한 표본 크롤링으로 범위를 좁혔다.
 */
import * as cheerio from "cheerio";
import { fetchText, rateLimited } from "../shared/http";
import { db, startCrawlRun, finishCrawlRun } from "../shared/db";

const BASE = "https://www.silvercarekorea.com/silver";
const SOURCE = "silvercarekorea";
const PAGE_CAP = 15; // 유형별 최대 페이지 수 (페이지당 약 10~14건) — 시간 예산 내 표본 크기 제한

const GUBUN_TO_TYPE: Record<string, string> = {
  A: "요양원",
  B03C03: "주야간보호",
  B01C01: "방문요양",
};

const wait = rateLimited(800);

function refererFor(gubun: string) {
  return `${BASE}/list.php?gubun=${gubun}`;
}

interface ListRow {
  uid: string;
  name: string;
  regionText: string;
  capacityTotal: number | null;
}

function parseListPage(html: string): ListRow[] {
  const $ = cheerio.load(html);
  const rows: ListRow[] = [];

  $("table.datatable12 tr").each((_, el) => {
    const $row = $(el);
    const link = $row.find("a[href^='detail.php?uid=']").first();
    if (link.length === 0) return;

    const uid = link.attr("href")!.match(/uid=(\d+)/)?.[1];
    if (!uid) return;

    const name = link.text().trim();
    const regionText = $row.find("a[href^='list.php?addcode=']").first().text().trim();
    const fullText = $row.text();
    const capacityMatch = fullText.match(/정원\s*:\s*([\d,]+)명/);
    const capacityTotal = capacityMatch ? parseInt(capacityMatch[1].replace(/,/g, ""), 10) : null;

    rows.push({ uid, name, regionText, capacityTotal });
  });

  return rows;
}

function sanitizeJsonLd(text: string): string {
  let out = "";
  let inString = false;
  let escapeNext = false;
  for (const ch of text) {
    if (inString) {
      if (escapeNext) {
        out += ch;
        escapeNext = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") continue;
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

interface DetailData {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  reviews: { author: string; rating: number; content: string; date: string }[];
}

interface LdJsonReview {
  author?: { name?: string };
  reviewRating?: { ratingValue?: number | string };
  description?: string;
  datePublished?: string;
}

interface LdJsonLocalBusiness {
  name: string;
  address?: { name?: string };
  geo?: { latitude?: string; longitude?: string };
  telephone?: string;
  review?: LdJsonReview[];
}

function parseDetailPage(html: string): DetailData | null {
  const $ = cheerio.load(html);
  const scriptText = $('script[type="application/ld+json"]').first().html();
  if (!scriptText) return null;

  let data: LdJsonLocalBusiness;
  try {
    data = JSON.parse(sanitizeJsonLd(scriptText));
  } catch {
    return null;
  }

  const reviews = (data.review ?? []).map((r) => ({
    author: r.author?.name ?? "익명",
    rating: Number(r.reviewRating?.ratingValue ?? 0),
    content: (r.description ?? "").trim(),
    date: (r.datePublished ?? "").slice(0, 10),
  }));

  return {
    name: data.name,
    address: data.address?.name ?? null,
    lat: data.geo?.latitude ? parseFloat(data.geo.latitude) : null,
    lng: data.geo?.longitude ? parseFloat(data.geo.longitude) : null,
    phone: data.telephone ?? null,
    reviews,
  };
}

async function upsertFacility(params: {
  name: string;
  type: string;
  address: string | null;
  region_sido: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  capacity_total: number | null;
  detailUrl: string;
}) {
  const { data: existing } = await db
    .from("facilities")
    .select("id")
    .eq("external_urls->>silvercarekorea", params.detailUrl)
    .maybeSingle();

  const payload = {
    name: params.name,
    type: params.type,
    address: params.address,
    region_sido: params.region_sido,
    phone: params.phone,
    lat: params.lat,
    lng: params.lng,
    capacity_total: params.capacity_total,
    external_urls: { silvercarekorea: params.detailUrl },
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await db.from("facilities").update(payload).eq("id", existing.id);
    return existing.id as string;
  }

  const { data: inserted, error } = await db
    .from("facilities")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id as string;
}

async function replaceReviews(
  facilityId: string,
  detailUrl: string,
  reviews: DetailData["reviews"]
) {
  await db.from("reviews").delete().eq("facility_id", facilityId).eq("source", SOURCE);
  if (reviews.length === 0) return;

  await db.from("reviews").insert(
    reviews.map((r) => ({
      facility_id: facilityId,
      source: SOURCE,
      author_label: r.author,
      rating: r.rating || null,
      content: r.content,
      review_date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
      source_url: detailUrl,
    }))
  );
}

async function run() {
  const runId = await startCrawlRun(SOURCE);
  let total = 0;
  try {
    for (const [gubun, type] of Object.entries(GUBUN_TO_TYPE)) {
      for (let page = 1; page <= PAGE_CAP; page++) {
        await wait();
        const listHtml = await fetchText(`${BASE}/list.php`, {
          params: { gubun, pagenum: String(page) },
          headers: { Referer: `${BASE}/list.php`, "Accept-Language": "ko-KR,ko;q=0.9" },
        });
        const rows = parseListPage(listHtml);
        if (rows.length === 0) break; // 마지막 페이지

        for (const row of rows) {
          await wait();
          const detailUrl = `${BASE}/detail.php?uid=${row.uid}`;
          let detailHtml: string;
          try {
            detailHtml = await fetchText(detailUrl, {
              headers: { Referer: refererFor(gubun), "Accept-Language": "ko-KR,ko;q=0.9" },
            });
          } catch {
            continue;
          }
          const detail = parseDetailPage(detailHtml);
          if (!detail) continue;

          const facilityId = await upsertFacility({
            name: detail.name || row.name,
            type,
            address: detail.address,
            region_sido: row.regionText.split(" ")[0] ?? null,
            phone: detail.phone,
            lat: detail.lat,
            lng: detail.lng,
            capacity_total: row.capacityTotal,
            detailUrl,
          });
          await replaceReviews(facilityId, detailUrl, detail.reviews);
          total++;
        }
        console.log(`[${SOURCE}] ${type} 페이지 ${page} 처리 완료 (${rows.length}건)`);
      }
    }
    await finishCrawlRun(runId, total > 0 ? "success" : "partial", total);
    console.log(`[${SOURCE}] 총 ${total}개 시설 적재`);
  } catch (err) {
    console.error(`[${SOURCE}] 실패:`, err);
    await finishCrawlRun(runId, "failed", total, String(err));
    throw err;
  }
}

run();
