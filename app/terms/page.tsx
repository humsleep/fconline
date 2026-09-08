import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관",
  description: "FC Scope 이용약관",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold">이용약관</h1>
      <p className="mt-1 text-sm text-muted">시행일: 2026년 9월 10일 (이전 버전: 2026년 7월 15일)</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-bold">제1조 (목적)</h2>
          <p className="mt-2 text-muted">
            이 약관은 FC Scope(이하 &quot;서비스&quot;)의 이용 조건과 운영자·이용자의
            권리, 의무 및 책임 사항을 규정합니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">제2조 (서비스의 성격)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>
              서비스는 EA SPORTS FC 온라인의 <b className="text-ink">비공식 팬 서비스</b>이며,
              NEXON 및 EA와 제휴·후원 관계가 없습니다.
            </li>
            <li>
              전적·선수 데이터는 NEXON Open API를 통해 제공되며, 게임 데이터의
              저작권은 NEXON·EA에 있습니다.
            </li>
            <li>서비스는 무료로 제공되며, 데이터의 정확성·완전성을 보증하지 않습니다.</li>
            <li>
              서비스(특히 iOS 앱)에는 제3자 광고가 게재될 수 있습니다. 광고 내용과 광고주 사이트의 책임은 해당 광고주에게
              있으며, 광고 관련 데이터 처리는 개인정보처리방침에 따릅니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">제3조 (계정)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>커뮤니티 기능은 Google 또는 Apple 계정 로그인 후 이용할 수 있습니다.</li>
            <li>
              이용자는 언제든지 마이페이지 &gt; 설정 &gt; 계정 삭제로 탈퇴할 수 있으며, 탈퇴 시 계정 정보와 작성한 글·댓글이
              삭제됩니다.
            </li>
            <li>
              <b className="text-ink">만 14세 미만</b>은 회원 가입(로그인)할 수 없습니다.
              전적 검색 등 로그인이 필요 없는 기능은 이용할 수 있습니다.
            </li>
            <li>
              구단주명 &quot;연동&quot;은 해당 구단주명이 게임에 존재함을 확인하는
              기능이며, 계정 소유를 증명하지 않습니다.
            </li>
            <li>타인 사칭 목적의 연동·닉네임 사용은 금지되며, 발견 시 제한될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">제4조 (게시물과 금지 행위)</h2>
          <p className="mt-2 text-muted">
            이용자가 작성한 게시물의 책임은 작성자에게 있습니다. 다음 행위는
            금지되며, 신고 누적 또는 운영자 판단에 따라 사전 통지 없이 숨김·삭제될 수 있습니다.
            불쾌한 게시물은 신고 버튼으로 알릴 수 있고, 특정 이용자를 차단하면 그 이용자의 글·댓글이 내 기기에서 보이지
            않습니다. 운영자는 신고를 신속히(원칙적으로 24시간 이내) 검토하며, 반복 위반 계정은 이용이 제한될 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>욕설·비하·차별·혐오 표현, 타인에 대한 모욕</li>
            <li>음란물, 불법 정보, 도박·거래 유도(계정 거래 포함)</li>
            <li>도배·스팸·광고, 개인정보 노출</li>
            <li>서비스의 정상 운영을 방해하는 행위(자동화 요청 남용 등)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">제5조 (책임 제한)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>
              운영자는 NEXON API 장애·점검 등 외부 요인으로 인한 서비스 중단에
              책임지지 않습니다.
            </li>
            <li>
              서비스가 제공하는 진단·분석 결과는 참고용이며, 이를 활용한 판단의
              책임은 이용자에게 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">제5조의2 (iOS 앱과 Apple 관련 고지)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>
              본 약관은 운영자와 이용자 사이의 약관이며 Apple Inc.는 당사자가 아닙니다. Apple은 앱과 그 콘텐츠에 대해
              유지보수·지원·보증·책임을 지지 않으며, 앱 관련 청구는 운영자가 처리합니다.
            </li>
            <li>App Store를 통한 앱 이용에는 Apple 미디어 서비스 이용약관과 표준 최종 사용자 사용권 계약(EULA)이 함께 적용됩니다.</li>
            <li>Apple 및 그 자회사는 본 약관의 제3수익자로서 이용자에게 본 약관을 직접 집행할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold">제6조 (약관의 변경)</h2>
          <p className="mt-2 text-muted">
            약관이 변경되는 경우 시행일 7일 전 서비스 내 공지합니다. 변경 후
            서비스를 계속 이용하면 변경 약관에 동의한 것으로 봅니다.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">제7조 (문의)</h2>
          <p className="mt-2 text-muted">
            서비스 관련 문의:{" "}
            <a href="mailto:boheme88@naver.com" className="text-accent underline underline-offset-2">
              boheme88@naver.com
            </a>
          </p>
        </section>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/privacy" className="text-accent underline underline-offset-2">
          개인정보처리방침
        </Link>
        <Link href="/" className="text-muted underline underline-offset-2">
          홈으로
        </Link>
      </div>
    </div>
  );
}
