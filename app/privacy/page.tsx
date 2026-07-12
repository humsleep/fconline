import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "FC Scope 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-1 text-sm text-muted">시행일: 2026년 7월 15일</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-bold">1. 수집하는 개인정보와 목적</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-semibold">항목</th>
                  <th className="py-2 pr-3 font-semibold">수집 시점</th>
                  <th className="py-2 font-semibold">목적</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <tr className="border-b border-line/60">
                  <td className="py-2 pr-3">이메일, Google 계정 식별자</td>
                  <td className="py-2 pr-3">Google 로그인 시</td>
                  <td className="py-2">회원 식별, 커뮤니티 이용</td>
                </tr>
                <tr className="border-b border-line/60">
                  <td className="py-2 pr-3">닉네임</td>
                  <td className="py-2 pr-3">프로필 등록 시</td>
                  <td className="py-2">커뮤니티 활동 표시</td>
                </tr>
                <tr className="border-b border-line/60">
                  <td className="py-2 pr-3">FC온라인 구단주명·계정 식별자(ouid)</td>
                  <td className="py-2 pr-3">구단주명 연동 시(선택)</td>
                  <td className="py-2">전적 카드 자동 표시</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">IP 주소의 해시값</td>
                  <td className="py-2 pr-3">스쿼드 저장 시</td>
                  <td className="py-2">어뷰징 방지(원본 IP는 저장하지 않음)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-muted">
            전적 검색은 로그인 없이 이용 가능하며, 이때 개인정보를 수집하지 않습니다.
            검색한 구단주명 기록(최근 검색)은 이용자 기기(localStorage)에만 저장됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">2. 보유 및 파기</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>개인정보는 회원 탈퇴(계정 삭제) 시 지체 없이 파기합니다.</li>
            <li>
              탈퇴를 원하시면 문의 이메일로 요청해 주세요. 확인 후 계정과
              프로필 정보를 삭제합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">3. 처리 위탁 및 국외 이전</h2>
          <p className="mt-2 text-muted">
            서비스 운영을 위해 아래 업체에 데이터 처리를 위탁하며, 데이터는
            해당 업체의 국외 서버에 저장될 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Supabase Inc. — 데이터베이스·인증 (회원 정보, 게시물)</li>
            <li>Vercel Inc. — 호스팅·트래픽 분석</li>
            <li>Google LLC — 소셜 로그인</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">4. 이용자의 권리</h2>
          <p className="mt-2 text-muted">
            이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할
            수 있습니다. 문의 이메일로 요청하시면 지체 없이 조치합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">5. 개인정보 보호책임자</h2>
          <p className="mt-2 text-muted">
            운영자:{" "}
            <a href="mailto:boheme88@naver.com" className="text-accent underline underline-offset-2">
              boheme88@naver.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">6. 변경 고지</h2>
          <p className="mt-2 text-muted">
            본 방침이 변경되는 경우 시행일 7일 전 서비스 내 공지합니다.
          </p>
        </section>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/terms" className="text-accent underline underline-offset-2">
          이용약관
        </Link>
        <Link href="/" className="text-muted underline underline-offset-2">
          홈으로
        </Link>
      </div>
    </div>
  );
}
