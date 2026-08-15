import { isAxiosError } from "axios";
import { useState } from "react";
import { saveCustomStrategy } from "../api/client";
import type { RuleCondition, RuleIndicator, RuleOperator, StrategyCatalogEntry } from "../types";

function defaultCondition(): RuleCondition {
  return { indicator: "rsi", period: 14, op: "<", value: 30 };
}

const OPERATOR_PHRASES: Record<RuleOperator, string> = {
  "<": "drops below",
  "<=": "drops to or below",
  ">": "rises above",
  ">=": "rises to or above",
  "==": "equals",
  "!=": "is not",
};

const INDICATOR_LABELS: Record<RuleIndicator, (period: number | null) => string> = {
  rsi: (period) => `RSI(${period ?? "?"})`,
  sma: (period) => `SMA(${period ?? "?"})`,
  price: () => "Price",
};

function describeCondition(condition: RuleCondition): string {
  const subject = INDICATOR_LABELS[condition.indicator](condition.period);
  return `${subject} ${OPERATOR_PHRASES[condition.op]} ${condition.value}`;
}

function describeGroup(action: "Buy" | "Sell", conditions: RuleCondition[]): string {
  if (conditions.length === 0) return `${action}: no conditions set yet.`;
  return `${action} when ${conditions.map(describeCondition).join(" AND ")}.`;
}

interface ConditionGroupEditorProps {
  title: string;
  actionLabel: "Buy" | "Sell";
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
}

function ConditionGroupEditor({ title, actionLabel, conditions, onChange }: ConditionGroupEditorProps) {
  function updateCondition(index: number, patch: Partial<RuleCondition>) {
    onChange(conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)));
  }

  function addCondition() {
    onChange([...conditions, defaultCondition()]);
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="rule-group">
      <div className="rule-group-header">
        <h4>{title}</h4>
        <button type="button" className="secondary-button rule-add" onClick={addCondition}>
          + Add condition
        </button>
      </div>

      {conditions.length === 0 && <p className="rule-empty">No conditions yet.</p>}

      {conditions.map((condition, index) => (
        <div className="rule-condition" key={index}>
          {index > 0 && <span className="rule-and">AND</span>}

          <select
            aria-label="Indicator"
            value={condition.indicator}
            onChange={(e) => {
              const indicator = e.target.value as RuleIndicator;
              updateCondition(index, {
                indicator,
                period: indicator === "price" ? null : condition.period ?? 14,
              });
            }}
          >
            <option value="rsi">RSI</option>
            <option value="sma">SMA</option>
            <option value="price">Price</option>
          </select>

          {condition.indicator !== "price" && (
            <input
              aria-label="Period"
              type="number"
              min={1}
              value={condition.period ?? ""}
              placeholder="Period"
              onChange={(e) => updateCondition(index, { period: Number(e.target.value) })}
            />
          )}

          <select
            aria-label="Operator"
            value={condition.op}
            onChange={(e) => updateCondition(index, { op: e.target.value as RuleOperator })}
          >
            <option value="<">&lt;</option>
            <option value="<=">&le;</option>
            <option value=">">&gt;</option>
            <option value=">=">&ge;</option>
            <option value="==">=</option>
            <option value="!=">&ne;</option>
          </select>

          <input
            aria-label="Value"
            type="number"
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: Number(e.target.value) })}
          />

          <button
            type="button"
            className="rule-remove"
            aria-label="Remove condition"
            onClick={() => removeCondition(index)}
          >
            &times;
          </button>
        </div>
      ))}

      <p className="rule-preview">{describeGroup(actionLabel, conditions)}</p>
    </div>
  );
}

interface StrategyBuilderProps {
  // Called with the freshly saved strategy (already shaped as a
  // StrategyCatalogEntry) so the caller can drop it straight into the picker.
  onSaved: (entry: StrategyCatalogEntry) => void;
}

export default function StrategyBuilder({ onSaved }: StrategyBuilderProps) {
  const [name, setName] = useState("");
  const [buyConditions, setBuyConditions] = useState<RuleCondition[]>([defaultCondition()]);
  const [sellConditions, setSellConditions] = useState<RuleCondition[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && (buyConditions.length > 0 || sellConditions.length > 0);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const entry = await saveCustomStrategy({
        name: name.trim(),
        rules: { buy: { all: buyConditions }, sell: { all: sellConditions } },
      });
      onSaved(entry);
      setName("");
      setBuyConditions([defaultCondition()]);
      setSellConditions([]);
    } catch (err) {
      const message = isAxiosError<{ detail?: string }>(err)
        ? (err.response?.data?.detail ?? err.message)
        : "Could not save strategy";
      setError(typeof message === "string" ? message : "Could not save strategy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="strategy-builder">
      <div className="strategy-builder-body">
        <label className="strategy-builder-name">
          Name
          <input
            type="text"
            value={name}
            placeholder="e.g. RSI dip buyer"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="strategy-builder-groups">
          <ConditionGroupEditor
            title="Buy when"
            actionLabel="Buy"
            conditions={buyConditions}
            onChange={setBuyConditions}
          />
          <ConditionGroupEditor
            title="Sell when"
            actionLabel="Sell"
            conditions={sellConditions}
            onChange={setSellConditions}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="action-row">
          <button type="button" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? "Saving..." : "Save custom strategy"}
          </button>
        </div>
      </div>
    </div>
  );
}
