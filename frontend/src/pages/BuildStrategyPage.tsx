import { useState } from "react";
import StrategyBuilder from "../components/StrategyBuilder";
import type { StrategyCatalogEntry } from "../types";

export default function BuildStrategyPage() {
  const [savedName, setSavedName] = useState<string | null>(null);

  function handleSaved(entry: StrategyCatalogEntry) {
    setSavedName(entry.label);
  }

  return (
    <div className="page-shell">
      <h1>Build Strategy</h1>
      <p className="page-subtitle">
        Define buy/sell rules from indicators and thresholds — saved strategies show up in the picker on
        Simulate and Portfolio.
      </p>

      {savedName && <p className="save-confirmation">Saved "{savedName}" — find it in the strategy picker on Simulate or Portfolio.</p>}

      <StrategyBuilder onSaved={handleSaved} />
    </div>
  );
}
