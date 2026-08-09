import SymbolAutocomplete from "./SymbolAutocomplete";

interface StockPickerProps {
  value: string;
  onChange: (symbol: string) => void;
}

export default function StockPicker({ value, onChange }: StockPickerProps) {
  return (
    <label>
      Stock symbol
      <SymbolAutocomplete value={value} onChange={onChange} onSelect={onChange} placeholder="AAPL" />
    </label>
  );
}
