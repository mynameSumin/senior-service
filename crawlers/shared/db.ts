import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다."
  );
}

export const db = createClient(url, serviceKey);

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
