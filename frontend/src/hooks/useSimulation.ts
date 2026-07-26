import { isAxiosError } from "axios";
import { useState } from "react";
import { runSimulation } from "../api/client";
import type { SimulationRequest, SimulationResult } from "../types";

// Turns whatever got thrown/caught into one displayable string. Not a hook,
// just a plain helper — no useState, no React involved.
function extractErrorMessage(err: unknown): string {
  if (isAxiosError<{ detail?: string }>(err)) {
    // FastAPI error responses look like { detail: "message" }; ?.  means
    // "don't crash if response/data is missing", ?? means "fall back to
    // axios's generic message if there's no .detail".
    return err.response?.data?.detail ?? err.message;
  }
  return err instanceof Error ? err.message : "Simulation failed";
}

// A custom hook: a reusable bundle of state + logic a component can pull in
// with one line (SimulatorPage.tsx calls useSimulation()). The only thing
// that makes it "a hook" is the useXxx name + that it calls useState inside.
export function useSimulation() {
  // This hook's own state — separate from SimulatorPage's useState calls
  // (symbol, startDate, etc.). Two different memory boxes.
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Called by SimulatorPage's handleRun(). All the setX calls below happen
  // HERE, in the frontend, in reaction to the backend's HTTP response — the
  // backend itself never calls setResult/setLoading/setError; it just sends
  // back JSON + a status code, and this function decides what that means.
  async function run(payload: SimulationRequest) {
    setLoading(true);   // mark "request in flight" -> button shows "Running..."
    setError(null);     // clear any error from a previous attempt
    try {
      // Actually sends POST /api/simulations (see api/client.ts) and waits
      // for the backend's response.
      const data = await runSimulation(payload);
      setResult(data);   // backend responded successfully -> store the result
    } catch (err) {
      // backend returned an error status, or the network call failed
      setError(extractErrorMessage(err));
    } finally {
      // runs whether it succeeded or failed -> always clear the loading flag
      setLoading(false);
    }
  }

  // Handed back to whatever component calls useSimulation(); SimulatorPage.tsx
  // destructures this into { result, loading, error, run }.
  return { result, loading, error, run };
}
