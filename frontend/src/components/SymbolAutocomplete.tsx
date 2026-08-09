import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { POPULAR_SYMBOLS } from "../data/popularSymbols";
import { useSymbolDirectory } from "../hooks/useSymbolDirectory";

interface SymbolAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  // Fired when the user picks a suggestion (click, or Enter while one is
  // highlighted). Typing freeform text without picking a suggestion is left
  // entirely to the caller via onChange/onKeyDown - selecting from the list
  // is just the fast path.
  onSelect: (symbol: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const MAX_RESULTS = 40;

export default function SymbolAutocomplete({
  value,
  onChange,
  onSelect,
  onKeyDown,
  placeholder,
  autoFocus,
}: SymbolAutocompleteProps) {
  const { symbols, loading } = useSymbolDirectory();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = value.trim().toUpperCase();

  const results = useMemo(() => {
    const directory = symbols.length > 0 ? symbols : POPULAR_SYMBOLS;
    if (!query) return POPULAR_SYMBOLS.slice(0, 12);

    const startsWith = directory.filter((entry) => entry.symbol.startsWith(query));
    const remaining = MAX_RESULTS - Math.min(startsWith.length, MAX_RESULTS);
    const contains =
      remaining > 0
        ? directory.filter(
            (entry) => !entry.symbol.startsWith(query) && entry.name.toUpperCase().includes(query),
          )
        : [];

    return [...startsWith, ...contains].slice(0, MAX_RESULTS);
  }, [query, symbols]);

  function handleSelect(symbol: string) {
    onSelect(symbol);
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => Math.min(current + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "Enter" && isOpen && results[highlightedIndex]) {
      e.preventDefault();
      handleSelect(results[highlightedIndex].symbol);
      return;
    }
    // Not one of our own navigation keys (or no suggestion is highlighted to
    // consume Enter/comma) - hand it to the caller, e.g. PortfolioSymbolInput
    // adding the raw typed text as a chip, or Backspace popping the last one.
    onKeyDown?.(e);
  }

  return (
    <div className="symbol-autocomplete">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setHighlightedIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {isOpen && results.length > 0 && (
        <ul className="symbol-autocomplete-menu" role="listbox">
          {results.map((entry, index) => (
            <li
              key={entry.symbol}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`symbol-autocomplete-option ${index === highlightedIndex ? "highlighted" : ""}`.trim()}
              // onMouseDown (not onClick) + preventDefault stops the input from
              // blurring before the click registers, so selecting a row never
              // races the onBlur-closes-the-menu handler above.
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(entry.symbol);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="symbol-autocomplete-symbol">{entry.symbol}</span>
              <span className="symbol-autocomplete-name">{entry.name}</span>
            </li>
          ))}
          {loading && <li className="symbol-autocomplete-status">Loading full ticker list…</li>}
        </ul>
      )}
    </div>
  );
}
