// data.go.kr 응답 XML 읽기. 구조가 단순(헤더 + 평평한 <item> 목록)해서 파서 라이브러리 없이 태그만 뽑는다.

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

/** 첫 번째 <tag>값</tag> (없으면 undefined) */
export function tagText(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : undefined;
}

/** <item> 하나하나를 { 태그명: 값 } 으로 바꾼다. 빈 태그(<x/>, <x> </x>)는 빈 문자열이다 */
export function parseItems(xml: string): Record<string, string>[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => {
    const row: Record<string, string> = {};
    for (const [, tag, value] of body.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) row[tag] = decode(value);
    for (const [, tag] of body.matchAll(/<(\w+)\s*\/>/g)) row[tag] = "";
    return row;
  });
}

export class OpenApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * 응답 헤더를 확인하고 실패면 던진다.
 * - 정상: <resultCode>000</resultCode> (구 API 는 00)
 * - 키·트래픽 오류: <OpenAPI_ServiceResponse> 안의 <returnAuthMsg>·<returnReasonCode>
 */
export function assertOk(xml: string) {
  const auth = tagText(xml, "returnAuthMsg");
  if (auth) throw new OpenApiError(auth, tagText(xml, "returnReasonCode") ?? "AUTH");
  const code = tagText(xml, "resultCode");
  if (code === undefined) throw new OpenApiError("응답 형식을 알 수 없습니다", "PARSE");
  if (code !== "000" && code !== "00") throw new OpenApiError(tagText(xml, "resultMsg") ?? "알 수 없는 오류", code);
}
