import SymbolDatalist, { POPULAR_SYMBOLS_DATALIST_ID } from "./SymbolDatalist";

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
        list={POPULAR_SYMBOLS_DATALIST_ID}
      />
      <SymbolDatalist />
    </label>
  );
}
