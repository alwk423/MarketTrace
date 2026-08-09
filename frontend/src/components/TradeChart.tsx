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
  short_sma: "#ffa63d",
  long_sma: "#a78bfa",
  rsi: "#c084fc",
};

// Cycled through for indicator keys that aren't in the fixed map above -
// e.g. rsi_14 / sma_20 from a custom strategy's rules.
const FALLBACK_INDICATOR_COLORS = ["#c084fc", "#ffa63d", "#a78bfa", "#5eead4", "#f472b6"];

function colorForIndicator(key: string, indexAmongUnknown: number): string {
  return INDICATOR_COLORS[key] ?? FALLBACK_INDICATOR_COLORS[indexAmongUnknown % FALLBACK_INDICATOR_COLORS.length];
}

const CHART_GRID = "#232838";
const CHART_AXIS_TICK = { fill: "#9aa3b2", fontSize: 12 };
const CHART_TOOLTIP_STYLE = {
  background: "#161b26",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 8,
  color: "#e8eaed",
};
const CHART_LEGEND_STYLE = { color: "#9aa3b2" };

const INDICATOR_LABELS: Record<string, string> = {
  short_sma: "Short SMA",
  long_sma: "Long SMA",
};

// RSI-family series (the built-in "rsi" key, or "rsi_<period>" from a custom
// strategy's rules) live on a 0-100 scale and get their own sub-chart rather
// than sharing the price axis.
function isOscillatorKey(key: string): boolean {
  return key === "rsi" || key.startsWith("rsi_");
}

export default function TradeChart({ result, parameters }: TradeChartProps) {
  const indicators = result.indicators;
  const indicatorKeys = Object.keys(indicators);
  const priceIndicatorKeys = indicatorKeys.filter((key) => !isOscillatorKey(key));
  const oscillatorKeys = indicatorKeys.filter(isOscillatorKey);
  const hasOscillator = oscillatorKeys.length > 0;

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

  const oscillatorData = hasOscillator
    ? result.equity_curve.map((point) => {
        const date = point.date.slice(0, 10);
        const row: Record<string, number | string | null> = { date };
        for (const key of oscillatorKeys) {
          row[key] = indicatorByDate[key][date] ?? null;
        }
        return row;
      })
    : [];

  return (
    <div className="trade-chart">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="date" minTickGap={30} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
          <YAxis domain={["auto", "auto"]} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#9aa3b2" }} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          {result.regime_periods.map((period) => (
            <ReferenceArea
              key={`${period.regime}-${period.start_date}-${period.end_date}`}
              x1={period.start_date.slice(0, 10)}
              x2={period.end_date.slice(0, 10)}
              y1={minPrice - padding}
              y2={maxPrice + padding}
              ifOverflow="extendDomain"
              fill={period.regime === "bull" ? "rgba(31, 214, 143, 0.12)" : "rgba(255, 77, 106, 0.10)"}
              strokeOpacity={0}
            />
          ))}
          <Line type="monotone" dataKey="price" stroke="#3d8bff" dot={false} name="Price" />
          <Line
            type="monotone"
            dataKey="buy_and_hold"
            stroke="#9aa3b2"
            strokeDasharray="4 3"
            dot={false}
            name="Buy & hold"
          />
          {priceIndicatorKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colorForIndicator(key, index)}
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
              fill={trade.trade_type === "buy" ? "#1fd68f" : "#ff4d6a"}
              stroke="none"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {hasOscillator && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={oscillatorData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="date" minTickGap={30} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
            <YAxis domain={[0, 100]} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#9aa3b2" }} />
            {/* Fixed 30/70 guide lines only line up with the built-in RSI
                strategy's own thresholds - a custom strategy's rsi condition
                can use any value, so skip these outside that case. */}
            {indicatorKeys.includes("rsi") && (
              <>
                <ReferenceLine y={parameters?.oversold ?? 30} stroke="#1fd68f" strokeDasharray="3 3" />
                <ReferenceLine y={parameters?.overbought ?? 70} stroke="#ff4d6a" strokeDasharray="3 3" />
              </>
            )}
            {oscillatorKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colorForIndicator(key, index)}
                dot={false}
                name={key === "rsi" ? "RSI" : key}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
