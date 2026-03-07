import { NextRequest } from "next/server";

const ELECTRIC_PARAMS = ["offset", "handle", "live", "cursor"];

export async function GET(request: NextRequest) {
  const originUrl = new URL("/v1/shape", process.env.DATABASE_SYNC_URL);

  originUrl.searchParams.set("table", "cheers");

  for (const param of ELECTRIC_PARAMS) {
    const value = request.nextUrl.searchParams.get(param);
    if (value !== null) {
      originUrl.searchParams.set(param, value);
    }
  }

  if (!originUrl.searchParams.has("offset")) {
    originUrl.searchParams.set("offset", "-1");
  }

  originUrl.searchParams.set("secret", process.env.DATABASE_SYNC_SECRET!);

  const response = await fetch(originUrl.toString());

  const headers = new Headers();
  for (const [key, value] of response.headers.entries()) {
    if (key !== "content-encoding" && key !== "content-length") {
      headers.set(key, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
