import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioSimulationResult } from "../types";

interface PortfolioEquityChartProps {
  result: PortfolioSimulationResult;
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

export default function PortfolioEquityChart({ result }: PortfolioEquityChartProps) {
  const buyAndHoldByDate = new Map(
    result.combined_buy_and_hold_equity_curve.map((point) => [point.date.slice(0, 10), point.equity]),
  );

  const data = result.combined_equity_curve.map((point) => {
    const date = point.date.slice(0, 10);
    return {
      date,
      equity: point.equity,
      buy_and_hold: buyAndHoldByDate.get(date) ?? null,
    };
  });

  return (
    <div className="trade-chart">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          <XAxis dataKey="date" minTickGap={30} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
          <YAxis domain={["auto", "auto"]} tick={CHART_AXIS_TICK} stroke={CHART_GRID} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#9aa3b2" }} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Line type="monotone" dataKey="equity" stroke="#3d8bff" dot={false} name="Portfolio equity" />
          <Line
            type="monotone"
            dataKey="buy_and_hold"
            stroke="#9aa3b2"
            strokeDasharray="4 3"
            dot={false}
            name="Buy & hold (basket)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
