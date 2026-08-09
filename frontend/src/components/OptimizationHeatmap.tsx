import { Fragment } from "react";
import type { CSSProperties } from "react";
import type { OptimizationPoint } from "../types";

interface OptimizationHeatmapProps {
  points: OptimizationPoint[];
  selectedParameters?: {
    short_window: number;
    long_window: number;
  } | null;
  onSelect: (parameters: { short_window: number; long_window: number }) => void;
}

function pointKey(parameters: { short_window: number; long_window: number }) {
  return `${parameters.short_window}:${parameters.long_window}`;
}

// Diverging loss/gain ramp, anchored on 0% return. All three stops stay dark
// enough that white cell text clears 4.5:1 contrast against them (verified).
const HEAT_RED: [number, number, number] = [200, 30, 58]; // #c81e3a — max loss
const HEAT_NEUTRAL: [number, number, number] = [51, 58, 71]; // #333a47 — 0%
const HEAT_GREEN: [number, number, number] = [12, 122, 78]; // #0c7a4e — max gain

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number) {
  return a.map((channel, i) => Math.round(channel + (b[i] - channel) * t)) as [number, number, number];
}

export default function OptimizationHeatmap({ points, selectedParameters, onSelect }: OptimizationHeatmapProps) {
  const shortWindows = [...new Set(points.map((point) => point.parameters.short_window))].sort((a, b) => a - b);
  const longWindows = [...new Set(points.map((point) => point.parameters.long_window))].sort((a, b) => a - b);
  const pointMap = new Map(points.map((point) => [pointKey(point.parameters), point]));
  const returnValues = points.map((point) => point.return_pct);
  const minReturn = returnValues.length > 0 ? Math.min(...returnValues) : 0;
  const maxReturn = returnValues.length > 0 ? Math.max(...returnValues) : 0;
  const maxAbsReturn = Math.max(Math.abs(minReturn), Math.abs(maxReturn));

  function cellColor(returnPct: number) {
    if (maxAbsReturn === 0) {
      return `rgb(${HEAT_NEUTRAL.join(",")})`;
    }

    const t = Math.max(-1, Math.min(1, returnPct / maxAbsReturn));
    const rgb = lerpRgb(HEAT_NEUTRAL, t >= 0 ? HEAT_GREEN : HEAT_RED, Math.abs(t));
    return `rgb(${rgb.join(",")})`;
  }

  return (
    <section className="optimization-panel">
      <div className="panel-header">
        <div>
          <h2>Parameter heatmap</h2>
          <p>
            Short window on the horizontal axis, long window on the vertical axis — hotter (green) cells returned
            more, cooler (red) cells lost money. Click a cell to load that pair into the simulation above.
          </p>
        </div>
        <span className="panel-chip">{points.length} runs</span>
      </div>

      <div
        className="heatmap-grid"
        role="grid"
        aria-label="Parameter optimization heatmap"
        style={{ "--heatmap-columns": shortWindows.length } as CSSProperties}
      >
        <div className="heatmap-corner">Long \ Short</div>
        {shortWindows.map((shortWindow) => (
          <div className="heatmap-axis top" key={`short-${shortWindow}`}>
            {shortWindow}
          </div>
        ))}

        {longWindows.map((longWindow) => (
          <Fragment key={`long-${longWindow}`}>
            <div className="heatmap-axis left">{longWindow}</div>
            {shortWindows.map((shortWindow) => {
              const point = pointMap.get(pointKey({ short_window: shortWindow, long_window: longWindow }));
              if (!point) {
                return <div className="heatmap-cell empty" key={`${shortWindow}-${longWindow}`} />;
              }

              const isSelected =
                selectedParameters?.short_window === shortWindow && selectedParameters?.long_window === longWindow;

              return (
                <button
                  key={`${shortWindow}-${longWindow}`}
                  type="button"
                  className={`heatmap-cell ${isSelected ? "selected" : ""}`.trim()}
                  style={{ background: cellColor(point.return_pct) }}
                  title={`Return ${point.return_pct.toFixed(2)}%, Sharpe ${point.sharpe.toFixed(2)}`}
                  onClick={() => onSelect(point.parameters)}
                >
                  <strong>{point.return_pct.toFixed(1)}%</strong>
                  <span>Sharpe {point.sharpe.toFixed(2)}</span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      {maxAbsReturn > 0 && (
        <div className="heatmap-legend" aria-hidden="true">
          <div className="heatmap-legend-bar" />
          <div className="heatmap-legend-labels">
            <span>Loss · -{maxAbsReturn.toFixed(1)}%</span>
            <span>0%</span>
            <span>Gain · +{maxAbsReturn.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </section>
  );
}
