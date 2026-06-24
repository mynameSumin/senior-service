import stringSimilarity from "string-similarity";

const norm = (s: string) =>
  s
    .replace(/[()\s]/g, "")
    .replace(/(주식회사|재단법인|사단법인)/g, "")
    .trim();

export function bestFacilityMatch(
  nameRaw: string,
  addressRaw: string | undefined,
  candidates: { id: string; name: string; address: string | null }[]
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
