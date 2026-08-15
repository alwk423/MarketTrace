interface AdvancedSettingsFieldsProps {
  feePct: number;
  slippagePct: number;
  positionSizePct: number;
  onFeePctChange: (value: number) => void;
  onSlippagePctChange: (value: number) => void;
  onPositionSizePctChange: (value: number) => void;
}

export default function AdvancedSettingsFields({
  feePct,
  slippagePct,
  positionSizePct,
  onFeePctChange,
  onSlippagePctChange,
  onPositionSizePctChange,
}: AdvancedSettingsFieldsProps) {
  return (
    <details className="advanced-settings">
      <summary>Advanced settings</summary>
      <div className="advanced-settings-grid">
        <label>
          Fee (%)
          <input
            type="number"
            step="0.01"
            min="0"
            value={feePct}
            onChange={(e) => onFeePctChange(Number(e.target.value))}
          />
        </label>
        <label>
          Slippage (%)
          <input
            type="number"
            step="0.01"
            min="0"
            value={slippagePct}
            onChange={(e) => onSlippagePctChange(Number(e.target.value))}
          />
        </label>
        <label>
          Position size (%)
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={positionSizePct}
            onChange={(e) => onPositionSizePctChange(Number(e.target.value))}
          />
        </label>
      </div>
    </details>
  );
}
