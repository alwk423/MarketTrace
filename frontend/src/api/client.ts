import axios from "axios";
import type {
  CustomStrategyCreateRequest,
  OptimizationRequest,
  OptimizationResult,
  PortfolioSimulationRequest,
  PortfolioSimulationResult,
  SimulationRequest,
  SimulationResult,
  StrategyCatalogEntry,
} from "../types";

// Preconfigured HTTP client: every request sent through `client` gets this
// baseURL prepended to its URL. In dev, VITE_API_BASE_URL is unset, so this
// falls back to "/api" and Vite's proxy (vite.config.ts) forwards it to the
// FastAPI backend at localhost:8000. In a deployed static build there's no
// Vite dev server to proxy through, so VITE_API_BASE_URL must point at the
// deployed backend's origin (e.g. https://api.example.com/api).
const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api" });

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

// POST /api/strategies/custom -> saves a user-built rule set and returns it
// already shaped as a StrategyCatalogEntry, so it can be appended straight
// into the picker's strategy list.
export async function saveCustomStrategy(
  payload: CustomStrategyCreateRequest,
): Promise<StrategyCatalogEntry> {
  const { data } = await client.post<StrategyCatalogEntry>("/strategies/custom", payload);
  return data;
}
