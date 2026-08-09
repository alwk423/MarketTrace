import { useState } from "react";
import type { KeyboardEvent } from "react";
import SymbolDatalist, { POPULAR_SYMBOLS_DATALIST_ID } from "./SymbolDatalist";

interface PortfolioSymbolInputProps {
  symbols: string[];
  weights: Record<string, number>;
  onSymbolsChange: (symbols: string[]) => void;
  onWeightsChange: (weights: Record<string, number>) => void;
}

export default function PortfolioSymbolInput({
  symbols,
  weights,
  onSymbolsChange,
  onWeightsChange,
}: PortfolioSymbolInputProps) {
  const [draft, setDraft] = useState("");

  function addSymbol(rawValue: string) {
    const symbol = rawValue.trim().toUpperCase();
    if (!symbol || symbols.includes(symbol)) {
      setDraft("");
      return;
    }
    onSymbolsChange([...symbols, symbol]);
    setDraft("");
  }

  function removeSymbol(symbol: string) {
    onSymbolsChange(symbols.filter((s) => s !== symbol));
    const nextWeights = { ...weights };
    delete nextWeights[symbol];
    onWeightsChange(nextWeights);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSymbol(draft);
    } else if (e.key === "Backspace" && draft === "" && symbols.length > 0) {
      removeSymbol(symbols[symbols.length - 1]);
    }
  }

  const weightTotal = symbols.reduce((sum, symbol) => sum + (weights[symbol] ?? 0), 0);

  return (
    <div className="symbol-tag-input">
      <label>
        Stock symbols (basket)
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onBlur={() => addSymbol(draft)}
          placeholder="Type a symbol, hit enter…"
          list={POPULAR_SYMBOLS_DATALIST_ID}
        />
        <SymbolDatalist />
      </label>

      {symbols.length > 0 && (
        <ul className="symbol-chip-list">
          {symbols.map((symbol) => (
            <li key={symbol} className="symbol-chip">
              {symbol}
              <button
                type="button"
                aria-label={`Remove ${symbol}`}
                onClick={() => removeSymbol(symbol)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {symbols.length > 0 && (
        <div className="portfolio-weights">
          <span className="portfolio-weights-label">Weight (%, default equal-split)</span>
          <div className="weight-rows">
            {symbols.map((symbol) => (
              <label key={symbol} className="weight-row">
                <span>{symbol}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={weights[symbol] ?? 0}
                  onChange={(e) =>
                    onWeightsChange({ ...weights, [symbol]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <span className={`weight-total ${Math.round(weightTotal) === 100 ? "positive" : "negative"}`}>
            Total: {weightTotal.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
