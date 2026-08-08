export type StrategyType = "sma_crossover" | "rsi";

export interface StrategyParameter {
  name: string;
  label: string;
  default: number;
}

export interface StrategyCatalogEntry {
  type: StrategyType;
  label: string;
  description: string;
  parameters: StrategyParameter[];
}

export interface Trade {
  trade_type: "buy" | "sell";
  trade_date: string;
  price: number;
  quantity: number;
  reason: string | null;
}

export interface EquityPoint {
  date: string;
  price: number;
  equity: number;
}

export interface SimulationResult {
  id: string;
  stock_symbol: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_capital: number;
  total_return_pct: number;
  trades: Trade[];
  equity_curve: EquityPoint[];
  buy_and_hold_equity_curve?: EquityPoint[];
  buy_and_hold_return_pct?: number | null;
  indicators?: Record<string, { date: string; value: number | null }[]>;
}

export interface SimulationRequest {
  stock_symbol: string;
  strategy_type: StrategyType;
  strategy_parameters: Record<string, number>;
  start_date: string;
  end_date: string;
  initial_capital: number;
}
