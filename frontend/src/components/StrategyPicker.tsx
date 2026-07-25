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
          value={selected?.type ?? ""}
          onChange={(e) => {
            const strategy = strategies.find((s) => s.type === e.target.value);
            if (strategy) onSelect(strategy);
          }}
        >
          <option value="" disabled>
            Select a strategy
          </option>
          {strategies.map((strategy) => (
            <option key={strategy.type} value={strategy.type}>
              {strategy.label}
            </option>
          ))}
        </select>
      </label>

      {selected && <p className="strategy-description">{selected.description}</p>}

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
