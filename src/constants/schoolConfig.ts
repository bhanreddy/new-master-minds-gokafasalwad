/**
 * Global School Configuration
 * Edit this file to change the school branding across the entire app.
 *
 * This configuration is used in:
 * - App Headers (Admin, Staff, Student)
 * - Login/Logout Screens
 * - Report Cards & Certificates
 * - PDF Generation
 * - App-wide theming (colors, typography, spacing, shapes)
 */

import type { SchoolTheme } from '../theme/types';
import { defaultDarkTheme, defaultLightTheme } from '../theme/types';

/** Build `rgba(...)` from `#RRGGBB` / `#RGB` for ribbon overlays and dividers. */
export function schoolColorWithAlpha(hex: string, alpha: number): string {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return `rgba(208,176,48,${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * App-wide theme configuration.
 * This is the SINGLE SOURCE OF TRUTH for all visual styling.
 * 
 * To customize your school's appearance, modify the values below.
 * The app will automatically use these values throughout all screens and components.
 * 
 * Both light and dark themes are defined here. The app respects user preference.
 */
export const schoolTheme: { light: SchoolTheme; dark: SchoolTheme } = {
  light: {
    ...defaultLightTheme,
    colors: {
      ...defaultLightTheme.colors,
      // Primary – logo ring navy (cool blue, avoids olive when blended with gold)
      primary: '#0F4C81',
      primaryLight: '#38A3D9',
      primaryDark: '#062240',
      // Secondary – bright medal gold (cleaner than muddy #D0B030 on clay ribbon)
      secondary: '#E8B923',
      // Accent – logo wreath green
      accent: '#15803D',
      // Backgrounds – cool neutrals (less yellow cast on screens)
      background: '#F8FAFC',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      // Text – navy-slate
      textPrimary: '#0F2D52',
      textStrong: '#061829',
      textSecondary: '#475569',
      textMuted: '#64748B',
      text: '#0F2D52',
      textTertiary: '#64748B',
      // Borders – cool slate (no gold-brown bleed on cards)
      border: '#CBD5E1',
      borderLight: '#E2E8F0',
      // Semantic colors
      danger: '#DC2626',
      success: '#15803D',
      warning: '#D97706',
      info: '#0284C7',
      notification: '#DC2626',
      // Navigation
      navPill: '#EFF6FF',
      navIconActive: '#0F4C81',
      navIconInactive: '#64748B',
      // Header/Footer backgrounds (with transparency for glass effect)
      headerBg: 'rgba(248,250,252, 0.92)',
      footerBg: 'rgba(255,255,255, 0.92)',
      // Alert colors
      alertBg: '#FFFBEB',
      alertBorder: '#FDE68A',
      alertIcon: '#D97706',
      alertText: '#92400E',
      alertBgDanger: '#FEF2F2',
      alertBorderDanger: '#FECACA',
      alertIconDanger: '#C41E3A',
      alertTextDanger: '#991B1B',
      alertBgInfo: '#EDF6FC',
      alertBorderInfo: '#B3D9EF',
      alertIconInfo: '#3090D0',
      alertTextInfo: '#0A4F7A',
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
  },
  dark: {
    ...defaultDarkTheme,
    colors: {
      ...defaultDarkTheme.colors,
      // Primary – sky blue from logo inner circle
      primary: '#5BB8E8',
      primaryLight: '#7DD3FC',
      primaryDark: '#0284C7',
      // Secondary – motto gold
      secondary: '#FACC15',
      // Accent – wreath green
      accent: '#4ADE80',
      // Dark backgrounds – deep navy
      background: '#061829',
      surface: '#0F2D52',
      card: '#0F2D52',
      // Light text for dark backgrounds
      textPrimary: '#E2E8F0',
      textStrong: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      text: '#E2E8F0',
      textTertiary: '#64748B',
      // Darker borders
      border: '#1E3A5F',
      borderLight: '#2A4A72',
      // Lighter semantic colors for dark mode
      danger: '#F87171',
      success: '#4ADE80',
      warning: '#FBBF24',
      info: '#5BB8E8',
      notification: '#F87171',
      // Navigation
      navPill: 'rgba(91,184,232, 0.14)',
      navIconActive: '#5BB8E8',
      navIconInactive: '#64748B',
      // Header/Footer with dark navy glass effect
      headerBg: 'rgba(6,24,41, 0.92)',
      footerBg: 'rgba(15,45,82, 0.92)',
      // Alert colors (dark mode)
      alertBg: 'rgba(250,204,21, 0.12)',
      alertBorder: 'rgba(250,204,21, 0.28)',
      alertIcon: '#FACC15',
      alertText: '#FEF3C7',
      alertBgDanger: 'rgba(196,30,58, 0.12)',
      alertBorderDanger: 'rgba(196,30,58, 0.25)',
      alertIconDanger: '#F87171',
      alertTextDanger: '#FECACA',
      alertBgInfo: 'rgba(48,144,208, 0.12)',
      alertBorderInfo: 'rgba(48,144,208, 0.25)',
      alertIconInfo: '#50B0D0',
      alertTextInfo: '#B3D9EF',
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
  },
};

export const SCHOOL_CONFIG = {
  // The official name of the school displayed in headers and reports
  name: "The Global School Ravulpally",

  // Short line under the school name on the header ribbon (gold text)
  tagline: "A School for IIT , JEE , NEET & Olympiads Foundations",

  // Motto / core values shown in the first info column of the ribbon (letterhead)
  motto: "Knowledge is Power",

  // Letterhead crest for UI, PDFs, and certificates (launcher icon stays icon-v2 in app.json)
  logo: require('../../assets/images/icon.png'),

  // Optional: School Address for reports
  address: "The Global School , Ravulpally , Vikarabad , Telangana , 509336",

  // Optional: Contact info for reports
  contact: "7780526027",

  // Optional: School email for letterhead / reports
  email: "theglobalschool1@gmail.com",

  // Website or Email
  website: "www.nexsyrus.com",

  // CBSE Affiliation No (if applicable)
  cbseAffiliationNo: "NA",

  // School Code (if applicable)
  schoolCode: "TGSRAVULPALLY",

  /**
   * Colour theme for ribbon / letterhead chrome (SchoolRibbon, etc.).
   * Palette extracted from the school logo: navy ring, green wreath, gold field, tricolor ribbon.
   */
  theme: {
    /** Top stripe & crest – bright gold from motto lettering */
    accent: '#FFD54F',
    /** Mobile banner – navy crest → wreath green → medal gold (no muddy saffron tail) */
    ribbonGradient: ['#0F4C81', '#14532D', '#CA8A04', '#0F4C81'] as const,
    /** Optional stops for expo-linear-gradient (length must match ribbonGradient) */
    ribbonGradientLocations: [0, 0.38, 0.72, 1] as const,
    /** Main title on the ribbon */
    ribbonTitle: '#FFFFFF',
    /** Tagline + inset pill labels (was missing — defaulted to black on web) */
    ribbonTagline: '#F8FAFC',
    /** Scrolling marquee dot separator */
    marqueeSeparator: 'rgba(255,255,255,0.85)',
    /** Letterhead / info column body */
    ribbonBody: 'rgba(255,255,255,0.95)',
    ribbonBodyMuted: 'rgba(255,255,255,0.88)',
    /**
     * Icons over the ribbon / unsafe area (`expo-status-bar`).
     * Use `light` on dark gradients, `dark` if you switch to a light ribbon.
     */
    statusBarOnRibbon: 'light' as 'light' | 'dark',
  },
};
