export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(req: Request, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  const joined = path.join("/");

  const API_BASE_URL = process.env.API_BASE_URL;
  const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;

  if (!API_BASE_URL || !API_AUTH_TOKEN) {
    return new Response("proxy not configured", { status: 500 });
  }

  const search = new URL(req.url).search;
  const targetUrl = `${API_BASE_URL}/${joined}${search}`;

  const isBodyMethod = req.method !== "GET" && req.method !== "HEAD";
  const bodyText = isBodyMethod ? await req.text() : undefined;

  const headers: HeadersInit = {
    Authorization: `Bearer ${API_AUTH_TOKEN}`,
  };
  const contentType = req.headers.get("Content-Type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: bodyText !== undefined && bodyText.length > 0 ? bodyText : undefined,
    cache: "no-store",
  });

  const upstreamContentType = upstream.headers.get("Content-Type");
  const responseHeaders: HeadersInit = {};
  if (upstreamContentType) {
    responseHeaders["Content-Type"] = upstreamContentType;
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export function GET(req: Request, ctx: RouteContext): Promise<Response> {
  return handler(req, ctx);
}

export function POST(req: Request, ctx: RouteContext): Promise<Response> {
  return handler(req, ctx);
}

export function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  return handler(req, ctx);
}

export function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  return handler(req, ctx);
}
