import { randomBytes } from "crypto";

// URL 식별자(/p/[code]/s/<sellerCode>)용 — 12자리 영문 소문자 + 숫자.
// 협력점/영업자가 직접 외울 필요 없는 랜덤 코드. 충돌 공간 36^12 ≈ 4.7×10^18.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateSellerCode(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
