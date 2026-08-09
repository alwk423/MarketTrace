export type StrategyType = "sma_crossover" | "rsi" | "custom";

export interface StrategyParameter {
  name: string;
  label: string;
  default: number;
}

export type RuleIndicator = "sma" | "rsi" | "price";
export type RuleOperator = "<" | "<=" | ">" | ">=" | "==" | "!=";

export interface RuleCondition {
  indicator: RuleIndicator;
  period: number | null;
  op: RuleOperator;
  value: number;
}

export interface RuleGroup {
  all: RuleCondition[];
}

export interface CustomStrategyRules {
  buy: RuleGroup;
  sell: RuleGroup;
}

export interface CustomStrategyCreateRequest {
  name: string;
  rules: CustomStrategyRules;
}

export interface StrategyCatalogEntry {
  type: StrategyType;
  id?: string;
  label: string;
  description: string;
  parameters: StrategyParameter[];
  is_custom?: boolean;
  rules?: CustomStrategyRules;
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

export interface RegimePeriod {
  regime: "bull" | "bear";
  start_date: string;
  end_date: string;
}

export interface RegimeSplit {
  bull_market_return_pct: number;
  bear_market_return_pct: number;
}

export interface IndicatorPoint {
  date: string;
  value: number | null;
}

export interface OptimizationPoint {
  parameters: {
    short_window: number;
    long_window: number;
  };
  return_pct: number;
  sharpe: number;
}

export interface OptimizationResult {
  results: OptimizationPoint[];
}

export interface OptimizationRequest {
  stock_symbol: string;
  strategy_type: StrategyType;
  strategy_parameters: Record<string, unknown>;
  start_date: string;
  end_date: string;
  initial_capital: number;
  fee_pct: number;
  slippage_pct: number;
  position_size_pct: number;
  short_windows: number[];
  long_windows: number[];
}

export interface SimulationResult {
  id: string;
  stock_symbol: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_capital: number;
  total_return_pct: number;
  sharpe: number;
  return_before_costs_pct: number;
  regime_split: RegimeSplit;
  regime_periods: RegimePeriod[];
  trades: Trade[];
  equity_curve: EquityPoint[];
  buy_and_hold_equity_curve: EquityPoint[];
  buy_and_hold_return_pct: number | null;
  indicators: Record<string, IndicatorPoint[]>;
}

export interface SimulationRequest {
  stock_symbol: string;
  strategy_type: StrategyType;
  strategy_parameters: Record<string, unknown>;
  start_date: string;
  end_date: string;
  initial_capital: number;
  fee_pct: number;
  slippage_pct: number;
  position_size_pct: number;
}

export interface PortfolioPoint {
  date: string;
  equity: number;
}

export interface PortfolioSymbolResult {
  symbol: string;
  weight: number;
  allocated_capital: number;
  final_capital: number;
  total_return_pct: number;
  return_before_costs_pct: number;
  sharpe: number;
  buy_and_hold_return_pct: number | null;
  trades: Trade[];
  equity_curve: EquityPoint[];
}

export interface PortfolioSimulationResult {
  symbols: PortfolioSymbolResult[];
  initial_capital: number;
  final_capital: number;
  total_return_pct: number;
  sharpe: number;
  combined_equity_curve: PortfolioPoint[];
  combined_buy_and_hold_equity_curve: PortfolioPoint[];
  combined_buy_and_hold_return_pct: number | null;
}

export interface PortfolioSimulationRequest {
  stock_symbols: string[];
  weights: Record<string, number>;
  strategy_type: StrategyType;
  strategy_parameters: Record<string, unknown>;
  start_date: string;
  end_date: string;
  initial_capital: number;
  fee_pct: number;
  slippage_pct: number;
  position_size_pct: number;
}
