// 영업자 sellerCode 는 정규화된 전화번호.
// URL 경로(/p/[code]/s/[sellerCode]) 에 그대로 들어가므로
// 하이픈 포함 형태로 통일하여 가독성 + sellerCode 룰(^[a-z0-9-]{2,32}$) 모두 만족.
//
// 입력 허용: "010-1234-5678" / "01012345678" / "010 1234 5678" / "+82 10-1234-5678"
// 출력: "010-1234-5678" (또는 02-XXX-XXXX, 0XX-XXX-XXXX)

export function normalizeKoreanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  // +82 국가코드 제거 (10 자리 만)
  let n = digits;
  if (n.startsWith("82") && n.length >= 11) n = "0" + n.slice(2);
  if (n.startsWith("0082")) n = "0" + n.slice(4);

  // 휴대폰 010/011/016/017/018/019
  if (/^01[016789]\d{7,8}$/.test(n)) {
    const mid = n.length === 11 ? n.slice(3, 7) : n.slice(3, 6);
    const tail = n.length === 11 ? n.slice(7) : n.slice(6);
    return `${n.slice(0, 3)}-${mid}-${tail}`;
  }
  // 서울 02
  if (/^02\d{7,8}$/.test(n)) {
    const body = n.slice(2);
    const mid = body.length === 8 ? body.slice(0, 4) : body.slice(0, 3);
    const tail = body.length === 8 ? body.slice(4) : body.slice(3);
    return `02-${mid}-${tail}`;
  }
  // 지역번호 0XX (3자리)
  if (/^0\d{2}\d{7,8}$/.test(n)) {
    const area = n.slice(0, 3);
    const body = n.slice(3);
    const mid = body.length === 8 ? body.slice(0, 4) : body.slice(0, 3);
    const tail = body.length === 8 ? body.slice(4) : body.slice(3);
    return `${area}-${mid}-${tail}`;
  }
  return null;
}
