import axios from "axios";
import type { SimulationRequest, SimulationResult, StrategyCatalogEntry } from "../types";

const client = axios.create({ baseURL: "/api" });

export async function fetchStrategies(): Promise<StrategyCatalogEntry[]> {
  const { data } = await client.get<StrategyCatalogEntry[]>("/strategies");
  return data;
}

export async function runSimulation(payload: SimulationRequest): Promise<SimulationResult> {
  const { data } = await client.post<SimulationResult>("/simulations", payload);
  return data;
}
