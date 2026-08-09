import PortfolioComparisonTable from "./PortfolioComparisonTable";
import type { PortfolioSimulationResult } from "../types";

interface PortfolioResultsPanelProps {
  result: PortfolioSimulationResult;
}

export default function PortfolioResultsPanel({ result }: PortfolioResultsPanelProps) {
  return (
    <div className="results-panel">
      <div className="metrics">
        <div>
          <span>Combined return</span>
          <strong className={result.total_return_pct >= 0 ? "positive" : "negative"}>
            {result.total_return_pct.toFixed(2)}%
          </strong>
        </div>
        {typeof result.combined_buy_and_hold_return_pct === "number" && (
          <div>
            <span>Buy &amp; hold return (basket)</span>
            <strong className={result.combined_buy_and_hold_return_pct >= 0 ? "positive" : "negative"}>
              {result.combined_buy_and_hold_return_pct.toFixed(2)}%
            </strong>
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
          <span>Symbols</span>
          <strong>{result.symbols.length}</strong>
        </div>
      </div>

      <PortfolioComparisonTable symbols={result.symbols} />
    </div>
  );
}
