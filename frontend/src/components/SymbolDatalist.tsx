import { POPULAR_SYMBOLS } from "../data/popularSymbols";

export const POPULAR_SYMBOLS_DATALIST_ID = "popular-symbols";

// Shared <datalist> of popular tickers, wired up via the `list` attribute on
// any <input>. Rendered once per page (StockPicker and PortfolioSymbolInput
// are mutually exclusive, so there's never more than one mounted at a time).
export default function SymbolDatalist() {
  return (
    <datalist id={POPULAR_SYMBOLS_DATALIST_ID}>
      {POPULAR_SYMBOLS.map((entry) => (
        <option key={entry.symbol} value={entry.symbol}>
          {entry.name}
        </option>
      ))}
    </datalist>
  );
}
