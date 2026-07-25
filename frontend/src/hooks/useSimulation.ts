import { useState } from "react";
import { runSimulation } from "../api/client";
import type { SimulationRequest, SimulationResult } from "../types";

export function useSimulation() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(payload: SimulationRequest) {
    setLoading(true);
    setError(null);
    try {
      const data = await runSimulation(payload);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  return { result, loading, error, run };
}
