import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const targetUrl = `${BACKEND_URL}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  const forwardHeaders = ["accept", "authorization", "content-type", "cookie"];
  for (const name of forwardHeaders) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Backend service unavailable" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const contentType = backendResponse.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  const setCookies = backendResponse.headers.getSetCookie?.() ?? [];
  for (const cookieValue of setCookies) {
    responseHeaders.append("set-cookie", cookieValue);
  }

  const responseBody = await backendResponse.arrayBuffer();
  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
