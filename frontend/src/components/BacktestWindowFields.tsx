interface BacktestWindowFieldsProps {
  startDate: string;
  endDate: string;
  initialCapital: number;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onInitialCapitalChange: (value: number) => void;
}

export default function BacktestWindowFields({
  startDate,
  endDate,
  initialCapital,
  onStartDateChange,
  onEndDateChange,
  onInitialCapitalChange,
}: BacktestWindowFieldsProps) {
  return (
    <div className="controls-row">
      <label>
        Start date
        <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
      </label>

      <label>
        End date
        <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
      </label>

      <label>
        Initial capital
        <input
          type="number"
          value={initialCapital}
          onChange={(e) => onInitialCapitalChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
