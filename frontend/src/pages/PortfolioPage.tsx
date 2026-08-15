import { useState } from "react";
import AdvancedSettingsFields from "../components/AdvancedSettingsFields";
import BacktestWindowFields from "../components/BacktestWindowFields";
import PortfolioEquityChart from "../components/PortfolioEquityChart";
import PortfolioResultsPanel from "../components/PortfolioResultsPanel";
import PortfolioSymbolInput from "../components/PortfolioSymbolInput";
import StrategyPicker from "../components/StrategyPicker";
import { useSimulation } from "../hooks/useSimulation";
import { useStrategySelection } from "../hooks/useStrategySelection";

// Even split across `symbols`, expressed as whole percentages that sum to
// exactly 100 (the remainder from rounding goes to the last symbol).
function equalSplitWeights(symbols: string[]): Record<string, number> {
  if (symbols.length === 0) return {};
  const base = Math.floor(100 / symbols.length);
  const weights: Record<string, number> = {};
  symbols.forEach((symbol, index) => {
    weights[symbol] = index === symbols.length - 1 ? 100 - base * (symbols.length - 1) : base;
  });
  return weights;
}

const today = new Date().toISOString().slice(0, 10);
const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function PortfolioPage() {
  const [portfolioSymbols, setPortfolioSymbols] = useState<string[]>([]);
  const [portfolioWeights, setPortfolioWeights] = useState<Record<string, number>>({});
  const { strategies, selectedStrategy, parameters, setParameters, selectStrategy, currentStrategyParameters } =
    useStrategySelection();
  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(today);
  const [initialCapital, setInitialCapital] = useState(10_000);
  const [feePct, setFeePct] = useState(0.1);
  const [slippagePct, setSlippagePct] = useState(0.05);
  const [positionSizePct, setPositionSizePct] = useState(100);

  const { portfolioResult, portfolioLoading, portfolioError, runPortfolio } = useSimulation();

  // Called by PortfolioSymbolInput when a chip is added/removed. New symbols
  // re-split the whole basket evenly; removing one just drops its weight and
  // leaves the rest as they were (no need to renormalize server-side, since
  // the backend normalizes whatever weights it receives).
  function handlePortfolioSymbolsChange(nextSymbols: string[]) {
    setPortfolioSymbols(nextSymbols);
    setPortfolioWeights((current) => {
      const hasNewSymbol = nextSymbols.some((s) => !(s in current));
      if (!hasNewSymbol) {
        const next: Record<string, number> = {};
        nextSymbols.forEach((s) => {
          next[s] = current[s];
        });
        return next;
      }
      return equalSplitWeights(nextSymbols);
    });
  }

  function handleRun() {
    if (!selectedStrategy || portfolioSymbols.length === 0) return;

    runPortfolio({
      stock_symbols: portfolioSymbols,
      weights: portfolioWeights,
      strategy_type: selectedStrategy.type,
      strategy_parameters: currentStrategyParameters(),
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
      fee_pct: feePct,
      slippage_pct: slippagePct,
      position_size_pct: positionSizePct,
    });
  }

  return (
    <div className="page-shell">
      <h1>Portfolio</h1>
      <p className="page-subtitle">Run one strategy across a basket of symbols, weighted however you like.</p>

      <section className="controls">
        <div className="control-card">
          <div className="symbol-section">
            <PortfolioSymbolInput
              symbols={portfolioSymbols}
              weights={portfolioWeights}
              onSymbolsChange={handlePortfolioSymbolsChange}
              onWeightsChange={setPortfolioWeights}
            />
          </div>
        </div>

        <div className="controls-grid">
          <div className="control-card">
            <span className="control-card-title">Backtest window</span>
            <BacktestWindowFields
              startDate={startDate}
              endDate={endDate}
              initialCapital={initialCapital}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onInitialCapitalChange={setInitialCapital}
            />

            <div className="action-row">
              <button
                onClick={handleRun}
                disabled={portfolioLoading || !selectedStrategy || portfolioSymbols.length === 0}
              >
                {portfolioLoading ? "Running..." : "Run simulation"}
              </button>
            </div>
          </div>

          <div className="control-card">
            <StrategyPicker
              strategies={strategies}
              selected={selectedStrategy}
              parameters={parameters}
              onSelect={selectStrategy}
              onParametersChange={setParameters}
            />

            <AdvancedSettingsFields
              feePct={feePct}
              slippagePct={slippagePct}
              positionSizePct={positionSizePct}
              onFeePctChange={setFeePct}
              onSlippagePctChange={setSlippagePct}
              onPositionSizePctChange={setPositionSizePct}
            />
          </div>
        </div>
      </section>

      {portfolioError && <p className="error">{portfolioError}</p>}

      {portfolioResult && (
        <section className="results">
          <PortfolioEquityChart result={portfolioResult} />
          <PortfolioResultsPanel result={portfolioResult} />
        </section>
      )}
    </div>
  );
}
