import { useState } from "react";
import type { KeyboardEvent } from "react";
import SymbolAutocomplete from "./SymbolAutocomplete";

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

  function setWeight(symbol: string, weight: number) {
    onWeightsChange({ ...weights, [symbol]: Math.max(0, Math.min(100, weight)) });
  }

  // Handles the keys SymbolAutocomplete doesn't already own (arrow nav/Escape/
  // Enter-on-a-highlighted-suggestion) - raw Enter/comma adds whatever text is
  // typed as its own chip, and Backspace on an empty box pops the last chip.
  function handleFallbackKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
        <SymbolAutocomplete
          value={draft}
          onChange={setDraft}
          onSelect={addSymbol}
          onKeyDown={handleFallbackKeyDown}
          placeholder="Type a symbol, hit enter…"
        />
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
          <div className="portfolio-weights-header">
            <span className="portfolio-weights-label">Weight (default equal-split)</span>
            <span className={`weight-total ${Math.round(weightTotal) === 100 ? "positive" : "negative"}`}>
              Total: {weightTotal.toFixed(0)}%
            </span>
          </div>
          <div className="weight-rows">
            {symbols.map((symbol) => (
              <div key={symbol} className="weight-row">
                <span className="weight-row-symbol">{symbol}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={weights[symbol] ?? 0}
                  onChange={(e) => setWeight(symbol, Number(e.target.value))}
                  aria-label={`${symbol} weight percent`}
                />
                <span className="weight-row-value">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={weights[symbol] ?? 0}
                    onChange={(e) => setWeight(symbol, Number(e.target.value))}
                  />
                  %
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
