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
  const [strategies, setStrategies] = useState<StrategyCatalogEntry[]>([]);
  const [symbol, setSymbol] = useState("AAPL");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyCatalogEntry | null>(null);
  const [parameters, setParameters] = useState<Record<string, number>>({});
  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(today);
  const [initialCapital, setInitialCapital] = useState(10_000);

  const { result, loading, error, run } = useSimulation();

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

  function handleSelectStrategy(strategy: StrategyCatalogEntry) {
    setSelectedStrategy(strategy);
    setParameters(Object.fromEntries(strategy.parameters.map((p) => [p.name, p.default])));
  }

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

        <button onClick={handleRun} disabled={loading || !selectedStrategy}>
          {loading ? "Running..." : "Run simulation"}
        </button>
      </section>

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="results">
          <TradeChart result={result} />
          <ResultsPanel result={result} />
        </section>
      )}
    </main>
  );
}
