export type Approval = {
  id: string; kind: string; time: string;
  title: string; body: string;
  buttons: { label: string; tone: "ok" | "no" | "view" }[];
};

export const approvals: Approval[] = [
  {
    id: "a1", kind: "신규 협력점 가입", time: "5/9 11:42",
    title: "송파센터 SK매직 (가칭)",
    body: "신청자: 정태현 · 사업자 등록증 ✓ · SK매직 인증코드 ✓ · 보증금 ✓",
    buttons: [{ label: "상세", tone: "view" }, { label: "승인", tone: "ok" }],
  },
  {
    id: "a2", kind: "판매수수료 인상 요청", time: "5/9 09:11",
    title: "강남센터 SK매직 — PURE+ 수수료 ₩45,000 → ₩48,000 (대당)",
    body: "사유: \"세트 사은품 행사 대응\" · 해당 협력점만 한정 적용 신청",
    buttons: [{ label: "상세", tone: "view" }, { label: "반려", tone: "no" }, { label: "승인", tone: "ok" }],
  },
  {
    id: "a3", kind: "정산 이의제기", time: "5/8 18:30",
    title: "부산해운대 코웨이 — 4월 정산 누락 1건",
    body: "주문 #2024-0428-0312 · 설치완료 처리 누락 · 금액 ₩148,000",
    buttons: [{ label: "상세", tone: "view" }, { label: "처리", tone: "ok" }],
  },
  {
    id: "a4", kind: "브랜드 입점 신청", time: "5/8 14:02",
    title: "바디프렌드 본사 → 안마의자 카테고리 입점 요청",
    body: "제휴 모델 4종 · 본사 권장 수수료 6.5% 제안 · 계약서 첨부됨",
    buttons: [{ label: "검토", tone: "view" }],
  },
];

export type Region = {
  name: string; gmv: string; meta: string;
  heat?: "hot" | "warm" | "cold";
};

export const regions: Region[] = [
  { name: "서울",   gmv: "₩ 412M", meta: "14개 점 · ▲ 22%", heat: "hot" },
  { name: "경기",   gmv: "₩ 308M", meta: "11개 점 · ▲ 18%", heat: "hot" },
  { name: "인천",   gmv: "₩ 92M",  meta: "3개 점 · ▲ 9%",   heat: "warm" },
  { name: "부산",   gmv: "₩ 148M", meta: "4개 점 · ▲ 12%",  heat: "warm" },
  { name: "대구",   gmv: "₩ 82M",  meta: "2개 점 · ▲ 6%" },
  { name: "대전",   gmv: "₩ 64M",  meta: "2개 점 · ▲ 4%" },
  { name: "광주",   gmv: "₩ 48M",  meta: "2개 점 · ▼ 2%" },
  { name: "울산",   gmv: "₩ 38M",  meta: "1개 점 · ▲ 5%" },
  { name: "충청권", gmv: "₩ 42M",  meta: "2개 점 · ▲ 3%" },
  { name: "전라권", gmv: "₩ 26M",  meta: "1개 점 · ▼ 1%" },
  { name: "경북",   gmv: "₩ 14M",  meta: "0개 점 · 신규모집" },
  { name: "제주",   gmv: "미진출", meta: "진출 필요", heat: "cold" },
];

export type Dealer = {
  rank: string; name: string; loc: string;
  gmv: string; pct: number; status: "live" | "warn" | "stop";
  statusLabel: string;
  topRank?: boolean;
  rowTone?: "warm" | "bad";
};

export const dealers: Dealer[] = [
  { rank: "1", name: "강남센터 SK매직", loc: "서울 · 박지민",  gmv: "31.2M", pct: 89, status: "live", statusLabel: "정상", topRank: true },
  { rank: "2", name: "해운대 코웨이",   loc: "부산 · 김선아",  gmv: "28.4M", pct: 81, status: "live", statusLabel: "정상", topRank: true },
  { rank: "3", name: "분당 청호나이스", loc: "경기 · 한경수",  gmv: "26.1M", pct: 75, status: "live", statusLabel: "정상", topRank: true },
  { rank: "4", name: "일산 LG헬로",     loc: "경기 · 윤서희",  gmv: "22.8M", pct: 65, status: "live", statusLabel: "정상" },
  { rank: "5", name: "마포 SK매직",     loc: "서울 · 정현우",  gmv: "19.6M", pct: 56, status: "live", statusLabel: "정상" },
  { rank: "40", name: "광주 위니아",     loc: "광주 · 조민혁",  gmv: "2.1M",  pct: 6,  status: "warn", statusLabel: "부진",   rowTone: "warm" },
  { rank: "41", name: "대구중구 코웨이", loc: "대구 · 임선영",  gmv: "0.9M",  pct: 3,  status: "stop", statusLabel: "관리필요", rowTone: "bad" },
  { rank: "42", name: "전주 청호나이스", loc: "전북 · 노재호",  gmv: "0.4M",  pct: 1,  status: "stop", statusLabel: "휴면주의", rowTone: "bad" },
];

export type Anomaly = {
  id: string; kind: "price" | "response" | "sales" | "resolved";
  kindLabel: string;
  dealer: string; person: string;
  desc: string; when: string;
  cta: string;
  ctaTone: "pri" | "ghost";
  fade?: boolean;
};

export const anomalies: Anomaly[] = [
  {
    id: "x1", kind: "price", kindLabel: "⚠ 가격",
    dealer: "대구중구 코웨이", person: "임선영",
    desc: "본사 권장가 대비 −7,200원 (한도 −5,000원 초과)",
    when: "4시간 전", cta: "가격 잠금", ctaTone: "pri",
  },
  {
    id: "x2", kind: "response", kindLabel: "📞 응대",
    dealer: "전주 청호나이스", person: "노재호",
    desc: "카톡 상담 미응답 12건 · 평균 6시간 30분",
    when: "2시간 전", cta: "알림 발송", ctaTone: "pri",
  },
  {
    id: "x3", kind: "sales", kindLabel: "📊 매출",
    dealer: "광주 위니아", person: "조민혁",
    desc: "일 매출 7일 연속 평균의 30% 이하",
    when: "오늘", cta: "CS 배정", ctaTone: "pri",
  },
  {
    id: "x4", kind: "resolved", kindLabel: "✓ 해결",
    dealer: "인천부평 SK매직", person: "최우진",
    desc: "주문 처리 지연 2건 → 본사 직접 처리 완료",
    when: "어제", cta: "로그", ctaTone: "ghost", fade: true,
  },
];

export const policyRows = [
  { name: "기본 판매수수료",      desc: "협력점이 1대 팔면 받는 기본 금액 (정수기 카테고리)", val: "+₩40,000" },
  { name: "5월 인센티브",         desc: "이번 달 추가 지급 (대당, 5/15까지)",                val: "+₩5,000"  },
  { name: "사은품 환원 한도",     desc: "협력점이 수수료 중 고객에게 돌려줄 수 있는 최대 폭",  val: "수수료의 ⅔" },
  { name: "설치비 보조",          desc: "본사가 협력점에 지급하는 대당 설치보조",              val: "₩30,000"  },
  { name: "의무 사용기간 (정수기)", desc: "전 협력점 공통 약정 — 협력점 변경 불가",            val: "60개월"   },
  { name: "중도해지 위약금률",     desc: "잔여기간 렌탈료의 % — 표준 표시 의무",                val: "35%"      },
];

export type SettlementRow = {
  name: string; person: string;
  units: string; gmv: string; commission: string; payout: string;
  status: "info" | "warn"; statusLabel: string;
  isTotal?: boolean;
};

export const settlements: SettlementRow[] = [
  { name: "강남센터 SK매직", person: "박지민", units: "42",  gmv: "31,240,000", commission: "−2,124,000", payout: "29,116,000", status: "info", statusLabel: "검증완료" },
  { name: "해운대 코웨이",   person: "김선아", units: "38",  gmv: "28,400,000", commission: "−1,932,000", payout: "26,468,000", status: "info", statusLabel: "검증완료" },
  { name: "분당 청호나이스", person: "한경수", units: "33",  gmv: "26,100,000", commission: "−1,776,000", payout: "24,324,000", status: "warn", statusLabel: "이의신청" },
  { name: "일산 LG헬로",     person: "윤서희", units: "29",  gmv: "22,800,000", commission: "−1,550,000", payout: "21,250,000", status: "info", statusLabel: "검증완료" },
  { name: "합계 (42개점)",   person: "",       units: "1,842", gmv: "1,284,000,000", commission: "−92,400,000", payout: "1,191,600,000", status: "info", statusLabel: "최종 D-6", isTotal: true },
];

export type Broadcast = {
  id: string; tone: "default" | "urgent" | "event";
  badge: string; date: string; reads: string;
  title: string; body: string; reach: string;
};

export const broadcasts: Broadcast[] = [
  {
    id: "bc1", tone: "urgent",
    badge: "🚨 긴급 정책", date: "5/9 발송", reads: "읽음 38/42",
    title: "정수기 카테고리 판매수수료 ₩40,000 → ₩45,000 인상 (5/12 적용)",
    body: "5월 가정의 달 대응 인센티브. 월 렌탈료(29,900원)는 전국 동일 유지.",
    reach: "📊 영향 협력점 42 / 영향 상품 184건",
  },
  {
    id: "bc2", tone: "event",
    badge: "🎁 이벤트", date: "예약 5/12 0시", reads: "전 협력점",
    title: "어버이날 효도 패키지 (본사 일괄 가격 잠금)",
    body: "5/12 0시 ~ 5/19 24시. 기간 중 사은품 환원 일시 잠금. HERO 슬라이드 자동 배치.",
    reach: "📊 노출 예정 협력점 42 / 적용 상품 12종",
  },
  {
    id: "bc3", tone: "default",
    badge: "📦 마스터 업데이트", date: "5/8", reads: "읽음 42/42 ✓",
    title: "SK매직 PURE+ 신모델 등록 (WPU-A700C)",
    body: "각 SK매직 인증점에서 진열 추가 가능. 본사 권장가 31,900원.",
    reach: "📊 적용 협력점 18 (SK매직 인증점)",
  },
  {
    id: "bc4", tone: "default",
    badge: "📦 신상품 입고", date: "5/8", reads: "읽음 42/42 ✓",
    title: "여름 사은품 카탈로그 업데이트 (12종 추가)",
    body: "여행용 캐리어, 휴대용 선풍기, 캠핑체어 추가. 협력점 사은품 환원 선택지 확대.",
    reach: "📊 카탈로그 사용 협력점 39 / 42",
  },
];
