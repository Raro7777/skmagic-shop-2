#!/bin/bash
# skmagic-shop-2 복제 — Phase 2 데이터 dump 스크립트.
#
# 원본 Neon DB → SQL data dump 생성.
# Schema 는 prisma db push 로 새 DB 에 직접 적용 (수동 SQL 적용 X).
#
# 사용법:
#   1. .env.local 의 DATABASE_URL_UNPOOLED 가 채워져 있어야 함 (Neon pooled X)
#   2. ./scripts/_clone/01-dump-data.sh
#   3. /tmp/skmagic-shop-2-data.sql 생성됨 (~ 수MB)
#
# 다음 단계 (02-restore-data.sh) 에서 새 Neon DB 로 import.

set -euo pipefail

# .env.local 에서 unpooled connection string 추출
SOURCE_URL=$(grep "^DATABASE_URL_UNPOOLED=" .env.local | head -1 | cut -d'=' -f2- | tr -d '"')
if [ -z "$SOURCE_URL" ]; then
  echo "❌ DATABASE_URL_UNPOOLED 못 찾음 — .env.local 확인"
  exit 1
fi

OUTPUT="/tmp/skmagic-shop-2-data.sql"

echo "▶ 원본 DB → $OUTPUT"
echo "  대상 DB: $(echo "$SOURCE_URL" | sed 's|postgresql://[^@]*@|postgresql://***@|')"

# data-only dump (schema 는 prisma db push 로 별도 적용)
# --no-owner --no-privileges: 새 DB 의 owner/grant 와 충돌 회피
# --column-inserts: portable 한 INSERT 문 (COPY 보다 느리지만 호환성 ↑)
# --disable-triggers: data restore 시 FK 충돌 회피 (마지막에 활성화)
# 제외할 테이블 — Prisma migration 메타 (_prisma_migrations) 는 새 DB 에 자동 생성됨
pg_dump "$SOURCE_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  --schema=public \
  --exclude-table='_prisma_migrations' \
  -f "$OUTPUT"

SIZE=$(wc -c < "$OUTPUT" | tr -d ' ')
LINES=$(wc -l < "$OUTPUT" | tr -d ' ')
echo "✅ dump 완료: $OUTPUT (${SIZE} bytes, ${LINES} lines)"
echo ""
echo "다음: 02-restore-data.sh 실행 (새 Neon DATABASE_URL 필요)"
