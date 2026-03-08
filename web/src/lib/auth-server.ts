import { auth } from "@/lib/auth";

export async function getSessionFromRequest(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
