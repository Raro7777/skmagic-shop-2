export type OrderStage = "new" | "going" | "done" | "warn";
export type OrderRow = {
  id: string;
  receivedAt: string;
  receivedNote: string;
  receivedNoteTone?: "muted" | "warn" | "urgent";
  customerName: string;
  customerMeta: string;
  product: string;
  gift?: string;
  giftTone?: "orange" | "muted" | "warn";
  rentalPrice: string;
  installSchedule?: string;
  installScheduleMuted?: boolean;
  installScheduleWarn?: boolean;
  stage: OrderStage;
  stageLabel: string;
  rowTone?: "new" | "warn" | "fade";
  actionLabel: string;
  actionTone: "orange" | "navy" | "sale" | "ghost";
};

export const orders: OrderRow[] = [
  {
    id: "o1",
    receivedAt: "5/9 11:42",
    receivedNote: "⏱ 18분 경과",
    receivedNoteTone: "warn",
    customerName: "김소희",
    customerMeta: "010-2***-1782 · 강남구 역삼동",
    product: "PURE+ 자가관리",
    gift: "+ 홈클리너 키트",
    giftTone: "orange",
    rentalPrice: "29,900원",
    installSchedule: "미정",
    installScheduleMuted: true,
    stage: "new",
    stageLabel: "① 신규",
    rowTone: "new",
    actionLabel: "📞 주문확인 전화",
    actionTone: "orange",
  },
  {
    id: "o2",
    receivedAt: "5/9 10:55",
    receivedNote: "⏱ 65분 경과",
    receivedNoteTone: "urgent",
    customerName: "장현주",
    customerMeta: "010-9***-3324 · 서초구 반포",
    product: "안마의자 팔콘 X",
    gift: "+ 설치비 면제",
    giftTone: "orange",
    rentalPrice: "49,900원",
    installSchedule: "미정",
    installScheduleMuted: true,
    stage: "new",
    stageLabel: "① 신규",
    rowTone: "new",
    actionLabel: "📞 주문확인 전화",
    actionTone: "orange",
  },
  {
    id: "o3",
    receivedAt: "5/9 09:18",
    receivedNote: "3시간 전",
    receivedNoteTone: "muted",
    customerName: "박윤진",
    customerMeta: "010-7***-2231 · 송파구 잠실동",
    product: "비데 BIDET PRO",
    gift: "사은품 없음",
    giftTone: "muted",
    rentalPrice: "15,900원",
    installSchedule: "5/12 (월) 오후",
    stage: "going",
    stageLabel: "② 협의중",
    actionLabel: "✍ 일정 확정",
    actionTone: "ghost",
  },
  {
    id: "o4",
    receivedAt: "5/8 16:55",
    receivedNote: "어제",
    receivedNoteTone: "muted",
    customerName: "이수현",
    customerMeta: "010-3***-9012 · 용산구 이촌동",
    product: "공기청정기 32평",
    gift: "+ 여행 캐리어",
    giftTone: "orange",
    rentalPrice: "28,900원",
    installSchedule: "5/11 (일) 14시",
    stage: "going",
    stageLabel: "③ 예약확정",
    actionLabel: "📦 기사 배정",
    actionTone: "navy",
  },
  {
    id: "o5",
    receivedAt: "5/8 14:30",
    receivedNote: "어제",
    receivedNoteTone: "muted",
    customerName: "윤재광",
    customerMeta: "010-8***-4422 · 동작구 상도동",
    product: "PURE+ 자가관리",
    gift: "+ 홈클리너 키트",
    giftTone: "orange",
    rentalPrice: "29,900원",
    installSchedule: "5/10 (토) 10시",
    stage: "going",
    stageLabel: "③ 예약확정",
    actionLabel: "📦 기사 배정",
    actionTone: "navy",
  },
  {
    id: "o6",
    receivedAt: "5/7 19:02",
    receivedNote: "2일 전",
    receivedNoteTone: "muted",
    customerName: "최우재",
    customerMeta: "010-4***-7724 · 종로구 평창동",
    product: "건조기 16kg",
    gift: "설치비 면제",
    giftTone: "muted",
    rentalPrice: "38,900원",
    installSchedule: "5/8 14시",
    stage: "done",
    stageLabel: "④ 설치 완료",
    rowTone: "fade",
    actionLabel: "⭐ 후기 요청",
    actionTone: "ghost",
  },
  {
    id: "o7",
    receivedAt: "5/6 14:20",
    receivedNote: "⚠ 3일 보류",
    receivedNoteTone: "warn",
    customerName: "정이만",
    customerMeta: "010-5***-9912 · 광진구 광장동",
    product: "김치냉장고 313L",
    gift: "고객 연락두절 3회",
    giftTone: "warn",
    rentalPrice: "52,900원",
    installSchedule: "보류",
    installScheduleWarn: true,
    stage: "warn",
    stageLabel: "⚠ 이상",
    rowTone: "warn",
    actionLabel: "📞 재추적",
    actionTone: "sale",
  },
];

export const pipelineStages = [
  { key: "new",   label: "① 신규 접수",     v: 7, hint: "· 30분 이내 응대 약속",  tone: "new"   as const },
  { key: "go1",   label: "② 설치일 협의",   v: 5, hint: "· 고객 일정 확인 중",     tone: "going" as const },
  { key: "go2",   label: "③ 설치예약 확정", v: 7, hint: "· 기사 배정 필요",        tone: "going" as const },
  { key: "done",  label: "④ 설치 완료",     v: 3, hint: "· 이번 주 / 누적 32건",   tone: "done"  as const },
  { key: "warn",  label: "⚠ 이상 / 지연",   v: 2, hint: "· 고객 연락두절 1 / 보류 1", tone: "warn" as const },
];

export type Inquiry = {
  id: string;
  customer: string;
  time: string;
  isUrgent?: boolean;
  message: string;
  status: "new" | "going";
  statusLabel: string;
  actions: { label: string; tone: "navy" | "ghost" }[];
};

export const inquiries: Inquiry[] = [
  {
    id: "q1",
    customer: "정태우",
    time: "⏱ 높은 우선 · 12분 전",
    isUrgent: true,
    message:
      "“PURE+ 자가관리 의무사용 60개월인데 이사가면서 중도 해지하면 위약금 어떻게 계산되나요? 대충 한 달치 정도 남았을 때 기준으로 알려주시면 감사하겠습니다.”",
    status: "new",
    statusLabel: "미응대",
    actions: [
      { label: "⭭ 템플릿: 위약금 안내", tone: "navy" },
      { label: "📞 전화 걸기", tone: "ghost" },
      { label: "✍ 직접 답장", tone: "ghost" },
    ],
  },
  {
    id: "q2",
    customer: "배수정",
    time: "35분 전",
    message: "“방문상담 가능한가요? 5/12 오후 가능해요. 안마의자랑 정수기 같이 고민 중이에요.”",
    status: "going",
    statusLabel: "응답 대기",
    actions: [
      { label: "📅 방문 확정", tone: "navy" },
      { label: "✍ 직접 답장", tone: "ghost" },
    ],
  },
  {
    id: "q3",
    customer: "이하늘",
    time: "1시간 전",
    message: "“이번에 안마의자 보는데 팔콘X랑 팔콘S 차이가 뭐예요? 월요금이랑 의무사용 차이도 궁금해요.”",
    status: "going",
    statusLabel: "응답 대기",
    actions: [
      { label: "⭭ 템플릿: 안마의자 비교표", tone: "navy" },
      { label: "✍ 직접 답장", tone: "ghost" },
    ],
  },
];

export type Memo = {
  id: string;
  time: string;
  title: string;
  detail: string;
  state: "default" | "done" | "warn";
  cta?: { label: string; tone: "navy" | "orange" | "sale" } | null;
};

export const memos: Memo[] = [
  {
    id: "m1",
    time: "5/9 12:30",
    title: "배수정 고객 방문 약속",
    detail: "5/12(월) 14:00 · 안마의자 시연 가능한지 본사 확인 필요",
    state: "default",
    cta: { label: "✓ 확인", tone: "navy" },
  },
  {
    id: "m2",
    time: "5/9 11:50",
    title: "김소희 고객 주문 확인",
    detail: "PURE+ · 설치 희망일 확인 필요",
    state: "default",
    cta: { label: "📞 지금", tone: "orange" },
  },
  {
    id: "m3",
    time: "5/9 09:42",
    title: "이수현 고객 설치 일정 확정",
    detail: "5/11 14시 · 공기청정기 · 완료 ✓",
    state: "done",
    cta: null,
  },
  {
    id: "m4",
    time: "5/6 14:20",
    title: "⚠ 정이만 고객 재추적 필요",
    detail: "김치냉장고 · 3일간 연락 두절 · 주문 취소 위험",
    state: "warn",
    cta: { label: "📞 자동추적", tone: "sale" },
  },
];

export type Product = {
  id: string;
  order: string;
  name: string;
  model: string;
  thumbTone?: "default" | "ice";
  pinned: boolean;
  rental: string;
  rentalNote: string;
  commission: string;
  commissionNote: string;
  reduction: string;
  reductionTone: "orange" | "muted";
  finalReceive: string;
  monthlyCount: string;
  monthlyAmount: string;
  status: "event" | "on" | "off";
  rowTone?: "event" | "fade";
};

export const products: Product[] = [
  {
    id: "p1",
    order: "01",
    name: "올인원 직수 정수기 PURE+",
    model: "WPU-A700C · 자가관리",
    pinned: true,
    rental: "월 29,900원",
    rentalNote: "고정",
    commission: "+₩45,000",
    commissionNote: "대당",
    reduction: "사은품 −₩8,000",
    reductionTone: "orange",
    finalReceive: "실수령 ₩37,000",
    monthlyCount: "14건",
    monthlyAmount: "+₩518k",
    status: "event",
    rowTone: "event",
  },
  {
    id: "p2",
    order: "02",
    name: "에코미니 RO 정수기",
    model: "WPU-M200C · 방문관리 4개월",
    pinned: false,
    rental: "월 35,900원",
    rentalNote: "고정",
    commission: "+₩52,000",
    commissionNote: "대당",
    reduction: "사은품 −₩12,000",
    reductionTone: "orange",
    finalReceive: "실수령 ₩40,000",
    monthlyCount: "9건",
    monthlyAmount: "+₩360k",
    status: "on",
  },
  {
    id: "p3",
    order: "03",
    name: "얼음정수기 ICE COOL",
    model: "WPU-IAC302 · 방문관리 2개월",
    thumbTone: "ice",
    pinned: false,
    rental: "월 42,900원",
    rentalNote: "고정",
    commission: "+₩68,000",
    commissionNote: "대당",
    reduction: "사은품 없음",
    reductionTone: "muted",
    finalReceive: "실수령 ₩68,000",
    monthlyCount: "6건",
    monthlyAmount: "+₩408k",
    status: "on",
  },
  {
    id: "p4",
    order: "04",
    name: "슬림형 정수기 II",
    model: "WPU-S210C · 자가관리",
    pinned: false,
    rental: "월 23,900원",
    rentalNote: "고정",
    commission: "+₩32,000",
    commissionNote: "대당",
    reduction: "설치비 면제 −₩30,000",
    reductionTone: "orange",
    finalReceive: "실수령 ₩2,000",
    monthlyCount: "4건",
    monthlyAmount: "+₩8k",
    status: "on",
  },
  {
    id: "p5",
    order: "—",
    name: "한뼘 정수기 자가관리",
    model: "WPU-X120C · 단종 예정",
    pinned: false,
    rental: "월 19,900원",
    rentalNote: "단종 예정",
    commission: "—",
    commissionNote: "",
    reduction: "—",
    reductionTone: "muted",
    finalReceive: "",
    monthlyCount: "—",
    monthlyAmount: "",
    status: "off",
    rowTone: "fade",
  },
];

export type BannerItem = {
  id: string;
  when: string;
  c1: string;
  c2: string;
  title: string;
  meta: string;
  fromHQ?: boolean;
  state: "live" | "sched" | "draft";
  fade?: boolean;
};

export const banners: BannerItem[] = [
  {
    id: "b1",
    when: "5/12 0시\n~5/19 24시",
    c1: "#F26A1F", c2: "#D8521A",
    title: "어버이날 효도 패키지 (본사 일괄)",
    meta: "HERO 슬라이드 #1 · 정수기·안마의자 묶음",
    fromHQ: true,
    state: "sched",
  },
  {
    id: "b2",
    when: "상시",
    c1: "#1A2A52", c2: "#2D3F6E",
    title: "친절상담 약속 배너 (본사 공통)",
    meta: "HERO 우측 카드 · 평균 응답 18분 강조",
    fromHQ: true,
    state: "live",
  },
  {
    id: "b3",
    when: "5/9 ~\n5/31",
    c1: "#1F8A5B", c2: "#0E7A4B",
    title: "친구 초대 5,000원 적립 (협력점 자체)",
    meta: "HERO 슬라이드 #3 · 강남센터 한정",
    state: "live",
  },
  {
    id: "b4",
    when: "5/15\n10:00 예약",
    c1: "#1F5FB4", c2: "#0E1A37",
    title: "스승의 날 단골 감사 쿠폰",
    meta: "HERO 슬라이드 #4 · 기존 가입자 한정",
    state: "sched",
  },
  {
    id: "b5",
    when: "미정",
    c1: "#999", c2: "#666",
    title: "건조기 폭탄세일 — 5월 말",
    meta: "HERO 미배정 · 초안",
    state: "draft",
    fade: true,
  },
];

/* ============ Policy editor ============ */
export const COMMISSION = 45000;
export const LIMIT_RATIO = 2 / 3;
export const LIMIT = Math.floor(COMMISSION * LIMIT_RATIO); // 30,000
export const MONTHLY_UNITS = 14;

export const giftOptions = [
  { value: 0,     label: "없음" },
  { value: 3000,  label: "물병세트" },
  { value: 8000,  label: "홈클리너 키트" },
  { value: 28000, label: "여행용 캐리어 20인치" },
];
