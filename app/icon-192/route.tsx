import { iconResponse } from "@/lib/icon";

export const runtime = "nodejs";

export function GET() {
  return iconResponse(192);
}
