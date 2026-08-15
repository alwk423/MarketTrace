import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { fetchSimulationDetail, fetchSimulationHistory } from "../api/client";
import ShareButton from "../components/ShareButton";
import type { SimulationResult, SimulationSummary } from "../types";

const STRATEGY_LABELS: Record<string, string> = {
  sma_crossover: "SMA Crossover",
  rsi: "RSI Mean Reversion",
  custom: "Custom",
};

function formatDate(value: string): string {
  return value.slice(0, 10);
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<SimulationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SimulationResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetchSimulationHistory()
      .then(setRuns)
      .catch((err) => {
        setError(isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail ?? err.message : "Could not load history");
      });
  }, []);

  // Keeps the table's "Shared" badge in sync when the flag is flipped from
  // the detail panel below - without this the row would still show its
  // pre-toggle state until the page is reloaded.
  function handleVisibilityChange(id: string, isPublic: boolean) {
    setRuns((current) => current?.map((run) => (run.id === id ? { ...run, is_public: isPublic } : run)) ?? current);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    fetchSimulationDetail(id)
      .then(setDetail)
      .catch((err) => {
        setDetailError(
          isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail ?? err.message : "Could not load run",
        );
      })
      .finally(() => setDetailLoading(false));
  }

  return (
    <div className="page-shell">
      <h1>History</h1>
      <p className="page-subtitle">Every simulation you've run, saved to your account.</p>

      {error && <p className="error">{error}</p>}

      {runs && runs.length === 0 && (
        <div className="history-empty">
          No simulations yet — run one from Simulate and it'll show up here.
        </div>
      )}

      {runs && runs.length > 0 && (
        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Strategy</th>
                <th>Window</th>
                <th>Return</th>
                <th>Run date</th>
                <th>Shared</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={run.id === selectedId ? "history-row selected" : "history-row"}
                  onClick={() => handleSelect(run.id)}
                >
                  <td>{run.stock_symbol}</td>
                  <td>{STRATEGY_LABELS[run.strategy_type] ?? run.strategy_name}</td>
                  <td>
                    {formatDate(run.start_date)} – {formatDate(run.end_date)}
                  </td>
                  <td className={run.total_return_pct >= 0 ? "positive" : "negative"}>
                    {run.total_return_pct.toFixed(2)}%
                  </td>
                  <td>{formatDate(run.created_at)}</td>
                  <td>{run.is_public && <span className="panel-chip">Public</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <div className="history-detail">
          {detailLoading && <p>Loading run...</p>}
          {detailError && <p className="error">{detailError}</p>}

          {detail && (
            <>
              <div className="results-header">
                <ShareButton
                  key={detail.id}
                  simulationId={detail.id}
                  isPublic={detail.is_public}
                  onVisibilityChange={(isPublic) => handleVisibilityChange(detail.id, isPublic)}
                />
              </div>

              <div className="history-detail-stats">
                <div className="history-stat">
                  <span className="history-stat-label">Initial capital</span>
                  <strong className="history-stat-value">${detail.initial_capital.toFixed(2)}</strong>
                </div>
                <div className="history-stat">
                  <span className="history-stat-label">Final capital</span>
                  <strong className="history-stat-value">${detail.final_capital.toFixed(2)}</strong>
                </div>
                <div className="history-stat">
                  <span className="history-stat-label">Return</span>
                  <strong className={`history-stat-value ${detail.total_return_pct >= 0 ? "positive" : "negative"}`}>
                    {detail.total_return_pct.toFixed(2)}%
                  </strong>
                </div>
                <div className="history-stat">
                  <span className="history-stat-label">Trades</span>
                  <strong className="history-stat-value">{detail.trades.length}</strong>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.trades.map((trade) => (
                    <tr key={`${trade.trade_date}-${trade.trade_type}`}>
                      <td>{trade.trade_date.slice(0, 10)}</td>
                      <td className={trade.trade_type}>{trade.trade_type}</td>
                      <td>${trade.price.toFixed(2)}</td>
                      <td>{trade.quantity.toFixed(4)}</td>
                      <td>{trade.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
