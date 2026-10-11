import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchResponse(
  status: number,
  body: unknown,
  contentType = "application/json",
): Response {
  const bodyText =
    body !== null && body !== undefined ? JSON.stringify(body) : "";
  return new Response(bodyText, {
    status,
    headers: { "Content-Type": contentType },
  });
}

function makeMockFetch(response: Response) {
  return vi.fn().mockResolvedValue(response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("api.ts — browser path", () => {
  // jsdom defines window, so the browser branch is active by default.
  // We use vi.resetModules() + dynamic import to get a fresh module per test.

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses relative /api{path} URL and does NOT send Authorization header", async () => {
    const mockFetch = makeMockFetch(makeFetchResponse(200, []));
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await listLeagues();

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("/api/leagues");
    expect(
      (calledInit.headers as Record<string, string>)["Authorization"],
    ).toBeUndefined();
  });

  it("includes cache: no-store", async () => {
    const mockFetch = makeMockFetch(makeFetchResponse(200, []));
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await listLeagues();

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledInit.cache).toBe("no-store");
  });

  it("throws with body.message on non-OK response", async () => {
    const mockFetch = makeMockFetch(
      makeFetchResponse(400, { message: "bad request" }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await expect(listLeagues()).rejects.toThrow("bad request");
  });

  it("throws with statusText when non-OK body is not valid JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("not-json", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await expect(listLeagues()).rejects.toThrow("Internal Server Error");
  });

  it("resolves to undefined on 204 No Content", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    // listLeagues normally returns League[], but 204 path returns undefined as T
    const result = await listLeagues();
    expect(result).toBeUndefined();
  });
});

describe("api.ts — server path", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // Force the server branch: typeof window === "undefined"
    vi.stubGlobal("window", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses absolute API_BASE_URL{path} URL and sends Authorization header", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.example.com");
    vi.stubEnv("API_AUTH_TOKEN", "secret-token");

    const mockFetch = makeMockFetch(makeFetchResponse(200, []));
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await listLeagues();

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("http://api.example.com/leagues");
    expect(
      (calledInit.headers as Record<string, string>)["Authorization"],
    ).toBe("Bearer secret-token");
  });

  it("throws when API_BASE_URL is missing", async () => {
    vi.stubEnv("API_BASE_URL", "");
    vi.stubEnv("API_AUTH_TOKEN", "secret-token");

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await expect(listLeagues()).rejects.toThrow(
      "API_BASE_URL / API_AUTH_TOKEN are not configured",
    );
  });

  it("throws when API_AUTH_TOKEN is missing", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.example.com");
    vi.stubEnv("API_AUTH_TOKEN", "");

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await expect(listLeagues()).rejects.toThrow(
      "API_BASE_URL / API_AUTH_TOKEN are not configured",
    );
  });

  it("includes cache: no-store on server path", async () => {
    vi.stubEnv("API_BASE_URL", "http://api.example.com");
    vi.stubEnv("API_AUTH_TOKEN", "tok");

    const mockFetch = makeMockFetch(makeFetchResponse(200, []));
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await listLeagues();

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledInit.cache).toBe("no-store");
  });
});

describe("api.ts — endpoint functions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // Use browser path so we can test paths without needing env vars
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listLeagues — GET /leagues", async () => {
    const mockFetch = makeMockFetch(makeFetchResponse(200, []));
    vi.stubGlobal("fetch", mockFetch);

    const { listLeagues } = await import("@/lib/api");
    await listLeagues();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/leagues");
    expect(init.method).toBeUndefined(); // default GET
  });

  it("createLeague — POST /leagues with body", async () => {
    const payload = {
      name: "Test League",
      rankingRule: {
        pointsWin: 3,
        pointsDraw: 1,
        pointsLoss: 0,
        tiebreakers: ["head_to_head"],
      },
      teams: [],
    };
    const mockFetch = makeMockFetch(makeFetchResponse(201, { id: "abc" }));
    vi.stubGlobal("fetch", mockFetch);

    const { createLeague } = await import("@/lib/api");
    await createLeague(payload);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/leagues");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("getLeague — GET /leagues/:id", async () => {
    const mockFetch = makeMockFetch(
      makeFetchResponse(200, { id: "abc", name: "League", teams: [] }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { getLeague } = await import("@/lib/api");
    await getLeague("abc");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/leagues/abc");
  });

  it("listMatches — GET /leagues/:id/matches", async () => {
    const mockFetch = makeMockFetch(makeFetchResponse(200, []));
    vi.stubGlobal("fetch", mockFetch);

    const { listMatches } = await import("@/lib/api");
    await listMatches("league-1");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/leagues/league-1/matches");
  });

  it("createMatch — POST /leagues/:id/matches with body", async () => {
    const payload = {
      homeTeamId: "t1",
      awayTeamId: "t2",
      homeScore: 2,
      awayScore: 1,
    };
    const mockFetch = makeMockFetch(
      makeFetchResponse(201, { id: "m1", ...payload }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { createMatch } = await import("@/lib/api");
    await createMatch("league-1", payload);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/leagues/league-1/matches");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("updateMatch — PATCH /leagues/:leagueId/matches/:matchId with body", async () => {
    const payload = { homeScore: 3, awayScore: 2 };
    const mockFetch = makeMockFetch(
      makeFetchResponse(200, {
        id: "m1",
        homeTeamId: "t1",
        awayTeamId: "t2",
        homeScore: 3,
        awayScore: 2,
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { updateMatch } = await import("@/lib/api");
    await updateMatch("league-1", "m1", payload);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/leagues/league-1/matches/m1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });
});
