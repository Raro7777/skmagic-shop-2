#!/usr/bin/env bash
# 6월 타사보상 스크립트를 2번 DB 에 적용. 1번 작업과 동일한 변경.
set -euo pipefail
export DATABASE_URL='postgresql://neondb_owner:npg_lXZuHR1ykc4q@ep-solitary-mouse-aozju89o-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
cd "$(dirname "$0")/../.."
npx tsx scripts/apply-rival-compensation-june-2026.ts
