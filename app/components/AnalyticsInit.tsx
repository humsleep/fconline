"use client";

import { useEffect } from "react";
import { captureUtm } from "@/lib/client/analytics";

/**
 * 최초 마운트 시 URL의 utm_* 를 캡처(인스타 등 캠페인 유입 소스 기록).
 * 렌더 출력 없음. layout에 한 번 마운트.
 */
export default function AnalyticsInit() {
  useEffect(() => {
    captureUtm();
  }, []);
  return null;
}
