/**
 * Which of the 11 market sectors (the names markets/movers.sectors uses) each Zelos stock belongs
 * to, for the sector heat map (owner 2026-11-15). Fixed list: a company's sector rarely changes;
 * add a line when a stock joins the list. ETFs aren't in a sector.
 */
export const SECTOR_OF: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', AMD: 'Technology', MU: 'Technology', INTC: 'Technology', ARM: 'Technology', ORCL: 'Technology', PLTR: 'Technology', UBER: 'Technology',
  GOOGL: 'Communication Services', META: 'Communication Services',
  AMZN: 'Consumer Cyclical', TSLA: 'Consumer Cyclical', ABNB: 'Consumer Cyclical',
  JPM: 'Financial Services', GS: 'Financial Services', SOFI: 'Financial Services', HOOD: 'Financial Services',
  UNH: 'Healthcare', MRNA: 'Healthcare',
  XOM: 'Energy',
  CAT: 'Industrials',
};

export const stocksIn = (sector: string, syms: string[]): string[] => syms.filter((s) => SECTOR_OF[s] === sector);

/** Tile colour strength 0..1 for a % move: a 3% day is full colour. */
export const heat = (pct: number): number => Math.min(1, Math.abs(pct) / 3);
