import { useEffect, useState } from "react";
import { POPULAR_SYMBOLS } from "../data/popularSymbols";
import type { PopularSymbol } from "../data/popularSymbols";

// Module-scoped (not component state) so every SymbolAutocomplete instance on
// the page shares one fetch of the full ~12k-ticker directory instead of each
// requesting it separately.
let cached: PopularSymbol[] | null = null;
let inFlight: Promise<PopularSymbol[]> | null = null;

function loadSymbolDirectory(): Promise<PopularSymbol[]> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = fetch("/symbols.json")
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load symbol directory: ${res.status}`);
      return res.json() as Promise<PopularSymbol[]>;
    })
    .then((data) => {
      cached = data;
      return data;
    })
    .catch(() => {
      // Static asset missing/offline - fall back to the small curated list
      // rather than leaving the dropdown empty.
      cached = POPULAR_SYMBOLS;
      return cached;
    });

  return inFlight;
}

// All US-listed NASDAQ/NYSE/AMEX tickers (~12k), generated from NASDAQ
// Trader's public symbol directory. Loaded once, lazily, on first use - not
// bundled into the main JS chunk since it's only needed once a symbol input
// is actually opened.
export function useSymbolDirectory(): { symbols: PopularSymbol[]; loading: boolean } {
  const [symbols, setSymbols] = useState<PopularSymbol[]>(cached ?? []);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    loadSymbolDirectory().then((data) => {
      if (!cancelled) {
        setSymbols(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { symbols, loading };
}
