import axios from "axios";
import type { SimulationRequest, SimulationResult, StrategyCatalogEntry } from "../types";

// Preconfigured HTTP client: every request sent through `client` gets "/api"
// prepended to its URL. In dev, Vite's proxy (vite.config.ts) forwards
// anything under /api to the FastAPI backend at localhost:8000.
const client = axios.create({ baseURL: "/api" });

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
