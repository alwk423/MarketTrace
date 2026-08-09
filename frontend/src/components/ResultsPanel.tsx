import type { SimulationResult } from "../types";

interface ResultsPanelProps {
  result: SimulationResult;
}

export default function ResultsPanel({ result }: ResultsPanelProps) {
  return (
    <div className="results-panel">
      <div className="metrics">
        <div>
          <span>Return before costs</span>
          <strong className={result.return_before_costs_pct >= 0 ? "positive" : "negative"}>
            {result.return_before_costs_pct.toFixed(2)}%
          </strong>
        </div>
        <div>
          <span>Return after costs</span>
          <strong className={result.total_return_pct >= 0 ? "positive" : "negative"}>
            {result.total_return_pct.toFixed(2)}%
          </strong>
        </div>
        {typeof result.buy_and_hold_return_pct === "number" && (
          <div>
            <span>Buy &amp; hold return</span>
            <strong className={result.buy_and_hold_return_pct >= 0 ? "positive" : "negative"}>
              {result.buy_and_hold_return_pct.toFixed(2)}%
            </strong>
            <small className={result.total_return_pct - result.buy_and_hold_return_pct >= 0 ? "positive" : "negative"}>
              {result.total_return_pct - result.buy_and_hold_return_pct >= 0 ? "+" : ""}
              {(result.total_return_pct - result.buy_and_hold_return_pct).toFixed(2)}% vs strategy
            </small>
          </div>
        )}
        <div>
          <span>Sharpe ratio</span>
          <strong>{result.sharpe.toFixed(2)}</strong>
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

      <div className="regime-cards">
        <div className="regime-card bull">
          <span>Bull market return</span>
          <strong className={result.regime_split.bull_market_return_pct >= 0 ? "positive" : "negative"}>
            {result.regime_split.bull_market_return_pct.toFixed(2)}%
          </strong>
        </div>
        <div className="regime-card bear">
          <span>Bear market return</span>
          <strong className={result.regime_split.bear_market_return_pct >= 0 ? "positive" : "negative"}>
            {result.regime_split.bear_market_return_pct.toFixed(2)}%
          </strong>
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
