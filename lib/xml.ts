// data.go.kr Open API는 평탄한 구조의 XML만 반환하므로, 의존성 추가 없이 단순 정규식으로 파싱한다.
export function parseXmlItems<T>(xml: string): T | null {
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
