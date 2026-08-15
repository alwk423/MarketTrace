import { useState } from "react";
import AdvancedSettingsFields from "../components/AdvancedSettingsFields";
import BacktestWindowFields from "../components/BacktestWindowFields";
import MonteCarloPanel from "../components/MonteCarloPanel";
import OptimizationHeatmap from "../components/OptimizationHeatmap";
import ResultsPanel from "../components/ResultsPanel";
import StockPicker from "../components/StockPicker";
import StrategyPicker from "../components/StrategyPicker";
import TradeChart from "../components/TradeChart";
import WalkForwardChart from "../components/WalkForwardChart";
import WalkForwardPanel from "../components/WalkForwardPanel";
import { useSimulation } from "../hooks/useSimulation";
import { useStrategySelection } from "../hooks/useStrategySelection";

const today = new Date().toISOString().slice(0, 10);
const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function buildOptimizationGrid(parameters: Record<string, number>) {
  const shortWindow = Math.max(2, Math.round(parameters.short_window ?? 20));
  const longWindow = Math.max(shortWindow + 5, Math.round(parameters.long_window ?? 50));

  const shortWindows = [...new Set([shortWindow - 10, shortWindow - 5, shortWindow, shortWindow + 5, shortWindow + 10])]
    .filter((value) => value > 1)
    .sort((a, b) => a - b);
  const longWindows = [...new Set([longWindow - 20, longWindow - 10, longWindow, longWindow + 10, longWindow + 20])]
    .filter((value) => value > 1)
    .sort((a, b) => a - b);

  return { shortWindows, longWindows };
}

export default function SimulatePage() {
  const [symbol, setSymbol] = useState("AAPL");
  const { strategies, selectedStrategy, parameters, setParameters, selectStrategy, currentStrategyParameters } =
    useStrategySelection();
  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(today);
  const [initialCapital, setInitialCapital] = useState(10_000);
  const [feePct, setFeePct] = useState(0.1);
  const [slippagePct, setSlippagePct] = useState(0.05);
  const [positionSizePct, setPositionSizePct] = useState(100);
  // Robustness testing controls (walk-forward + Monte Carlo).
  const [trainRatio, setTrainRatio] = useState(0.7);
  const [optimizeOnTrain, setOptimizeOnTrain] = useState(false);
  const [numSimulations, setNumSimulations] = useState(500);

  const {
    result,
    loading,
    error,
    run,
    optimization,
    optimizing,
    optimizationError,
    runOptimization,
    walkForwardResult,
    walkForwardLoading,
    walkForwardError,
    runWalkForwardTest,
    monteCarloResult,
    monteCarloLoading,
    monteCarloError,
    runMonteCarloTest,
  } = useSimulation();

  function handleOptimize() {
    if (!selectedStrategy || selectedStrategy.type !== "sma_crossover") return;

    const { shortWindows, longWindows } = buildOptimizationGrid(parameters);
    runOptimization({
      stock_symbol: symbol,
      strategy_type: selectedStrategy.type,
      strategy_parameters: parameters,
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
      fee_pct: feePct,
      slippage_pct: slippagePct,
      position_size_pct: positionSizePct,
      short_windows: shortWindows,
      long_windows: longWindows,
    });
  }

  function handleSelectOptimizationPoint(point: { short_window: number; long_window: number }) {
    if (!selectedStrategy) return;

    const nextParameters = {
      ...parameters,
      ...point,
    };
    setParameters(nextParameters);
    run({
      stock_symbol: symbol,
      strategy_type: selectedStrategy.type,
      strategy_parameters: nextParameters,
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
      fee_pct: feePct,
      slippage_pct: slippagePct,
      position_size_pct: positionSizePct,
    });
  }

  // Called when the "Run simulation" button is clicked. Bundles up all the
  // current form state into one request object and hands it to the hook's
  // run(), which POSTs it to the backend (see api/client.ts runSimulation).
  function handleRun() {
    if (!selectedStrategy) return;

    run({
      stock_symbol: symbol,
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

  function handleWalkForward() {
    if (!selectedStrategy) return;

    const { shortWindows, longWindows } = buildOptimizationGrid(parameters);
    runWalkForwardTest({
      stock_symbol: symbol,
      strategy_type: selectedStrategy.type,
      strategy_parameters: currentStrategyParameters(),
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
      fee_pct: feePct,
      slippage_pct: slippagePct,
      position_size_pct: positionSizePct,
      train_ratio: trainRatio,
      optimize_on_train: optimizeOnTrain && selectedStrategy.type === "sma_crossover",
      short_windows: shortWindows,
      long_windows: longWindows,
    });
  }

  function handleMonteCarlo() {
    if (!selectedStrategy) return;

    runMonteCarloTest({
      stock_symbol: symbol,
      strategy_type: selectedStrategy.type,
      strategy_parameters: currentStrategyParameters(),
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
      fee_pct: feePct,
      slippage_pct: slippagePct,
      position_size_pct: positionSizePct,
      num_simulations: numSimulations,
    });
  }

  return (
    <div className="page-shell">
      <h1>Simulate</h1>
      <p className="page-subtitle">Backtest a strategy against a single symbol, then stress-test it.</p>

      <section className="controls">
        <div className="control-card">
          <div className="symbol-section">
            <StockPicker value={symbol} onChange={setSymbol} />
          </div>
        </div>

        {/* Two cards side by side rather than one long wrapping row - the
            strategy card usually runs taller (it carries its own parameter
            fields), and since each is its own bounded box that's expected
            instead of looking like broken alignment. */}
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
              <button onClick={handleRun} disabled={loading || !selectedStrategy}>
                {loading ? "Running..." : "Run simulation"}
              </button>
              <button
                onClick={handleOptimize}
                disabled={optimizing || !selectedStrategy || selectedStrategy.type !== "sma_crossover"}
                className="secondary-button"
              >
                {optimizing ? "Scanning grid..." : "Optimize parameters"}
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

        <div className="control-card">
          <span className="control-card-title">Robustness testing</span>
          <div className="controls-row">
            <label>
              Train ratio
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="0.9"
                value={trainRatio}
                onChange={(e) => setTrainRatio(Number(e.target.value))}
              />
            </label>
            <label
              className="mode-toggle"
              title={
                selectedStrategy?.type !== "sma_crossover"
                  ? "Only available for the SMA crossover strategy"
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={optimizeOnTrain}
                disabled={selectedStrategy?.type !== "sma_crossover"}
                onChange={(e) => setOptimizeOnTrain(e.target.checked)}
              />
              Optimize on train window
            </label>
            <label>
              Monte Carlo runs
              <input
                type="number"
                step="50"
                min="50"
                max="2000"
                value={numSimulations}
                onChange={(e) => setNumSimulations(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="action-row">
            <button
              onClick={handleWalkForward}
              disabled={walkForwardLoading || !selectedStrategy}
              className="secondary-button"
            >
              {walkForwardLoading ? "Running walk-forward..." : "Run walk-forward test"}
            </button>
            <button
              onClick={handleMonteCarlo}
              disabled={monteCarloLoading || !selectedStrategy}
              className="secondary-button"
            >
              {monteCarloLoading ? "Running Monte Carlo..." : "Run Monte Carlo simulation"}
            </button>
          </div>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {optimizationError && <p className="error">{optimizationError}</p>}
      {walkForwardError && <p className="error">{walkForwardError}</p>}
      {monteCarloError && <p className="error">{monteCarloError}</p>}

      {optimization && selectedStrategy?.type === "sma_crossover" && (
        <OptimizationHeatmap
          points={optimization.results}
          selectedParameters={
            "short_window" in parameters && "long_window" in parameters
              ? {
                  short_window: Math.round(parameters.short_window ?? 0),
                  long_window: Math.round(parameters.long_window ?? 0),
                }
              : null
          }
          onSelect={handleSelectOptimizationPoint}
        />
      )}

      {result && (
        <section className="results">
          <TradeChart result={result} parameters={parameters} />
          <ResultsPanel result={result} />
        </section>
      )}

      {walkForwardResult && (
        <section className="results">
          <WalkForwardChart result={walkForwardResult} />
          <WalkForwardPanel result={walkForwardResult} />
        </section>
      )}

      {monteCarloResult && (
        <section className="results">
          <MonteCarloPanel result={monteCarloResult} />
        </section>
      )}
    </div>
  );
}
