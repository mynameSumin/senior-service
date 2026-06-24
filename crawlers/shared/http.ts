import axios from "axios";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 caregaurd-crawler/0.1 (+contact: msm4167@gmail.com)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 정부/민간 사이트 부담을 줄이기 위한 단순 레이트리밋 (소스별 호출 사이 최소 간격)
export function rateLimited(minIntervalMs = 1000) {
  let last = 0;
  return async function wait() {
    const now = Date.now();
    const elapsed = now - last;
    if (elapsed < minIntervalMs) await sleep(minIntervalMs - elapsed);
    last = Date.now();
  };
}

export async function fetchText(
  url: string,
  init?: { params?: Record<string, string>; headers?: Record<string, string> }
) {
  const res = await axios.get(url, {
    params: init?.params,
    headers: { "User-Agent": UA, ...init?.headers },
    timeout: 15000,
    responseType: "text",
  });
  return res.data as string;
}

export async function fetchJson<T>(url: string, params?: Record<string, string>) {
  const res = await axios.get<T>(url, {
    params,
    headers: { "User-Agent": UA, Accept: "application/json" },
    timeout: 15000,
  });
  return res.data;
}

export { UA };
