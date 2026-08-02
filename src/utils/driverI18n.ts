import type { TFunction } from 'i18next';
import { isTelugu } from './lang';

export const driverDateLocale = (language?: string | null): string =>
  isTelugu(language ?? undefined) ? 'te-IN' : 'en-IN';

const DIRECTION_KEYS: Record<string, string> = {
  morning: 'direction_morning',
  afternoon: 'direction_afternoon',
  evening: 'direction_evening',
  both: 'direction_both',
  pickup: 'direction_pickup',
  dropoff: 'direction_dropoff',
  'drop-off': 'direction_dropoff',
};

export function translateDriverDirection(
  direction: string | null | undefined,
  t: TFunction,
): string {
  if (!direction) return t('driver_ui.not_available');
  const normalized = direction.trim().toLowerCase();
  const key = DIRECTION_KEYS[normalized];
  return key ? t(`driver_ui.${key}`) : direction;
}

const MONTH_KEYS: Record<string, string> = {
  january: 'month_january',
  february: 'month_february',
  march: 'month_march',
  april: 'month_april',
  may: 'month_may',
  june: 'month_june',
  july: 'month_july',
  august: 'month_august',
  september: 'month_september',
  october: 'month_october',
  november: 'month_november',
  december: 'month_december',
};

export function translatePayslipMonth(label: string, t: TFunction): string {
  const match = label.trim().match(/^([A-Za-z]+)(.*)$/);
  if (!match) return label;
  const key = MONTH_KEYS[match[1].toLowerCase()];
  return key ? `${t(`driver_ui.${key}`)}${match[2]}` : label;
}

export function translatePayslipStatus(status: string, t: TFunction): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'paid') return t('driver_ui.status_paid');
  if (normalized === 'pending') return t('driver_ui.status_pending');
  if (normalized === 'processed') return t('driver_ui.status_processed');
  return status || t('driver_ui.status_pending');
}

const RELATIONSHIP_KEYS: Record<string, string> = {
  father: 'relationship_father',
  mother: 'relationship_mother',
  parent: 'relationship_parent',
  guardian: 'relationship_guardian',
  brother: 'relationship_brother',
  sister: 'relationship_sister',
};

export function translateRelationship(relationship: string, t: TFunction): string {
  const key = RELATIONSHIP_KEYS[relationship.trim().toLowerCase()];
  return key ? t(`driver_ui.${key}`) : relationship;
}
