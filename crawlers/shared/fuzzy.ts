import stringSimilarity from "string-similarity";

type Candidate = { id: string; name: string; address: string | null };

export const norm = (s: string) =>
  s
    .replace(/[()\s]/g, "")
    .replace(/(주식회사|재단법인|사단법인)/g, "")
    .trim();

export function bestFacilityMatch(
  nameRaw: string,
  addressRaw: string | undefined,
  candidates: Candidate[]
): { id: string; confidence: number } | null {
  if (candidates.length === 0) return null;

  const targetName = norm(nameRaw);
  const { bestMatchIndex, bestMatch } = stringSimilarity.findBestMatch(
    targetName,
    candidates.map((c) => norm(c.name))
  );

  let confidence = bestMatch.rating;
  const candidate = candidates[bestMatchIndex];

  if (addressRaw && candidate.address) {
    const addrScore = stringSimilarity.compareTwoStrings(
      norm(addressRaw),
      norm(candidate.address)
    );
    // 이름 70% + 주소 30% 가중 합성 — 동명 시설이 많아 주소로 보강
    confidence = confidence * 0.7 + addrScore * 0.3;
  }

  return { id: candidate.id, confidence };
}

export type NameIndex = Map<string, Candidate[]>;

export function buildNameIndex(candidates: Candidate[]): NameIndex {
  const index: NameIndex = new Map();
  for (const c of candidates) {
    const key = norm(c.name);
    const bucket = index.get(key);
    if (bucket) bucket.push(c);
    else index.set(key, [c]);
  }
  return index;
}

// 후보 풀이 수만 건 규모일 때 bestFacilityMatch(전체 풀과 1:1 비교)는 너무 느리다
// (행 수 × 풀 크기). 정규화한 이름으로 먼저 정확히 일치하는 후보만 추려서 그
// 안에서만(보통 1~여러 건) 주소로 비교한다 — 철자가 살짝 다른 경우는 못 잡지만,
// 두 데이터 모두 같은 공단 등록정보에서 나온 것이라 정확히 일치하는 경우가 대부분이고,
// 안전하게 건너뛰는 쪽(과매칭보다는 미매칭)이 데이터 정합성 면에서 낫다.
export function matchWithIndex(
  nameRaw: string,
  addressRaw: string | undefined,
  index: NameIndex
): { id: string; confidence: number } | null {
  const bucket = index.get(norm(nameRaw));
  if (!bucket || bucket.length === 0) return null;
  return bestFacilityMatch(nameRaw, addressRaw, bucket);
}
