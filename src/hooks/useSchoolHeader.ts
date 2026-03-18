import { SCHOOL_NAME } from '../constants/school';
import { useTranslation } from 'react-i18next';

/**
 * Hook to retrieve screen options with the school name in the header.
 * Allows passing an optional subtitle or overriding the title while keeping the school context.
 */
export function useSchoolHeader() {
  const { t } = useTranslation();

  return (subtitle?: string) => ({
    headerShown: true,
    headerTitle: subtitle ? `${SCHOOL_NAME} - ${subtitle}` : SCHOOL_NAME,
    headerBackTitle: t('common.back', 'Back'),
    headerShadowVisible: false,
    headerStyle: { backgroundColor: '#FFFFFF' },
    headerTitleStyle: { fontWeight: '700' as const, fontSize: 18, color: '#1E293B' },
  });
}
