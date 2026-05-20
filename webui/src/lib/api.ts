import type {
  League,
  LeagueDetail,
  Match,
  MatchCreateRequest,
  MatchUpdateRequest,
} from "@/types/league";

export type ApiError = {
  message: string;
};

type LeagueCreateRequestTeam = {
  name: string;
  color: string;
  members: { name: string }[];
};

type LeagueCreateRequest = {
  name: string;
  rankingRule: {
    pointsWin: number;
    pointsDraw: number;
    pointsLoss: number;
    tiebreakers: string[];
  };
  teams: LeagueCreateRequestTeam[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isServer = typeof window === "undefined";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  let url: string;
  if (isServer) {
    const baseUrl = process.env.API_BASE_URL;
    const token = process.env.API_AUTH_TOKEN;
    if (!baseUrl || !token) {
      throw new Error("API_BASE_URL / API_AUTH_TOKEN are not configured");
    }
    url = `${baseUrl}${path}`;
    headers.Authorization = `Bearer ${token}`;
  } else {
    url = `/api${path}`;
  }

  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((body as ApiError).message ?? res.statusText);
  }

  // 204 No Content など body がない場合
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export function listLeagues(): Promise<League[]> {
  return request<League[]>("/leagues");
}

export function createLeague(payload: LeagueCreateRequest): Promise<League> {
  return request<League>("/leagues", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLeague(leagueId: string): Promise<LeagueDetail> {
  return request<LeagueDetail>(`/leagues/${leagueId}`);
}

export function listMatches(leagueId: string): Promise<Match[]> {
  return request<Match[]>(`/leagues/${leagueId}/matches`);
}

export function createMatch(
  leagueId: string,
  payload: MatchCreateRequest,
): Promise<Match> {
  return request<Match>(`/leagues/${leagueId}/matches`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMatch(
  leagueId: string,
  matchId: string,
  payload: MatchUpdateRequest,
): Promise<Match> {
  return request<Match>(`/leagues/${leagueId}/matches/${matchId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
