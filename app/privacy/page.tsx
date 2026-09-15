import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "FC Scope 개인정보처리방침",
};

const CONTACT = "boheme88@naver.com";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold">{children}</h2>;
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[13px] sm:text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            {head.map((h) => (
              <th key={h} className="py-2 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-muted">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 align-top last:border-0">
              {r.map((c, j) => (
                <td key={j} className="py-2 pr-3">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 개인정보처리방침 v2 (2026-09-10 시행) — iOS 앱(광고·Apple 로그인·앱 접근권한·계정 삭제) 반영.
 * 개정 시 app/login/page.tsx 의 PRIVACY_VERSION 도 함께 올릴 것.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 md:pb-16">
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <p className="mt-1 text-sm text-muted">시행일: 2026년 9월 10일 (이전 버전: 2026년 7월 15일)</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        FC Scope(이하 &quot;서비스&quot;)의 운영자는 「개인정보 보호법」 등 관계 법령을 준수하며, 웹사이트(fcscope.xyz)와
        iOS 앱(FC Scope)에서 이용자의 개인정보를 어떻게 처리하는지 아래와 같이 알려드립니다.
      </p>

      <div className="mt-6 space-y-7 text-sm leading-relaxed">
        <section>
          <H2>1. 수집하는 개인정보 항목과 목적</H2>
          <p className="mt-2 text-muted">
            <b className="text-ink">전적 검색·매치 리포트·스쿼드 빌더·픽 랭킹은 로그인 없이 이용할 수 있으며, 이때 회원 정보를
            수집하지 않습니다.</b> 회원 정보는 커뮤니티 이용을 위해 소셜 로그인을 할 때만 수집합니다.
          </p>
          <Table
            head={["항목", "수집 시점", "목적"]}
            rows={[
              [
                "이메일, 소셜 계정 식별자(Google 계정 ID / Apple ID 사용자 식별자), 소셜 제공자가 전달하는 프로필 이름·프로필 사진 URL",
                "Google 또는 Apple 로그인 시",
                "회원 식별·중복 가입 방지, 커뮤니티 이용",
              ],
              ["닉네임, 약관 동의 시각", "프로필 등록 시", "커뮤니티 활동 표시, 동의 증적"],
              [
                "FC온라인 구단주명·계정 식별자(ouid)·연동 시각",
                "구단주명 연동 시(선택)",
                "전적 카드 자동 표시, 사칭 방지",
              ],
              [
                "게시물·댓글·투표·신고 내역, 게시물에 이용자가 직접 입력한 연락처(선택)",
                "커뮤니티 작성 시",
                "커뮤니티 운영, 신고 처리",
              ],
              [
                "전적 스냅샷(연동 구단주의 승률·평균 평점·경기 수, 하루 1회)",
                "본인 전적 열람 시(구단주 연동 회원)",
                "지난 방문 대비 변화 표시",
              ],
              [
                "스쿼드 구성 정보, IP 주소의 해시값(원본 IP 미저장)",
                "스쿼드 저장 시(비로그인 포함)",
                "스쿼드 공유, 어뷰징 방지",
              ],
              [
                "앱 이용 기록(설치 시 앱이 만든 무작위 식별자, 앱 버전, 검색·카드 공유 등 기능 사용 이벤트)",
                "iOS 앱 이용 시 자동 수집",
                "서비스 개선용 익명 통계(광고 식별자·기기 식별자·계정 정보와 연결하지 않음)",
              ],
              [
                "접속 기록(IP 주소, 브라우저·OS 종류, 접속 일시, 요청 경로)",
                "서비스 이용 시 자동 생성",
                "보안, 장애 대응, 속도 제한(IP는 저장하지 않고 메모리에서만 일시 사용)",
              ],
              [
                "서비스 이용 통계(방문 페이지, 기기 유형, 대략적 지역)",
                "서비스 이용 시 자동 수집",
                "서비스 개선 (Vercel Analytics: 쿠키 없이 익명 집계 / Google Analytics 사용 시 쿠키 기반)",
              ],
              [
                "광고 식별자(IDFA — 앱에서 '추적 허용' 시에만), 기기 모델·OS 버전, 광고 노출·클릭 정보, IP 기반 대략적 위치",
                "iOS 앱 이용 시(광고 SDK가 자동 수집)",
                "광고 게재 및 성과 측정 (Google AdMob)",
              ],
              ["이메일 주소, 문의 내용", "이메일 문의 시", "문의 응대"],
            ]}
          />
          <p className="mt-3 text-muted">
            검색한 구단주명은 <b className="text-ink">공개된 게임 닉네임</b>으로, 검색 페이지 색인을 위해 마지막 검색 시각과 함께
            서버에 기록되지만 이용자 계정·기기와 연결하지 않습니다. 최근 검색·즐겨찾기·내 스쿼드 목록·테마·차단 목록은
            이용자 기기(브라우저 저장소)에만 저장되며 서버로 전송되지 않습니다.
          </p>
        </section>

        <section>
          <H2>2. 앱 접근 권한 안내 (iOS 앱)</H2>
          <p className="mt-2 text-muted">
            앱은 <b className="text-ink">필수 접근 권한을 요구하지 않습니다.</b> 아래 선택 권한은 거부해도 모든 기능을 동일하게 이용할 수
            있습니다.
          </p>
          <Table
            head={["권한", "구분", "용도"]}
            rows={[
              [
                "앱 추적 투명성(ATT, 다른 앱·웹사이트 활동 추적 허용)",
                "선택",
                "관심사 기반 맞춤 광고. 거부 시 비맞춤(문맥) 광고가 표시됩니다.",
              ],
              ["사진·카메라·위치·연락처·마이크·알림", "요청하지 않음", "—"],
            ]}
          />
          <p className="mt-2 text-muted">
            카드 이미지 저장·공유는 iOS 공유 시트를 이용하므로 사진 접근 권한이 필요하지 않습니다. 권한은 iOS
            &quot;설정 &gt; FC Scope&quot; 또는 &quot;설정 &gt; 개인정보 보호 및 보안 &gt; 추적&quot;에서 언제든 변경할 수 있습니다.
          </p>
        </section>

        <section>
          <H2>3. 광고와 맞춤형 광고</H2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>
              서비스는 무료로 제공되며, iOS 앱에는 Google AdMob 배너 광고가 표시됩니다. 광고 SDK는 광고 게재·빈도 제한·부정
              클릭 방지·성과 측정을 위해 위 1항의 광고 관련 항목을 수집합니다.
            </li>
            <li>
              맞춤 광고는 이용자가 ATT에서 &quot;허용&quot;을 선택한 경우에만 광고 식별자를 사용합니다. 거부하거나 iOS 설정에서
              끄면 맞춤 광고가 중단됩니다.
            </li>
            <li>
              Google의 광고 데이터 처리 방식은{" "}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                className="text-accent underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google 파트너 사이트·앱에서의 데이터 사용
              </a>
              에서 확인할 수 있습니다.
            </li>
          </ul>
        </section>

        <section>
          <H2>4. 보유 기간과 파기</H2>
          <Table
            head={["항목", "보유 기간"]}
            rows={[
              ["회원 정보(이메일·소셜 식별자·닉네임·구단주 연동), 게시물·댓글·투표·신고, 전적 스냅샷", "회원 탈퇴(계정 삭제) 시 즉시 파기"],
              [
                "저장한 스쿼드",
                "이용자가 삭제할 때까지. 탈퇴 시 계정 연결이 해제되어 개인정보가 없는 익명 스쿼드로 남을 수 있으며, 삭제를 원하면 탈퇴 전 마이페이지에서 삭제하거나 문의해 주세요.",
              ],
              ["IP 해시값(스쿼드 저장)", "해당 스쿼드 삭제 시까지"],
              ["앱 이용 기록", "수집일로부터 180일 후 자동 파기"],
              ["접속 기록·이용 통계", "호스팅·분석 사업자의 보관 정책에 따라 단기간 보관 후 자동 삭제"],
              ["문의 이메일", "문의 처리 완료 후 1년"],
            ]}
          />
          <p className="mt-2 text-muted">
            보유 기간이 지나거나 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자 파일은 복구할 수 없는 방법으로 삭제하며,
            법령에 따라 보존해야 하는 정보는 해당 기간 동안만 별도로 보관합니다.
          </p>
        </section>

        <section>
          <H2>5. 개인정보의 제3자 제공</H2>
          <p className="mt-2 text-muted">
            운영자는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 근거하거나 수사기관의 적법한 요청이 있는
            경우는 예외입니다. 커뮤니티에 이용자가 직접 공개한 닉네임·게시물·연락처는 다른 이용자에게 표시됩니다.
          </p>
        </section>

        <section>
          <H2>6. 처리 위탁 및 국외 이전</H2>
          <p className="mt-2 text-muted">
            서비스 운영을 위해 아래 사업자에게 개인정보 처리를 위탁하며, 이 과정에서 개인정보가 국외로 이전·저장됩니다. 이전은
            이용자가 서비스를 이용하는 시점에 정보통신망을 통해 이루어집니다.
          </p>
          <Table
            head={["수탁자(국가)", "위탁 업무", "이전 항목", "보유 기간"]}
            rows={[
              [
                "Supabase Inc. (미국)",
                "회원 인증, 데이터베이스",
                "회원 정보, 프로필, 게시물·댓글, 스쿼드, 전적 스냅샷",
                "탈퇴 시 또는 위탁 계약 종료 시까지",
              ],
              ["Vercel Inc. (미국)", "웹 호스팅, 접속 기록, 이용 통계", "접속 기록, 익명 이용 통계", "사업자 보관 정책에 따름"],
              [
                "Google LLC (미국)",
                "Google 로그인, 앱 광고(AdMob), 이용 통계(Google Analytics 사용 시)",
                "소셜 로그인 정보, 광고 식별자·기기 정보, 이용 통계",
                "각 서비스의 개인정보처리방침에 따름",
              ],
              ["Apple Inc. (미국)", "Apple 로그인(iOS 앱)", "Apple ID 사용자 식별자, 이메일(비공개 릴레이 가능)", "각 서비스의 개인정보처리방침에 따름"],
            ]}
          />
          <p className="mt-2 text-muted">
            수탁자의 연락처는 각 사업자의 개인정보처리방침에서 확인할 수 있습니다. 국외 이전을 원하지 않으면 로그인 없이
            서비스를 이용하거나, 문의 이메일로 이전 중단(계정 삭제)을 요청할 수 있습니다. 또한 전적 조회를 위해 이용자가 입력한
            구단주명을 NEXON 오픈API로 전송하며, 이는 공개 게임 데이터 조회로 NEXON의 정책이 적용됩니다.
          </p>
        </section>

        <section>
          <H2>7. 이용자의 권리와 행사 방법</H2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.</li>
            <li>
              <b className="text-ink">계정 삭제(회원 탈퇴)</b>는 앱·웹의 <Link href="/me" className="text-accent underline underline-offset-2">마이페이지 &gt; 설정 &gt; 계정 삭제</Link>에서
              즉시 처리되며, 닉네임·구단주 연동·게시물·댓글·전적 스냅샷이 함께 삭제됩니다.
            </li>
            <li>닉네임·구단주 연동은 마이페이지 &gt; 프로필 설정에서 직접 변경할 수 있습니다.</li>
            <li>그 밖의 요청은 문의 이메일로 보내 주시면 본인 확인 후 지체 없이(10일 이내) 조치합니다.</li>
            <li>다른 이용자를 차단하면 해당 이용자의 글·댓글이 내 기기에서 보이지 않으며, 마이페이지에서 해제할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <H2>8. 만 14세 미만 아동</H2>
          <p className="mt-2 text-muted">
            만 14세 미만은 회원 가입(로그인)할 수 없으며, 운영자는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.
            아동의 정보가 수집된 사실을 알게 되면 지체 없이 삭제합니다. 로그인이 필요 없는 전적 검색 등은 연령과 관계없이
            이용할 수 있습니다.
          </p>
        </section>

        <section>
          <H2>9. 자동 수집 장치(쿠키 등)의 설치·운영과 거부</H2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>로그인 세션 유지를 위해 인증 쿠키를, 테마·최근 검색 등 편의 설정을 위해 브라우저 저장소(localStorage)를 사용합니다.</li>
            <li>브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 기능을 이용할 수 없습니다.</li>
            <li>앱의 광고 식별자는 iOS &quot;설정 &gt; 개인정보 보호 및 보안 &gt; 추적&quot;에서 거부하거나 재설정할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <H2>10. 개인정보의 안전성 확보 조치</H2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>모든 통신은 HTTPS로 암호화됩니다.</li>
            <li>데이터베이스는 행 단위 접근 제어(RLS)로 본인 데이터만 읽고 쓸 수 있도록 제한합니다.</li>
            <li>IP 주소는 원본을 저장하지 않고 솔트를 적용한 해시값만 저장합니다.</li>
            <li>관리 권한 키는 서버에서만 사용하며, 접근 권한은 운영자에게만 부여합니다.</li>
          </ul>
        </section>

        <section>
          <H2>11. 개인정보 보호책임자</H2>
          <p className="mt-2 text-muted">
            운영자(개인정보 보호책임자):{" "}
            <a href={`mailto:${CONTACT}`} className="text-accent underline underline-offset-2">
              {CONTACT}
            </a>
            <br />
            개인정보 관련 문의·불만·피해 구제는 위 이메일로 접수해 주세요. 그 밖에 개인정보침해신고센터(privacy.kisa.or.kr,
            118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972)에도 문의할 수 있습니다.
          </p>
        </section>

        <section>
          <H2>12. 고지 의무</H2>
          <p className="mt-2 text-muted">
            본 방침이 변경되는 경우 시행일 7일 전 서비스 내 공지합니다. 이용자 권리에 중요한 변경이 있으면 시행일 30일 전에
            공지합니다.
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
