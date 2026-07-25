interface StockPickerProps {
  value: string;
  onChange: (symbol: string) => void;
}

export default function StockPicker({ value, onChange }: StockPickerProps) {
  return (
    <label>
      Stock symbol
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="AAPL"
      />
    </label>
  );
}
