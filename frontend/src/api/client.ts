import axios from "axios";
import type {
  AuthResponse,
  CustomStrategyCreateRequest,
  MonteCarloRequest,
  MonteCarloResult,
  OptimizationRequest,
  OptimizationResult,
  PortfolioSimulationRequest,
  PortfolioSimulationResult,
  SimulationRequest,
  SimulationResult,
  SimulationSummary,
  StrategyCatalogEntry,
  WalkForwardRequest,
  WalkForwardResult,
} from "../types";

export const TOKEN_STORAGE_KEY = "markettrace_token";

// Preconfigured HTTP client: every request sent through `client` gets this
// baseURL prepended to its URL. In dev, VITE_API_BASE_URL is unset, so this
// falls back to "/api" and Vite's proxy (vite.config.ts) forwards it to the
// FastAPI backend at localhost:8000. In a deployed static build there's no
// Vite dev server to proxy through, so VITE_API_BASE_URL must point at the
// deployed backend's origin (e.g. https://api.example.com/api).
const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api" });

// Every outgoing request picks up whatever token is currently in
// localStorage - reading it fresh per-request (rather than once at module
// load) means login/logout take effect on the very next call, no client
// re-creation needed.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AUTH_LOGOUT_EVENT = "markettrace:auth-logout";

// A 401 means the token is missing/expired/invalid - drop it so the app
// doesn't keep sending a dead token, and broadcast it so AuthContext (which
// lives outside axios's reach) can clear its in-memory user and redirect to
// /login, even for a 401 triggered by a page other than the one it started on.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    }
    return Promise.reject(error);
  },
);

export async function signup(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>("/auth/signup", { email, password });
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>("/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<AuthResponse["user"]> {
  const { data } = await client.get<AuthResponse["user"]>("/auth/me");
  return data;
}

// GET /api/simulations -> the current user's saved runs, newest first.
export async function fetchSimulationHistory(): Promise<SimulationSummary[]> {
  const { data } = await client.get<SimulationSummary[]>("/simulations");
  return data;
}

// GET /api/simulations/:id -> full detail for one saved run (owned by the
// current user; the backend 404s for anyone else's).
export async function fetchSimulationDetail(id: string): Promise<SimulationResult> {
  const { data } = await client.get<SimulationResult>(`/simulations/${id}`);
  return data;
}

// PATCH /api/simulations/:id/share -> owner-only, flips the public/private
// flag that gates the permalink. Backs the Share button.
export async function setSimulationVisibility(id: string, isPublic: boolean): Promise<SimulationResult> {
  const { data } = await client.patch<SimulationResult>(`/simulations/${id}/share`, { is_public: isPublic });
  return data;
}

// GET /api/simulations/public/:id -> the permalink target. No auth header is
// required by the backend, but the request interceptor still attaches one if
// the viewer happens to be logged in - harmless, the backend ignores it here.
export async function fetchPublicSimulation(id: string): Promise<SimulationResult> {
  const { data } = await client.get<SimulationResult>(`/simulations/public/${id}`);
  return data;
}

// GET /api/strategies -> the list of strategies the backend knows how to run.
// `async` means this returns a Promise; callers must `await` (or .then) it.
export async function fetchStrategies(): Promise<StrategyCatalogEntry[]> {
  const { data } = await client.get<StrategyCatalogEntry[]>("/strategies");
  return data;
}

// POST /api/simulations with the form config as the JSON body -> the backend
// runs the backtest and sends back the trade log / stats as SimulationResult.
export async function runSimulation(payload: SimulationRequest): Promise<SimulationResult> {
  const { data } = await client.post<SimulationResult>("/simulations", payload);
  return data;
}

export async function optimizeSimulation(payload: OptimizationRequest): Promise<OptimizationResult> {
  const { data } = await client.post<OptimizationResult>("/simulations/optimize", payload);
  return data;
}

// POST /api/simulations/portfolio -> runs the strategy across a basket of
// symbols and returns per-symbol results plus a combined equity curve.
export async function runPortfolioSimulation(
  payload: PortfolioSimulationRequest,
): Promise<PortfolioSimulationResult> {
  const { data } = await client.post<PortfolioSimulationResult>("/simulations/portfolio", payload);
  return data;
}

// POST /api/simulations/walk-forward -> runs one continuous backtest, then
// reports performance split into an in-sample "train" slice and an
// out-of-sample "test" slice on either side of a split date.
export async function runWalkForward(payload: WalkForwardRequest): Promise<WalkForwardResult> {
  const { data } = await client.post<WalkForwardResult>("/simulations/walk-forward", payload);
  return data;
}

// POST /api/simulations/monte-carlo -> bootstraps the strategy's own daily
// returns hundreds of times and returns the distribution of possible
// outcomes around the single observed result.
export async function runMonteCarlo(payload: MonteCarloRequest): Promise<MonteCarloResult> {
  const { data } = await client.post<MonteCarloResult>("/simulations/monte-carlo", payload);
  return data;
}

// POST /api/strategies/custom -> saves a user-built rule set and returns it
// already shaped as a StrategyCatalogEntry, so it can be appended straight
// into the picker's strategy list.
export async function saveCustomStrategy(
  payload: CustomStrategyCreateRequest,
): Promise<StrategyCatalogEntry> {
  const { data } = await client.post<StrategyCatalogEntry>("/strategies/custom", payload);
  return data;
}
