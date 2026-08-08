import type { SimulationResult } from "../types";

interface ResultsPanelProps {
  result: SimulationResult;
}

export default function ResultsPanel({ result }: ResultsPanelProps) {
  return (
    <div className="results-panel">
      <div className="metrics">
        <div>
          <span>Total return</span>
          <strong className={result.total_return_pct >= 0 ? "positive" : "negative"}>
            {result.total_return_pct.toFixed(2)}%
          </strong>
          {typeof result.buy_and_hold_return_pct === "number" && (
            <small className={result.total_return_pct - (result.buy_and_hold_return_pct ?? 0) >= 0 ? "positive" : "negative"} style={{ marginLeft: 8 }}>
              vs Buy & Hold: {(result.buy_and_hold_return_pct ?? 0).toFixed(2)}% ({(result.total_return_pct - (result.buy_and_hold_return_pct ?? 0)).toFixed(2)}%)
            </small>
          )}
        </div>
        <div>
          <span>Final capital</span>
          <strong>${result.final_capital.toFixed(2)}</strong>
        </div>
        <div>
          <span>Trades</span>
          <strong>{result.trades.length}</strong>
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
          {result.trades.map((trade) => (
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
    </div>
  );
}
