import { useMemo, useState } from "react";
import type { PortfolioSymbolResult } from "../types";

interface PortfolioComparisonTableProps {
  symbols: PortfolioSymbolResult[];
}

type SortKey = "symbol" | "weight" | "total_return_pct" | "trades" | "sharpe";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "weight", label: "Weight" },
  { key: "total_return_pct", label: "Return" },
  { key: "trades", label: "Trades" },
  { key: "sharpe", label: "Sharpe" },
];

function sortValue(row: PortfolioSymbolResult, key: SortKey): number | string {
  if (key === "trades") return row.trades.length;
  if (key === "symbol") return row.symbol;
  return row[key];
}

export default function PortfolioComparisonTable({ symbols }: PortfolioComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("total_return_pct");
  const [sortDescending, setSortDescending] = useState(true);

  const sortedSymbols = useMemo(() => {
    const rows = [...symbols];
    rows.sort((a, b) => {
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);
      const comparison =
        typeof aValue === "string" && typeof bValue === "string"
          ? aValue.localeCompare(bValue)
          : (aValue as number) - (bValue as number);
      return sortDescending ? -comparison : comparison;
    });
    return rows;
  }, [symbols, sortKey, sortDescending]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDescending((current) => !current);
    } else {
      setSortKey(key);
      setSortDescending(true);
    }
  }

  return (
    <div className="portfolio-comparison">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key}>
                <button
                  type="button"
                  className="sortable-th"
                  onClick={() => handleSort(column.key)}
                >
                  {column.label}
                  {sortKey === column.key && <span className="sort-arrow">{sortDescending ? " ▼" : " ▲"}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedSymbols.map((row) => (
            <tr key={row.symbol}>
              <td>{row.symbol}</td>
              <td>{(row.weight * 100).toFixed(0)}%</td>
              <td className={row.total_return_pct >= 0 ? "positive" : "negative"}>
                {row.total_return_pct.toFixed(2)}%
              </td>
              <td>{row.trades.length}</td>
              <td className={row.sharpe >= 0 ? "positive" : "negative"}>{row.sharpe.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
