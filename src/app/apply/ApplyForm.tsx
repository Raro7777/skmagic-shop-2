"use client";

import { useState } from "react";

const PLANS = ["베이직 (월 ₩30,000)", "스탠다드 (월 ₩50,000)", "프리미엄 (월 ₩80,000)", "상담 후 결정"];
const TEAM_SIZES = ["나 혼자 (1인)", "2~3명", "4~9명", "10명 이상", "회사 형태로 운영 중"];
const BRANDS = ["SK매직만", "SK매직 + 코웨이", "SK매직 + 청호나이스", "다브랜드 (모두)"];

type Done = { applicationId: string; message: string };

export default function ApplyForm() {
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [commerceNumber, setCommerceNumber] = useState("");
  const [hotlineNumber, setHotlineNumber] = useState("");
  const [brands, setBrands] = useState(BRANDS[0]);
  const [team, setTeam] = useState(TEAM_SIZES[0]);
  const [plan, setPlan] = useState(PLANS[1]);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const reset = () => {
    setName(""); setStore(""); setPhone(""); setEmail(""); setRegion("");
    setAddress(""); setBusinessNumber(""); setCommerceNumber(""); setHotlineNumber("");
    setBrands(BRANDS[0]); setTeam(TEAM_SIZES[0]); setPlan(PLANS[1]); setMemo("");
    setError(null); setDone(null); setBusy(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !store.trim() || !phone.trim() || !businessNumber.trim() || !address.trim()) {
      setError("이름·상호명·휴대폰·사업자번호·사업장 주소는 필수입니다.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || !digits.startsWith("010")) {
      setError("휴대폰은 010으로 시작하는 11자리여야 합니다.");
      return;
    }
    // 사업자번호 — 10자리 숫자 (123-45-67890 / 1234567890 형태 모두 허용)
    const bizDigits = businessNumber.replace(/\D/g, "");
    if (bizDigits.length !== 10) {
      setError("사업자번호는 10자리 숫자여야 합니다 (예: 123-45-67890).");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicantName: name,
          storeName: store,
          phone: digits,
          email,
          region,
          address,
          businessNumber: businessNumber.trim(),
          commerceNumber: commerceNumber.trim(),
          hotlineNumber: hotlineNumber.trim(),
          brandsOfInterest: brands,
          teamSize: team,
          plan,
          memo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "접수 실패");
      } else {
        setDone(data);
      }
    } catch {
      setError("네트워크 오류 — 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-rk-tint-green border border-[#C8E5D6] rounded-lg p-8 text-center">
        <div className="text-[40px] mb-3">✅</div>
        <h3 className="text-[20px] font-bold text-rk-success mb-1">분양 신청이 접수됐습니다</h3>
        <p className="text-[13px] text-rk-text leading-[1.6] m-0 mb-4">{done.message}</p>
        <div className="bg-white border border-rk-line-2 rounded p-3 text-[12px] text-left mb-4 max-w-[400px] mx-auto">
          <div className="flex justify-between text-rk-muted">
            <span>접수번호</span>
            <span className="font-mono text-rk-ink">{done.applicationId.slice(-12)}</span>
          </div>
          <div className="flex justify-between text-rk-muted mt-1">
            <span>처리 상태</span>
            <span className="text-rk-info">본사 검토 대기 (pending)</span>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="bg-rk-soft text-rk-text border-0 px-4 py-2 rounded text-[12px] cursor-pointer"
        >
          새 신청 작성
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border border-rk-line rounded-lg p-6 md:p-8">
      <h3 className="text-[20px] font-bold text-rk-ink mb-1.5 tracking-[-.01em]">📝 분양 신청서</h3>
      <p className="text-[14px] text-rk-text m-0 mb-5 leading-[1.6]">
        모든 항목 작성 후 제출 — 본사 운영팀 검토 후 1~2 영업일 내 연락드립니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="신청자 이름" required>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" className={INPUT} />
        </Field>
        <Field label="상호명 / 가칭" required>
          <input value={store} onChange={e => setStore(e.target.value)} placeholder="○○센터 SK매직" className={INPUT} />
        </Field>
        <Field label="휴대폰" required>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-1234-5678" inputMode="tel" className={INPUT + " rk-num"} />
        </Field>
        <Field label="이메일">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@example.com" className={INPUT} />
        </Field>
        <Field label="운영 희망 지역">
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="예) 서울 강남구 / 경기 부천시" className={INPUT} />
        </Field>
        <Field label="사업자번호" required>
          <input value={businessNumber} onChange={e => setBusinessNumber(e.target.value)} placeholder="123-45-67890" inputMode="numeric" className={INPUT + " rk-num"} />
        </Field>
        <Field label="통신판매번호">
          <input value={commerceNumber} onChange={e => setCommerceNumber(e.target.value)} placeholder="제2026-서울강남-1234호 (없으면 비워두세요)" className={INPUT} />
        </Field>
        <Field label="협력점 고객센터 번호">
          <input value={hotlineNumber} onChange={e => setHotlineNumber(e.target.value)} placeholder="02-1234-5678 (없으면 비워두세요)" inputMode="tel" className={INPUT + " rk-num"} />
        </Field>
        <Field label="관심 브랜드">
          <select value={brands} onChange={e => setBrands(e.target.value)} className={INPUT}>
            {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="자체 영업조직 규모">
          <select value={team} onChange={e => setTeam(e.target.value)} className={INPUT}>
            {TEAM_SIZES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="희망 분양 패키지">
          <select value={plan} onChange={e => setPlan(e.target.value)} className={INPUT}>
            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="사업장 주소" required>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="예) 서울특별시 강남구 테헤란로 123, 5층" maxLength={200} className={INPUT} />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="문의 / 메모">
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="자유롭게 남겨주세요 — 기존 영업 경험·궁금한 점 등"
            rows={3}
            className={INPUT + " resize-none"}
          />
        </Field>
      </div>

      <div className="text-[12px] text-rk-text leading-[1.6] mt-3">
        ⓘ 신청 시 <a href="/legal/privacy" className="text-rk-info underline font-medium">개인정보 수집·이용</a>에 동의한 것으로 간주합니다 (3년 보유 후 자동 익명화).
      </div>

      {error && (
        <div className="bg-rk-tint-red text-rk-sale text-[13px] px-3 py-2 rounded mt-3 font-medium">⚠ {error}</div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full mt-5 bg-rk-orange hover:bg-rk-orange-deep disabled:bg-rk-muted text-white border-0 py-3.5 rounded text-[15px] font-semibold cursor-pointer transition-colors"
      >
        {busy ? "접수 중…" : "분양 신청서 제출"}
      </button>
    </form>
  );
}

const INPUT =
  "w-full px-3 py-2.5 border border-rk-line rounded text-[14px] outline-none focus:border-rk-navy bg-white text-rk-ink placeholder:text-rk-faint";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] text-rk-ink mb-1.5 font-semibold">
        {label}
        {required && <span className="text-rk-sale ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
