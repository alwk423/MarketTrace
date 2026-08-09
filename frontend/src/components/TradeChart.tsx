import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimulationResult } from "../types";

interface TradeChartProps {
  result: SimulationResult;
  // Current strategy parameters — only used to draw RSI oversold/overbought lines.
  parameters?: Record<string, number>;
}

const INDICATOR_COLORS: Record<string, string> = {
  short_sma: "#f97316",
  long_sma: "#7c3aed",
  rsi: "#8b5cf6",
};

const INDICATOR_LABELS: Record<string, string> = {
  short_sma: "Short SMA",
  long_sma: "Long SMA",
};

export default function TradeChart({ result, parameters }: TradeChartProps) {
  const indicators = result.indicators;
  const indicatorKeys = Object.keys(indicators);
  const priceIndicatorKeys = indicatorKeys.filter((key) => key !== "rsi");
  const hasRsi = indicatorKeys.includes("rsi");

  const indicatorByDate: Record<string, Record<string, number | null>> = {};
  for (const key of indicatorKeys) {
    indicatorByDate[key] = {};
    for (const point of indicators[key]) {
      indicatorByDate[key][point.date.slice(0, 10)] = point.value;
    }
  }

  const buyAndHoldByDate = new Map(
    result.buy_and_hold_equity_curve.map((point) => [point.date.slice(0, 10), point.price]),
  );

  const data = result.equity_curve.map((point) => {
    const date = point.date.slice(0, 10);
    const row: Record<string, number | string | null> = {
      date,
      price: point.price,
      buy_and_hold: buyAndHoldByDate.get(date) ?? null,
    };
    for (const key of priceIndicatorKeys) {
      row[key] = indicatorByDate[key][date] ?? null;
    }
    return row;
  });

  const prices = data.map((point) => point.price as number);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const padding = Math.max((maxPrice - minPrice) * 0.08, 1);

  const rsiData = hasRsi
    ? result.equity_curve.map((point) => {
        const date = point.date.slice(0, 10);
        return { date, rsi: indicatorByDate.rsi[date] ?? null };
      })
    : [];

  return (
    <div className="trade-chart">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={30} />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Legend />
          {result.regime_periods.map((period) => (
            <ReferenceArea
              key={`${period.regime}-${period.start_date}-${period.end_date}`}
              x1={period.start_date.slice(0, 10)}
              x2={period.end_date.slice(0, 10)}
              y1={minPrice - padding}
              y2={maxPrice + padding}
              ifOverflow="extendDomain"
              fill={period.regime === "bull" ? "rgba(15, 122, 61, 0.08)" : "rgba(179, 38, 30, 0.08)"}
              strokeOpacity={0}
            />
          ))}
          <Line type="monotone" dataKey="price" stroke="#1d4e89" dot={false} name="Price" />
          <Line
            type="monotone"
            dataKey="buy_and_hold"
            stroke="#5b6472"
            strokeDasharray="4 3"
            dot={false}
            name="Buy & hold"
          />
          {priceIndicatorKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={INDICATOR_COLORS[key] ?? "#94a3b8"}
              dot={false}
              name={INDICATOR_LABELS[key] ?? key}
            />
          ))}
          {result.trades.map((trade) => (
            <ReferenceDot
              key={`${trade.trade_type}-${trade.trade_date}`}
              x={trade.trade_date.slice(0, 10)}
              y={trade.price}
              r={5}
              fill={trade.trade_type === "buy" ? "#0f7a3d" : "#b3261e"}
              stroke="none"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {hasRsi && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={rsiData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={30} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <ReferenceLine y={parameters?.oversold ?? 30} stroke="#0f7a3d" strokeDasharray="3 3" />
            <ReferenceLine y={parameters?.overbought ?? 70} stroke="#b3261e" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="rsi" stroke={INDICATOR_COLORS.rsi} dot={false} name="RSI" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
