import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다."
  );
}

export const db = createClient(url, serviceKey);

// PostgREST는 .range() 없이 select하면 기본 1000행에서 잘린다. facilities가
// 1000건을 넘어선 뒤(전국 시드 이후) 이걸 놓치면 매칭 풀이 조용히 잘려나간다 —
// 매번 끝까지 페이지네이션해서 가져온다.
//
// 주의: build()로 넘기는 쿼리에 반드시 .order("id")(또는 다른 안정적인 컬럼)를
// 붙여야 한다. ORDER BY 없이 .range()만 반복 호출하면 Postgres가 페이지마다
// 다른 스캔 순서를 골라 일부 행이 누락될 수 있다 — 실제로 이 버그로 7,614개
// 시설이 백필 대상에서 빠진 적이 있다(docs/troubleshooting.md 13번 참고).
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function startCrawlRun(source: string) {
  const { data, error } = await db
    .from("crawl_runs")
    .insert({ source, status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function finishCrawlRun(
  runId: string,
  status: "success" | "partial" | "failed",
  recordsCount: number,
  errorLog?: string
) {
  await db
    .from("crawl_runs")
    .update({
      status,
      records_count: recordsCount,
      finished_at: new Date().toISOString(),
      error_log: errorLog ?? null,
    })
    .eq("id", runId);
}
