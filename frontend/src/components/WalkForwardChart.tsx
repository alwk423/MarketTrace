import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WalkForwardResult } from "../types";

interface WalkForwardChartProps {
  result: WalkForwardResult;
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

// Same continuous equity curve TradeChart plots, but shaded by the
// train/test split instead of by bull/bear regime - the point here is
// "did performance hold up past the divider", not market conditions.
export default function WalkForwardChart({ result }: WalkForwardChartProps) {
  const buyAndHoldByDate = new Map(
    result.buy_and_hold_equity_curve.map((point) => [point.date.slice(0, 10), point.equity]),
  );

  const data = result.equity_curve.map((point) => {
    const date = point.date.slice(0, 10);
    return {
      date,
      equity: point.equity,
      buy_and_hold: buyAndHoldByDate.get(date) ?? null,
    };
  });

  const equities = data.map((point) => point.equity);
  const minEquity = equities.length > 0 ? Math.min(...equities) : 0;
  const maxEquity = equities.length > 0 ? Math.max(...equities) : 0;
  const padding = Math.max((maxEquity - minEquity) * 0.08, 1);

  const firstDate = data[0]?.date;
  const lastDate = data[data.length - 1]?.date;
  const splitDate = result.split_date;

  return (
    <div className="trade-chart">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="date" minTickGap={30} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
          <YAxis domain={["auto", "auto"]} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#9aa3b2" }} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          {firstDate && (
            <ReferenceArea
              x1={firstDate}
              x2={splitDate}
              y1={minEquity - padding}
              y2={maxEquity + padding}
              ifOverflow="extendDomain"
              fill="rgba(61, 139, 255, 0.10)"
              strokeOpacity={0}
              label={{ value: "Train", position: "insideTopLeft", fill: "#9aa3b2", fontSize: 11 }}
            />
          )}
          {lastDate && (
            <ReferenceArea
              x1={splitDate}
              x2={lastDate}
              y1={minEquity - padding}
              y2={maxEquity + padding}
              ifOverflow="extendDomain"
              fill="rgba(255, 166, 61, 0.10)"
              strokeOpacity={0}
              label={{ value: "Test", position: "insideTopRight", fill: "#9aa3b2", fontSize: 11 }}
            />
          )}
          <ReferenceLine
            x={splitDate}
            stroke="#9aa3b2"
            strokeDasharray="4 3"
            label={{ value: "Split", position: "top", fill: "#9aa3b2", fontSize: 11 }}
          />
          <Line type="monotone" dataKey="equity" stroke="#3d8bff" dot={false} name="Strategy equity" />
          <Line
            type="monotone"
            dataKey="buy_and_hold"
            stroke="#9aa3b2"
            strokeDasharray="4 3"
            dot={false}
            name="Buy & hold"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
