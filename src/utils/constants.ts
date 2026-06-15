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
