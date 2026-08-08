import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimulationResult } from "../types";

interface TradeChartProps {
  result: SimulationResult;
}

export default function TradeChart({ result }: TradeChartProps) {
  const data = result.equity_curve.map((point) => ({
    date: point.date.slice(0, 10),
    price: point.price,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" minTickGap={30} />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="price" stroke="#2563eb" dot={false} name="Price" />
        {result.trades.map((trade) => (
          <ReferenceDot
            key={`${trade.trade_type}-${trade.trade_date}`}
            x={trade.trade_date.slice(0, 10)}
            y={trade.price}
            r={5}
            fill={trade.trade_type === "buy" ? "#16a34a" : "#dc2626"}
            stroke="none"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
