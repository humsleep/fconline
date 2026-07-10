import type { Metadata } from "next";
import SquadBuilder from "./SquadBuilder";

export const metadata: Metadata = {
  title: "스쿼드 빌더 — 나만의 스쿼드 만들기",
  description:
    "포메이션에 선수를 배치해 스쿼드를 만들고 공유하세요. 리그·팀을 고르면 자동으로 채워집니다.",
};

export default function SquadPage() {
  return <SquadBuilder />;
}
