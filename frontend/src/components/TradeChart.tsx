import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";
import type { SimulationResult } from "../types";

interface TradeChartProps {
  result: SimulationResult;
  // current strategy parameters (used for RSI thresholds when available)
  parameters?: Record<string, number>;
}

const COLORS: Record<string, string> = {
  price: "#2563eb",
  short_sma: "#f97316",
  long_sma: "#ef4444",
  rsi: "#8b5cf6",
  equity: "#059669",
  buy_and_hold: "#64748b",
};

export default function TradeChart({ result, parameters }: TradeChartProps) {
  // Build a data array keyed by date that contains price, equity and any
  // indicator values present in `result.indicators`.
  const indicators = result.indicators ?? {};

  const indicatorKeys = Object.keys(indicators);
  const [visible, setVisible] = useState<Record<string, boolean>>(Object.fromEntries(indicatorKeys.map(k=>[k, true])));

  const data = useMemo(() => {
    // Map indicator arrays into a lookup by date for quick merging
    const indicatorLookup: Record<string, Record<string, number | null>> = {};
    for (const key of Object.keys(indicators)) {
      indicatorLookup[key] = {};
      for (const pt of indicators[key]) {
        // date may include time; normalize to YYYY-MM-DD
        indicatorLookup[key][pt.date.slice(0, 10)] = pt.value;
      }
    }

    return result.equity_curve.map((point) => {
      const date = point.date.slice(0, 10);
      const base: Record<string, any> = { date, price: point.price, equity: point.equity };
      for (const key of Object.keys(indicatorLookup)) {
        base[key] = indicatorLookup[key][date] ?? null;
      }
      return base;
    });
  }, [result, indicators]);

  // Equity curve data for buy-and-hold benchmark
  const equityData = result.buy_and_hold_equity_curve?.map((p) => ({ date: p.date.slice(0,10), buy_and_hold_equity: p.equity })) ?? [];

  function toggle(key: string) {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }

  return (
    <div className="trade-chart">
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <strong>Indicators:</strong>
        {indicatorKeys.map((k) => (
          <button
            key={k}
            onClick={() => toggle(k)}
            style={{
              background: visible[k] ? COLORS[k] ?? "#ddd" : "transparent",
              color: visible[k] ? "white" : "#333",
              border: "1px solid #ccc",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={30} />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="price" stroke={COLORS.price} dot={false} name="Price" />
          {indicatorKeys.includes("short_sma") && visible["short_sma"] && (
            <Line type="monotone" dataKey="short_sma" stroke={COLORS.short_sma} dot={false} name="Short SMA" />
          )}
          {indicatorKeys.includes("long_sma") && visible["long_sma"] && (
            <Line type="monotone" dataKey="long_sma" stroke={COLORS.long_sma} dot={false} name="Long SMA" />
          )}
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

      {/* RSI sub-chart */}
      {indicatorKeys.includes("rsi") && (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={30} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="rsi" stroke={COLORS.rsi} dot={false} name="RSI" />
            {/* reference lines for oversold/overbought - use provided params or defaults */}
            <ReferenceLine y={parameters?.oversold ?? 30} stroke="#10b981" strokeDasharray="3 3" />
            <ReferenceLine y={parameters?.overbought ?? 70} stroke="#ef4444" strokeDasharray="3 3" />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Equity curve with buy-and-hold overlay */}
      <h4>Equity Curve</h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={result.equity_curve.map((p) => ({ date: p.date.slice(0,10), equity: p.equity }))}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={30} />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="equity" stroke={COLORS.equity} dot={false} name="Strategy Equity" />
          {equityData.length > 0 && (
            <Line type="monotone" data={equityData} dataKey="buy_and_hold_equity" stroke={COLORS.buy_and_hold} dot={false} name="Buy & Hold" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
