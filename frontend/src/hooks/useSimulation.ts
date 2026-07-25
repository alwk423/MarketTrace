import { isAxiosError } from "axios";
import { useState } from "react";
import { runSimulation } from "../api/client";
import type { SimulationRequest, SimulationResult } from "../types";

function extractErrorMessage(err: unknown): string {
  if (isAxiosError<{ detail?: string }>(err)) {
    return err.response?.data?.detail ?? err.message;
  }
  return err instanceof Error ? err.message : "Simulation failed";
}

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
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return { result, loading, error, run };
}
