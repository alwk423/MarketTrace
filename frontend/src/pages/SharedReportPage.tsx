import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPublicSimulation } from "../api/client";
import ResultsPanel from "../components/ResultsPanel";
import TradeChart from "../components/TradeChart";
import type { SimulationResult } from "../types";

const STRATEGY_LABELS: Record<string, string> = {
  sma_crossover: "SMA Crossover",
  rsi: "RSI Mean Reversion",
  custom: "Custom",
};

function formatDate(value: string): string {
  return value.slice(0, 10);
}

// Standalone, unauthenticated report view - the target of a Share button's
// permalink (/share/:id -> GET /api/simulations/public/:id). Deliberately
// skips AppLayout/Header: whoever opens this link may not have an account,
// so it renders on its own instead of behind ProtectedRoute.
export default function SharedReportPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchPublicSimulation(id)
      .then(setResult)
      .catch((err) => {
        setError(
          isAxiosError(err) && err.response?.status === 404
            ? "This report isn't shared, or doesn't exist."
            : "Couldn't load this report.",
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="share-page">
      <header className="share-page-header">
        <Link to="/" className="brand">
          MarketTrace
        </Link>
      </header>

      <main className="share-page-body">
        {loading && <p>Loading report...</p>}
        {error && <p className="error">{error}</p>}

        {result && (
          <div className="page-shell">
            <h1>
              {result.stock_symbol} &middot; {STRATEGY_LABELS[result.strategy_type ?? ""] ?? result.strategy_name ?? "Strategy"}
            </h1>
            <p className="page-subtitle">
              {formatDate(result.start_date)} – {formatDate(result.end_date)}
            </p>

            <section className="results">
              <TradeChart result={result} />
              <ResultsPanel result={result} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
