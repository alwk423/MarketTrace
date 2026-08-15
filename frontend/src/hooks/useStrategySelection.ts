import { useEffect, useState } from "react";
import { fetchStrategies } from "../api/client";
import type { CustomStrategyRules, StrategyCatalogEntry } from "../types";

// Strategy catalog + "which one is picked, with what parameters" state -
// identical on Simulate and Portfolio (both offer the same picker and both
// need to turn the selection into a request payload), so it lives here
// instead of being copy-pasted between the two pages.
export function useStrategySelection() {
  const [strategies, setStrategies] = useState<StrategyCatalogEntry[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyCatalogEntry | null>(null);
  const [parameters, setParameters] = useState<Record<string, number>>({});
  // Rules for the currently selected custom strategy (null for built-ins).
  // Kept separate from `parameters` since rules are a nested condition tree,
  // not the flat numeric knobs SMA/RSI use.
  const [customRules, setCustomRules] = useState<CustomStrategyRules | null>(null);

  // Load the strategy catalog from the backend and auto-select the first one
  // so the form isn't empty on page load.
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
  function selectStrategy(strategy: StrategyCatalogEntry) {
    setSelectedStrategy(strategy);
    setParameters(Object.fromEntries(strategy.parameters.map((p) => [p.name, p.default])));
    setCustomRules(strategy.is_custom ? (strategy.rules ?? null) : null);
  }

  // Custom strategies carry their rules as a nested object rather than the
  // flat numeric `parameters` built-ins use - this is what should actually
  // go in a request's strategy_parameters field.
  function currentStrategyParameters(): Record<string, unknown> {
    if (selectedStrategy?.type === "custom") {
      return { rules: customRules };
    }
    return parameters;
  }

  return { strategies, selectedStrategy, parameters, setParameters, selectStrategy, currentStrategyParameters };
}
