import axios from "axios";
import type {
  OptimizationRequest,
  OptimizationResult,
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
