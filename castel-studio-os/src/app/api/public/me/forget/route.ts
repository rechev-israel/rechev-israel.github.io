import { forgetDevice } from "@/server/services/customer-portal";
import { preflight, withCors } from "../../booking/cors";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { d?: unknown };
  await forgetDevice(body.d);
  return withCors(req, Response.json({ ok: true }));
}
