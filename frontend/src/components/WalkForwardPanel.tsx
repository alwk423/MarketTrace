import type { WalkForwardResult, WalkForwardWindowResult } from "../types";

interface WalkForwardPanelProps {
  result: WalkForwardResult;
}

function WindowCard({ title, window }: { title: string; window: WalkForwardWindowResult }) {
  return (
    <div className="regime-card">
      <span>
        {title} ({window.start_date} – {window.end_date})
      </span>
      <strong className={window.total_return_pct >= 0 ? "positive" : "negative"}>
        {window.total_return_pct.toFixed(2)}%
      </strong>
      <small>
        Sharpe {window.sharpe.toFixed(2)} · {window.trade_count} trade{window.trade_count === 1 ? "" : "s"}
      </small>
    </div>
  );
}

// Side-by-side train/test cards, same layout ResultsPanel uses for its
// bull/bear regime cards - the comparison is the whole point here too.
export default function WalkForwardPanel({ result }: WalkForwardPanelProps) {
  return (
    <div className="results-panel">
      <div className="panel-header">
        <div>
          <h2>Walk-forward test</h2>
          <p>In-sample performance before {result.split_date} vs. out-of-sample performance after it.</p>
        </div>
        {result.optimized_parameters && (
          <span className="panel-chip">
            Optimized on train:{" "}
            {Object.entries(result.optimized_parameters)
              .map(([key, value]) => `${key}=${value}`)
              .join(", ")}
          </span>
        )}
      </div>

      <div className="regime-cards">
        <WindowCard title="Train" window={result.train} />
        <WindowCard title="Test" window={result.test} />
      </div>
    </div>
  );
}
