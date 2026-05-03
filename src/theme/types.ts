/**
 * SchoolTheme — The central type definition for app-wide theming.
 * All visual tokens (colors, typography, spacing, shape) are defined here.
 * 
 * The theme values come from schoolConfig.ts, making it the single source
 * of truth for the entire app's visual appearance.
 */

export interface SchoolThemeColors {
  /** Main brand color */
  primary: string;
  /** Lighter variant for hover/pressed states */
  primaryLight: string;
  /** Darker variant for emphasis */
  primaryDark: string;
  /** Secondary brand color */
  secondary: string;
  /** Accent color for highlights */
  accent: string;
  /** Main app background */
  background: string;
  /** Card/elevated surface background */
  surface: string;
  /** Card background (alias for surface) */
  card: string;
  /** Main body text */
  textPrimary: string;
  /** Strong headings */
  textStrong: string;
  /** Secondary/supporting text */
  textSecondary: string;
  /** Muted/tertiary text */
  textMuted: string;
  /** Body text (alias for textPrimary — required by Theme compatibility) */
  text: string;
  /** Tertiary text (alias for textMuted — required by Theme compatibility) */
  textTertiary: string;
  /** Default border color */
  border: string;
  /** Light border variant */
  borderLight: string;
  /** Error/destructive actions */
  danger: string;
  /** Success states */
  success: string;
  /** Warning states */
  warning: string;
  /** Info states */
  info: string;
  /** Notification badge color */
  notification: string;
  /** Navigation pill background */
  navPill: string;
  /** Active navigation icon */
  navIconActive: string;
  /** Inactive navigation icon */
  navIconInactive: string;
  /** Header background (can be semi-transparent) */
  headerBg: string;
  /** Footer background */
  footerBg: string;
  /** Alert background (warning) */
  alertBg: string;
  /** Alert border (warning) */
  alertBorder: string;
  /** Alert icon (warning) */
  alertIcon: string;
  /** Alert text (warning) */
  alertText: string;
  /** Alert background (danger) */
  alertBgDanger: string;
  /** Alert border (danger) */
  alertBorderDanger: string;
  /** Alert icon (danger) */
  alertIconDanger: string;
  /** Alert text (danger) */
  alertTextDanger: string;
  /** Alert background (info) */
  alertBgInfo: string;
  /** Alert border (info) */
  alertBorderInfo: string;
  /** Alert icon (info) */
  alertIconInfo: string;
  /** Alert text (info) */
  alertTextInfo: string;
}

export interface SchoolThemeTypography {
  /** Default font family */
  fontFamily: string;
  /** Bold font family (or same as fontFamily if using fontWeight) */
  fontFamilyBold: string;
  /** Extra small: 11px - micro labels, badges */
  fontSizeXS: number;
  /** Small: 13px - captions, secondary info */
  fontSizeSM: number;
  /** Medium: 15px - body text */
  fontSizeMD: number;
  /** Large: 17px - card titles */
  fontSizeLG: number;
  /** Extra large: 20px - section headers */
  fontSizeXL: number;
  /** XXL: 24px - page headings */
  fontSizeXXL: number;
  /** XXXL: 28px - hero headings */
  fontSizeXXXL: number;
}

export interface SchoolThemeSpacing {
  /** 4px - micro spacing */
  xs: number;
  /** 8px - small gaps */
  sm: number;
  /** 12px - compact padding */
  md: number;
  /** 16px - standard padding */
  lg: number;
  /** 24px - section spacing */
  xl: number;
  /** 32px - large gaps */
  xxl: number;
}

export interface SchoolThemeShape {
  /** 6px - subtle rounding */
  borderRadiusXS: number;
  /** 8px - buttons, inputs */
  borderRadiusSM: number;
  /** 12px - cards */
  borderRadiusMD: number;
  /** 16px - large cards */
  borderRadiusLG: number;
  /** 20px - hero cards */
  borderRadiusXL: number;
  /** 9999px - pills, full circular */
  borderRadiusFull: number;
}

export interface SchoolThemeShadows {
  none: ShadowStyle;
  sm: ShadowStyle;
  md: ShadowStyle;
  lg: ShadowStyle;
}

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface SchoolTheme {
  /** Whether this is a dark theme */
  dark: boolean;
  colors: SchoolThemeColors;
  typography: SchoolThemeTypography;
  spacing: SchoolThemeSpacing;
  shape: SchoolThemeShape;
  shadows: SchoolThemeShadows;
}

/**
 * Light theme defaults matching the current app design.
 * These values are derived from the existing themes.ts file.
 */
export const defaultLightTheme: SchoolTheme = {
  dark: false,
  colors: {
    primary: '#4F46E5',
    primaryLight: '#818CF8',
    primaryDark: '#4338CA',
    secondary: '#10B981',
    accent: '#D4AF37',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    textPrimary: '#334155',
    textStrong: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    text: '#334155',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    notification: '#EF4444',
    navPill: '#EEF2FF',
    navIconActive: '#4F46E5',
    navIconInactive: '#94A3B8',
    headerBg: 'rgba(248,250,252, 0.85)',
    footerBg: 'rgba(255,255,255, 0.90)',
    alertBg: '#FEFCE8',
    alertBorder: '#FEF08A',
    alertIcon: '#EAB308',
    alertText: '#854D0E',
    alertBgDanger: '#FEF2F2',
    alertBorderDanger: '#FECACA',
    alertIconDanger: '#EF4444',
    alertTextDanger: '#991B1B',
    alertBgInfo: '#EFF6FF',
    alertBorderInfo: '#BFDBFE',
    alertIconInfo: '#3B82F6',
    alertTextInfo: '#1E40AF',
  },
  typography: {
    fontFamily: 'System',
    fontFamilyBold: 'System',
    fontSizeXS: 11,
    fontSizeSM: 13,
    fontSizeMD: 15,
    fontSizeLG: 17,
    fontSizeXL: 20,
    fontSizeXXL: 24,
    fontSizeXXXL: 28,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  shape: {
    borderRadiusXS: 6,
    borderRadiusSM: 8,
    borderRadiusMD: 12,
    borderRadiusLG: 16,
    borderRadiusXL: 20,
    borderRadiusFull: 9999,
  },
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 12,
    },
  },
};

/**
 * Dark theme defaults matching the current app design.
 */
export const defaultDarkTheme: SchoolTheme = {
  dark: true,
  colors: {
    primary: '#818CF8',
    primaryLight: '#A5B4FC',
    primaryDark: '#6366F1',
    secondary: '#34D399',
    accent: '#D4AF37',
    background: '#0B0F19',
    surface: '#151B2B',
    card: '#151B2B',
    textPrimary: '#E2E8F0',
    textStrong: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    text: '#E2E8F0',
    textTertiary: '#64748B',
    border: '#1E293B',
    borderLight: '#334155',
    danger: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    info: '#60A5FA',
    notification: '#F87171',
    navPill: 'rgba(99,102,241, 0.15)',
    navIconActive: '#818CF8',
    navIconInactive: '#475569',
    headerBg: 'rgba(11,15,25, 0.85)',
    footerBg: 'rgba(21,27,43, 0.90)',
    alertBg: 'rgba(234,179,8, 0.1)',
    alertBorder: 'rgba(234,179,8, 0.2)',
    alertIcon: '#FBBF24',
    alertText: '#FEF08A',
    alertBgDanger: 'rgba(239,68,68, 0.1)',
    alertBorderDanger: 'rgba(239,68,68, 0.2)',
    alertIconDanger: '#F87171',
    alertTextDanger: '#FECACA',
    alertBgInfo: 'rgba(59,130,246, 0.1)',
    alertBorderInfo: 'rgba(59,130,246, 0.2)',
    alertIconInfo: '#60A5FA',
    alertTextInfo: '#BFDBFE',
  },
  typography: {
    fontFamily: 'System',
    fontFamilyBold: 'System',
    fontSizeXS: 11,
    fontSizeSM: 13,
    fontSizeMD: 15,
    fontSizeLG: 17,
    fontSizeXL: 20,
    fontSizeXXL: 24,
    fontSizeXXXL: 28,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  shape: {
    borderRadiusXS: 6,
    borderRadiusSM: 8,
    borderRadiusMD: 12,
    borderRadiusLG: 16,
    borderRadiusXL: 20,
    borderRadiusFull: 9999,
  },
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 6,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
  },
};
