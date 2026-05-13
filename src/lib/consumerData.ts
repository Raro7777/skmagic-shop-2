export type RankItem = {
  id: string; rank: number; isTop: boolean;
  bg: string; brand: string; name: string; model: string;
  tags: string[]; price: string; strike?: string;
  cardPrice: string; extraNote?: string;
};

export const rankings: RankItem[] = [
  {
    id: "r1", rank: 1, isTop: true,
    bg: "linear-gradient(160deg,#D8E2F0,#A4B4D0)",
    brand: "SK매직",
    name: "올인원 직수 정수기 PURE+ (자가관리)",
    model: "WPU-A700C",
    tags: ["의무 60개월", "자가관리", "3종 사은품", "무료설치"],
    price: "29,900", strike: "39,900원",
    cardPrice: "21,900", extraNote: "36개월 무이자",
  },
  {
    id: "r2", rank: 2, isTop: true,
    bg: "linear-gradient(160deg,#E0E5EF,#B8C0D2)",
    brand: "SK매직",
    name: "에코미니 RO 정수기 (방문관리)",
    model: "WPU-M200C",
    tags: ["의무 60개월", "4개월 방문", "MD추천"],
    price: "35,900", strike: "42,900원",
    cardPrice: "27,900",
  },
  {
    id: "r3", rank: 3, isTop: false,
    bg: "linear-gradient(160deg,#DEE6F2,#9FB0CC)",
    brand: "SK매직",
    name: "얼음정수기 ICE COOL (방문관리)",
    model: "WPU-IAC302",
    tags: ["의무 60개월", "2개월 방문", "1+1 컵세트"],
    price: "42,900", strike: "49,900원",
    cardPrice: "33,900",
  },
  {
    id: "r4", rank: 4, isTop: false,
    bg: "linear-gradient(160deg,#E8EBF2,#C2C8D6)",
    brand: "SK매직",
    name: "슬림형 정수기 슬림 II (자가관리)",
    model: "WPU-S210C",
    tags: ["의무 36개월", "자가관리"],
    price: "23,900",
    cardPrice: "18,900",
  },
];

export type ManagerPick = {
  id: string; bg: string;
  badges: { label: string; tone: "gift" | "new" | "sale" | "save" | "md" }[];
  brand: string; name: string; model: string;
  rentMonth: string; cardMonth: string;
  tags: string[]; rating: string; reviews: string;
};

export const managerPicks: ManagerPick[] = [
  {
    id: "m1", bg: "linear-gradient(160deg,#F0E5DA,#D6BFA8)",
    badges: [{ label: "사은품", tone: "gift" }, { label: "12개월 반값", tone: "sale" }],
    brand: "SK매직", name: "비데 BIDET PRO 자가관리", model: "BID-S17D",
    rentMonth: "15,900원~", cardMonth: "9,900원",
    tags: ["의무 60", "자가관리", "전국 무료설치"],
    rating: "★ 4.8", reviews: "후기 1,422",
  },
  {
    id: "m2", bg: "linear-gradient(160deg,#E5EAEF,#B8C2CD)",
    badges: [{ label: "NEW", tone: "new" }],
    brand: "SK매직", name: "공기청정기 ALL CLEAN 32평형", model: "ACL-32D",
    rentMonth: "28,900원~", cardMonth: "21,950원",
    tags: ["의무 36", "4개월 방문"],
    rating: "★ 4.9", reviews: "후기 612",
  },
  {
    id: "m3", bg: "linear-gradient(160deg,#DEE5F0,#A8B5CC)",
    badges: [{ label: "SAVE 30%", tone: "save" }],
    brand: "SK매직", name: "의류건조기 16kg 인버터", model: "DRY-16IV",
    rentMonth: "38,900원~", cardMonth: "29,900원",
    tags: ["의무 60", "자가관리"],
    rating: "★ 4.7", reviews: "후기 234",
  },
  {
    id: "m4", bg: "linear-gradient(160deg,#F0E8E0,#D0BFAE)",
    badges: [{ label: "MD추천", tone: "md" }],
    brand: "SK매직", name: "식기세척기 12인용 빌트인", model: "DWA-12BI",
    rentMonth: "31,900원~", cardMonth: "24,900원",
    tags: ["의무 60", "방문관리"],
    rating: "★ 4.8", reviews: "후기 188",
  },
];

export type Review = {
  id: string; stars: number; title: string; body: string;
  who: string; ago: string; model: string;
};

export const consumerReviews: Review[] = [
  {
    id: "rv1", stars: 5,
    title: "설치기사님 친절하시고 가격도 좋아요",
    body: "다른 매장 견적도 받아봤는데 카드할인가가 제일 좋았어요. 사은품도 3종 전부 받았습니다. 정수기 PURE+ 만족합니다.",
    who: "김**", ago: "2일 전", model: "WPU-A700C",
  },
  {
    id: "rv2", stars: 5,
    title: "방문상담 받고 결정했어요",
    body: "매니저님이 집까지 오셔서 자가관리/방문관리 차이 설명해주시고 저희 가족 인원수에 맞게 추천해주셨어요. 의무사용 60개월이지만 합리적이라 결정.",
    who: "이**", ago: "5일 전", model: "BID-S17D",
  },
];
