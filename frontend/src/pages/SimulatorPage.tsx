import { useEffect, useState } from "react";
import { fetchStrategies } from "../api/client";
import ResultsPanel from "../components/ResultsPanel";
import StockPicker from "../components/StockPicker";
import StrategyPicker from "../components/StrategyPicker";
import TradeChart from "../components/TradeChart";
import { useSimulation } from "../hooks/useSimulation";
import type { StrategyCatalogEntry } from "../types";

const today = new Date().toISOString().slice(0, 10);
const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function SimulatorPage() {
  // Each useState below is one piece of form state: [currentValue, setterFn].
  // Calling the setter updates the value AND triggers a re-render of this
  // component (which re-renders its JSX further down with the new value).
  const [strategies, setStrategies] = useState<StrategyCatalogEntry[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyCatalogEntry | null>(null);
  const [parameters, setParameters] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(today);
  const [initialCapital, setInitialCapital] = useState(10_000);

  // Backend-call state (the last result, whether a request is in flight, any
  // error, and the function to trigger a new call) lives in this hook instead
  // of being duplicated here — see hooks/useSimulation.ts.
  const { result, loading, error, run } = useSimulation();

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
  // its dropdown. Resets the parameter values to that strategy's defaults.
  function handleSelectStrategy(strategy: StrategyCatalogEntry) {
    setSelectedStrategy(strategy);
    setParameters(Object.fromEntries(strategy.parameters.map((p) => [p.name, p.default])));
  }

  // Called when the "Run simulation" button is clicked. Bundles up all the
  // current form state into one request object and hands it to the hook's
  // run(), which POSTs it to the backend (see api/client.ts runSimulation).
  function handleRun() {
    if (!selectedStrategy) return;
    run({
      stock_symbol: symbol,
      strategy_type: selectedStrategy.type,
      strategy_parameters: parameters,
      start_date: startDate,
      end_date: endDate,
      initial_capital: initialCapital,
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

        {/* Disabled while a request is in flight or before any strategy has
            loaded/been picked; label swaps to a loading state too. */}
        <button onClick={handleRun} disabled={loading || !selectedStrategy}>
          {loading ? "Running..." : "Run simulation"}
        </button>
      </section>

      {/* {expr && <jsx/>} is the common "render only if truthy" idiom:
          nothing shows until there's an error / a result to display. */}
      {error && <p className="error">{error}</p>}

      {result && (
        <section className="results">
          <TradeChart result={result} parameters={parameters} />
          <ResultsPanel result={result} />
        </section>
      )}
    </main>
  );
}
