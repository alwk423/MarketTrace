import { useEffect, useState } from "react";
import { fetchStrategies } from "../api/client";
import ResultsPanel from "../components/ResultsPanel";
import OptimizationHeatmap from "../components/OptimizationHeatmap";
import StockPicker from "../components/StockPicker";
import StrategyBuilder from "../components/StrategyBuilder";
import StrategyPicker from "../components/StrategyPicker";
import TradeChart from "../components/TradeChart";
import { useSimulation } from "../hooks/useSimulation";
import type { CustomStrategyRules, StrategyCatalogEntry } from "../types";

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

export default function SimulatorPage() {
  // Each useState below is one piece of form state: [currentValue, setterFn].
  // Calling the setter updates the value AND triggers a re-render of this
  // component (which re-renders its JSX further down with the new value).
  const [strategies, setStrategies] = useState<StrategyCatalogEntry[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyCatalogEntry | null>(null);
  const [parameters, setParameters] = useState<Record<string, number>>({});
  // Rules for the currently selected custom strategy (null for built-ins).
  // Kept separate from `parameters` since rules are a nested condition tree,
  // not the flat numeric knobs SMA/RSI use.
  const [customRules, setCustomRules] = useState<CustomStrategyRules | null>(null);
  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(today);
  const [initialCapital, setInitialCapital] = useState(10_000);
  const [feePct, setFeePct] = useState(0.1);
  const [slippagePct, setSlippagePct] = useState(0.05);
  const [positionSizePct, setPositionSizePct] = useState(100);

  // Backend-call state (the last result, whether a request is in flight, any
  // error, and the function to trigger a new call) lives in this hook instead
  // of being duplicated here — see hooks/useSimulation.ts.
  const {
    result,
    loading,
    error,
    run,
    optimization,
    optimizing,
    optimizationError,
    runOptimization,
  } = useSimulation();

  // useEffect(fn, []) runs `fn` exactly once, right after first render.
  // Here: load the strategy catalog from the backend and auto-select the
  // first one so the form isn't empty on page load.
  useEffect(() => {
    fetchStrategies().then((data) => {
      setStrategies(data);
      const [first] = data;
      if (first) {
        setSelectedStrategy(first);
        setParameters(Object.fromEntries(first.parameters.map((p) => [p.name, p.default])));
      }
    });
  }, []);

  // Called by StrategyPicker when the user picks a different strategy from
  // its dropdown. Resets the parameter values to that strategy's defaults
  // (or its saved rules, for a custom strategy).
  function handleSelectStrategy(strategy: StrategyCatalogEntry) {
    setSelectedStrategy(strategy);
    setParameters(Object.fromEntries(strategy.parameters.map((p) => [p.name, p.default])));
    setCustomRules(strategy.is_custom ? (strategy.rules ?? null) : null);
  }

  // Called by StrategyBuilder once a custom strategy has been saved to the
  // backend. Drops it into the picker's list, right alongside SMA/RSI, and
  // selects it so it's ready to run immediately.
  function handleCustomStrategySaved(entry: StrategyCatalogEntry) {
    setStrategies((current) => [...current, entry]);
    handleSelectStrategy(entry);
  }

  // Custom strategies carry their rules as a nested object rather than the
  // flat numeric `parameters` built-ins use.
  function currentStrategyParameters(): Record<string, unknown> {
    if (selectedStrategy?.type === "custom") {
      return { rules: customRules };
    }
    return parameters;
  }

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

  return (
    <main className="simulator">
      <h1>MarketTrace</h1>

      <section className="controls">
        {/* Controlled component pattern: parent passes down the current
            value + an onChange callback; the child calls that callback
            (e.g. setSymbol) whenever the user types, which updates state
            here and flows the new value back down as a prop. */}
        <StockPicker value={symbol} onChange={setSymbol} />

        <label>
          Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>

        <label>
          End date
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>

        <label>
          Initial capital
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
          />
        </label>

        <StrategyPicker
          strategies={strategies}
          selected={selectedStrategy}
          parameters={parameters}
          onSelect={handleSelectStrategy}
          onParametersChange={setParameters}
        />

        <details className="advanced-settings">
          <summary>Advanced settings</summary>
          <div className="advanced-settings-grid">
            <label>
              Fee (%)
              <input
                type="number"
                step="0.01"
                min="0"
                value={feePct}
                onChange={(e) => setFeePct(Number(e.target.value))}
              />
            </label>
            <label>
              Slippage (%)
              <input
                type="number"
                step="0.01"
                min="0"
                value={slippagePct}
                onChange={(e) => setSlippagePct(Number(e.target.value))}
              />
            </label>
            <label>
              Position size (%)
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={positionSizePct}
                onChange={(e) => setPositionSizePct(Number(e.target.value))}
              />
            </label>
          </div>
        </details>

        {/* Disabled while a request is in flight or before any strategy has
            loaded/been picked; label swaps to a loading state too. */}
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
      </section>

      {/* Its own full-width panel rather than a flex item alongside the form
          inputs above - once open it's a lot taller/wider than a numeric
          field, so it needs room to lay out the buy/sell groups side by side
          instead of fighting the controls row for space. */}
      <StrategyBuilder onSaved={handleCustomStrategySaved} />

      {/* {expr && <jsx/>} is the common "render only if truthy" idiom:
          nothing shows until there's an error / a result to display. */}
      {error && <p className="error">{error}</p>}
      {optimizationError && <p className="error">{optimizationError}</p>}

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
    </main>
  );
}
