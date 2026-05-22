import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We import after stubbing env vars so the module reads them fresh.
// But the route.ts handlers are plain async functions — they read process.env
// at call time, not at import time, so a single import is fine.
import { GET, POST, PATCH, DELETE } from "./route";

type RouteContext = { params: Promise<{ path: string[] }> };

function makeContext(segments: string[]): RouteContext {
  return { params: Promise.resolve({ path: segments }) };
}

function makeRequest(
  method: string,
  url: string,
  body?: string,
  contentType?: string,
): Request {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  return new Request(url, {
    method,
    body: body ?? undefined,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("proxy route handler", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 with 'proxy not configured' when env vars are missing", async () => {
    vi.stubEnv("API_BASE_URL", "");
    vi.stubEnv("API_AUTH_TOKEN", "");

    const req = makeRequest("GET", "http://localhost/api/leagues");
    const res = await GET(req, makeContext(["leagues"]));

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("proxy not configured");
  });

  it("GET: forwards to API_BASE_URL/path with Authorization header and no body", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "my-token");

    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest("GET", "http://localhost/api/leagues");
    const res = await GET(req, makeContext(["leagues"]));

    expect(res.status).toBe(200);

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("http://api.internal/leagues");
    expect((calledInit.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer my-token",
    );
    expect(calledInit.body).toBeUndefined();
  });

  it("POST: forwards JSON body and Content-Type header", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const bodyPayload = JSON.stringify({ name: "League A" });
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "1" }), { status: 201, headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      "POST",
      "http://localhost/api/leagues",
      bodyPayload,
      "application/json",
    );
    const res = await POST(req, makeContext(["leagues"]));

    expect(res.status).toBe(201);

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("http://api.internal/leagues");
    expect(calledInit.method).toBe("POST");
    expect(calledInit.body).toBe(bodyPayload);
    expect(
      (calledInit.headers as Record<string, string>)["Content-Type"],
    ).toBe("application/json");
  });

  it("query string is preserved in the forwarded URL", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      "GET",
      "http://localhost/api/leagues?page=2&limit=10",
    );
    await GET(req, makeContext(["leagues"]));

    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://api.internal/leagues?page=2&limit=10");
  });

  it("multi-segment path is joined correctly", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      "GET",
      "http://localhost/api/leagues/abc/matches",
    );
    await GET(req, makeContext(["leagues", "abc", "matches"]));

    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://api.internal/leagues/abc/matches");
  });

  it("mirrors response status and Content-Type from upstream", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "x" }), {
        status: 201,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      "POST",
      "http://localhost/api/leagues",
      JSON.stringify({ name: "X" }),
      "application/json",
    );
    const res = await POST(req, makeContext(["leagues"]));

    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
  });

  it("DELETE with no body does not forward Content-Type", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest("DELETE", "http://localhost/api/leagues/abc");
    const res = await DELETE(req, makeContext(["leagues", "abc"]));

    expect(res.status).toBe(204);

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(
      (calledInit.headers as Record<string, string>)["Content-Type"],
    ).toBeUndefined();
    // body should be undefined (empty string body from DELETE with no body)
    expect(calledInit.body === undefined || calledInit.body === "").toBe(true);
  });

  it("PATCH: forwards to the right URL with PATCH method", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const patchBody = JSON.stringify({ homeScore: 3 });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "m1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest(
      "PATCH",
      "http://localhost/api/leagues/abc/matches/m1",
      patchBody,
      "application/json",
    );
    await PATCH(req, makeContext(["leagues", "abc", "matches", "m1"]));

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(
      "http://api.internal/leagues/abc/matches/m1",
    );
    expect(calledInit.method).toBe("PATCH");
  });

  it("cache: no-store is included in the fetch call", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.internal");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const req = makeRequest("GET", "http://localhost/api/leagues");
    await GET(req, makeContext(["leagues"]));

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledInit.cache).toBe("no-store");
  });
});
