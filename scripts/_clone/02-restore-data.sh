#!/bin/bash
# skmagic-shop-2 복제 — Phase 2 데이터 restore 스크립트.
#
# 새 Neon DB 에:
#   1. prisma db push 로 schema 적용 (현재 schema.prisma 기준)
#   2. /tmp/skmagic-shop-2-data.sql 의 data import
#
# 사용법:
#   TARGET_DB_URL="postgresql://USER:PASS@HOST/DB?sslmode=require" ./scripts/_clone/02-restore-data.sh

set -euo pipefail

if [ -z "${TARGET_DB_URL:-}" ]; then
  echo "❌ TARGET_DB_URL 환경변수 필요 (새 Neon DATABASE_URL_UNPOOLED)"
  echo "   예: TARGET_DB_URL=\"postgresql://...\" ./scripts/_clone/02-restore-data.sh"
  exit 1
fi

DUMP="/tmp/skmagic-shop-2-data.sql"
if [ ! -f "$DUMP" ]; then
  echo "❌ $DUMP 없음 — 01-dump-data.sh 먼저 실행"
  exit 1
fi

MASKED=$(echo "$TARGET_DB_URL" | sed 's|postgresql://[^@]*@|postgresql://***@|')
echo "▶ 새 Neon DB 에 schema 적용 + 데이터 import"
echo "  대상: $MASKED"
echo ""

# 1) prisma db push 로 schema 동기화 (현재 prisma/schema.prisma 기준)
echo "[1/3] prisma db push — schema 생성 (~30초)"
npx prisma db push --url "$TARGET_DB_URL" --accept-data-loss

# 2) data import
echo ""
echo "[2/3] data import (~수 분, 데이터 크기에 따라)"
psql "$TARGET_DB_URL" -f "$DUMP" -v ON_ERROR_STOP=1 -q

# 3) row count 검증
echo ""
echo "[3/3] row count 검증"
psql "$TARGET_DB_URL" -c "
SELECT
  (SELECT count(*) FROM \"Partner\") AS partners,
  (SELECT count(*) FROM \"Product\") AS products,
  (SELECT count(*) FROM \"HqPolicy\") AS hq_policies,
  (SELECT count(*) FROM \"Lead\") AS leads,
  (SELECT count(*) FROM \"User\") AS users,
  (SELECT count(*) FROM \"Banner\") AS banners;
"

echo ""
echo "✅ restore 완료. 양쪽 DB row count 비교해서 일치 확인."
