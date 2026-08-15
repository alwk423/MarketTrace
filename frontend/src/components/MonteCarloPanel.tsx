import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonteCarloResult } from "../types";

interface MonteCarloPanelProps {
  result: MonteCarloResult;
}

const CHART_GRID = "#232838";
const CHART_AXIS_TICK = { fill: "#9aa3b2", fontSize: 11 };
const CHART_TOOLTIP_STYLE = {
  background: "#161b26",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 8,
  color: "#e8eaed",
};

const BIN_COUNT = 24;

interface HistogramBin {
  label: string;
  count: number;
}

// Buckets the simulated final returns into evenly-sized bins for a bar-chart
// histogram, and reports which bin the actual observed return falls into so
// a ReferenceLine can point at it (recharts needs a category-axis label to
// place a line on a category axis, not the raw numeric value).
function buildHistogram(values: number[], observed: number): { bins: HistogramBin[]; observedLabel: string } {
  if (values.length === 0) {
    return { bins: [], observedLabel: "" };
  }

  const allValues = [...values, observed];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const binWidth = range / BIN_COUNT;

  const bins = Array.from({ length: BIN_COUNT }, (_, index) => ({
    label: `${(min + index * binWidth).toFixed(1)}%`,
    count: 0,
  }));

  function binIndexFor(value: number) {
    const index = Math.floor((value - min) / binWidth);
    return Math.min(Math.max(index, 0), BIN_COUNT - 1);
  }

  for (const value of values) {
    bins[binIndexFor(value)].count += 1;
  }

  return { bins, observedLabel: bins[binIndexFor(observed)].label };
}

export default function MonteCarloPanel({ result }: MonteCarloPanelProps) {
  const { bins, observedLabel } = useMemo(
    () => buildHistogram(result.simulated_returns_pct, result.observed_return_pct),
    [result],
  );

  const aboveMedian = result.observed_percentile >= 50;
  const rankPct = aboveMedian ? 100 - result.observed_percentile : result.observed_percentile;

  return (
    <div className="results-panel">
      <div className="panel-header">
        <div>
          <h2>Monte Carlo simulation</h2>
          <p>{result.simulated_returns_pct.length} bootstrapped resamples of this strategy's daily returns.</p>
        </div>
        <span className="panel-chip">Observed: {result.observed_return_pct.toFixed(2)}%</span>
      </div>

      {bins.length > 0 && (
        <div className="trade-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bins}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis
                dataKey="label"
                tick={CHART_AXIS_TICK}
                stroke={CHART_GRID}
                interval={Math.ceil(bins.length / 8)}
              />
              <YAxis tick={CHART_AXIS_TICK} stroke={CHART_GRID} allowDecimals={false} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: "#9aa3b2" }}
                formatter={(value) => [`${value} runs`, "Simulations"]}
              />
              <ReferenceLine
                x={observedLabel}
                stroke="#ff4d6a"
                strokeWidth={2}
                label={{ value: "Your result", position: "top", fill: "#ff4d6a", fontSize: 11 }}
              />
              <Bar dataKey="count" fill="#3d8bff" radius={[4, 4, 0, 0]} name="Simulated outcomes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="monte-carlo-callout">
        Your real result ({result.observed_return_pct.toFixed(2)}%) landed in the{" "}
        <strong className={aboveMedian ? "positive" : "negative"}>
          {aboveMedian ? "top" : "bottom"} {Math.max(rankPct, 1).toFixed(0)}%
        </strong>{" "}
        of what could have happened.
      </p>

      <div className="metrics">
        <div>
          <span>Mean outcome</span>
          <strong>{result.mean_return_pct.toFixed(2)}%</strong>
        </div>
        <div>
          <span>Median outcome</span>
          <strong>{result.median_return_pct.toFixed(2)}%</strong>
        </div>
        <div>
          <span>Std. deviation</span>
          <strong>{result.std_dev_pct.toFixed(2)}%</strong>
        </div>
        <div>
          <span>5th – 95th percentile</span>
          <strong>
            {result.percentiles.p5.toFixed(1)}% – {result.percentiles.p95.toFixed(1)}%
          </strong>
        </div>
      </div>
    </div>
  );
}
