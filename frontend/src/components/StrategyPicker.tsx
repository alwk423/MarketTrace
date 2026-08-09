import type { StrategyCatalogEntry } from "../types";

interface StrategyPickerProps {
  strategies: StrategyCatalogEntry[];
  selected: StrategyCatalogEntry | null;
  parameters: Record<string, number>;
  onSelect: (strategy: StrategyCatalogEntry) => void;
  onParametersChange: (parameters: Record<string, number>) => void;
}

export default function StrategyPicker({
  strategies,
  selected,
  parameters,
  onSelect,
  onParametersChange,
}: StrategyPickerProps) {
  return (
    <div className="strategy-picker">
      <label>
        Strategy
        <select
          value={(selected?.id ?? selected?.type) ?? ""}
          onChange={(e) => {
            const strategy = strategies.find((s) => (s.id ?? s.type) === e.target.value);
            if (strategy) onSelect(strategy);
          }}
        >
          <option value="" disabled>
            Select a strategy
          </option>
          {strategies.map((strategy) => (
            <option key={strategy.id ?? strategy.type} value={strategy.id ?? strategy.type}>
              {strategy.label}
              {strategy.is_custom ? " · Custom" : ""}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <p className="strategy-description">
          {selected.is_custom && <span className="panel-chip strategy-badge">Custom</span>}
          {selected.description}
        </p>
      )}

      {selected?.parameters.map((param) => (
        <label key={param.name}>
          {param.label}
          <input
            type="number"
            value={parameters[param.name] ?? param.default}
            onChange={(e) =>
              onParametersChange({ ...parameters, [param.name]: Number(e.target.value) })
            }
          />
        </label>
      ))}
    </div>
  );
}
