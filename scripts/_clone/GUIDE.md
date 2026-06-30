# skmagic-shop-2 클론 셋업 가이드

원본: https://skmagic-shop.com (rentking-next + 우성종합통신)
클론: https://skmagic-shop-2.vercel.app (예정, 도메인 추후 추가)

## ✅ 완료
- [x] GitHub 새 리포: `Raro7777/skmagic-shop-2` (코드 push 완료)

## 사용자 직접 진행할 단계

### 1. Neon 새 계정/프로젝트 (5분)
1. https://console.neon.tech 새 계정 (또는 다른 계정 로그인)
2. New Project 생성 — 이름: `skmagic-shop-2`, region: us-east-1 (서울 가까운 곳도 OK)
3. Dashboard → Connection Details → `postgresql://...` 두 줄 복사
   - Pooled connection → `DATABASE_URL`
   - Direct connection → `DATABASE_URL_UNPOOLED`
4. 두 URL 저한테 공유 (또는 secrets 매니저에 보관)

### 2. Vercel 새 프로젝트 (5분)
1. https://vercel.com → Add New Project
2. Import `Raro7777/skmagic-shop-2` GitHub 리포 연결
3. Build settings 기본값 그대로 (Next.js 자동 인식)
4. Environment Variables — `scripts/_clone/env.example` 참고해 입력
   - **DATABASE_URL** (필수, 1번에서 받은 값)
   - **DATABASE_URL_UNPOOLED**
   - **AUTH_SECRET** (새로 발급: `openssl rand -base64 32` 결과)
   - **TELEGRAM_BOT_TOKEN** (원본 Vercel env 에서 복사)
   - **TELEGRAM_CHAT_ID_HQ** (3번에서 받음, 일단 비워두고 추후 입력 가능)
   - **RESEND_API_KEY** (원본에서 복사)
   - **RESEND_FROM** (`Rentking <noreply@skmagic-shop.com>` — 새 도메인 verify 후 변경)
   - **EMAIL_PROVIDER** = `resend`
5. Deploy — 첫 deploy 는 DB schema 없어서 일부 페이지 에러 가능. 다음 단계에서 schema 적용 후 정상화.

### 3. Vercel Blob store 별도 생성 (3분)
1. Vercel 새 프로젝트 → Storage 탭 → Create
2. Blob 선택 → 이름: `skmagic-shop-2-blob`
3. Connect to Project — 자동으로 `BLOB_READ_WRITE_TOKEN` env 추가됨

### 4. Telegram 새 chat 셋업 (3분)
1. 텔레그램 모바일/PC 앱에서 **새 그룹 또는 채널 생성** (혼자만 들어가도 OK)
2. `@SKmagicShopBot` 봇을 그룹에 초대 (관리자 권한)
3. 그룹에서 `/start` 메시지 전송
4. 봇이 chat_id 를 회신 (예: `-1001234567890`)
5. 이 값을 Vercel env `TELEGRAM_CHAT_ID_HQ` 에 입력

### 5. Resend (선택 — 도메인 추가 후)
새 도메인 추가 전에는 기존 `noreply@skmagic-shop.com` 도메인 그대로 사용 가능. 새 도메인 추가 후:
1. https://resend.com → Domains → Add Domain
2. 새 도메인 DNS 설정 (SPF/DKIM)
3. `RESEND_FROM` 값을 새 도메인 기반 주소로 변경

## 제가 진행할 단계 (사용자 입력 받은 후)

### 6. DB schema + data 이관
```bash
# 6a. 원본 DB → SQL dump
./scripts/_clone/01-dump-data.sh

# 6b. 새 Neon DB 에 schema + data
TARGET_DB_URL="postgresql://새_Neon_URL" ./scripts/_clone/02-restore-data.sh

# 6c. 양쪽 row count 비교 검증
```

### 7. 검증
- 새 Vercel preview URL 접속 → 메인 페이지 + 협력점 페이지 200 OK
- 새 텔레그램 채팅에서 테스트 lead 알림 수신 확인
- ops-data-auditor 재실행 — 새 DB 무결성

## 사용자 즉시 액션

다음 3가지 중 가장 먼저 가능한 것부터 진행 + 결과 공유:

1. **Neon 새 프로젝트 생성** → 두 connection URL 공유
2. **Vercel 새 프로젝트 import** (env 일부는 추후 입력 OK)
3. **Telegram 새 채팅 + chat_id 받기**

1번이 가장 우선 (DB 가 있어야 다른 단계가 의미 있음).
