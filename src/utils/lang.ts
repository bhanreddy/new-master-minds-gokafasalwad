import i18n from '../i18n';

/**
 * Robust Telugu language check.
 * Handles locale variants like 'te', 'te-IN', 'te-Telu', etc.
 */
export function isTelugu(lang?: string): boolean {
    return lang?.split('-')[0] === 'te';
}

/**
 * Language-aware field selector.
 * Returns Telugu value when language is 'te' and translation exists,
 * otherwise returns English value.
 *
 * Usage: t_field(item.title, item.title_te)
 */
export function t_field(enValue: string | null | undefined, teValue?: string | null): string {
    if (isTelugu(i18n.language) && teValue?.trim()) return teValue;
    return enValue ?? '';
}
