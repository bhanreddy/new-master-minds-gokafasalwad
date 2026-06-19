export const ACCOUNTS_STAT_KEYS = [
  'total_collection_month',
  'todays_collection',
  'pending_dues',
  'revenue_trend',
  'collection_efficiency',
  'avg_attendance',
  'academic_score',
  'system_insights'
] as const;

export type AccountsStatKey = typeof ACCOUNTS_STAT_KEYS[number];

/** Normalize partial/legacy config to explicit booleans for every stat key. */
export function normalizeAccountsDashboardConfig(
  raw: Record<string, boolean | undefined> = {}
): Record<string, boolean> {
  return ACCOUNTS_STAT_KEYS.reduce((acc, key) => {
    acc[key] = raw[key] !== false;
    return acc;
  }, {} as Record<string, boolean>);
}

/** Toggle one stat using opt-out visibility semantics (missing => visible). */
export function toggleAccountsDashboardStat(
  config: Record<string, boolean | undefined>,
  key: string
): Record<string, boolean> {
  const nextVisible = config[key] === false;
  return { ...normalizeAccountsDashboardConfig(config), [key]: nextVisible };
}
