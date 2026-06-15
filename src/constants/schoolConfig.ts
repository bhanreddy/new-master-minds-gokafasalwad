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
    return `rgba(212,175,55,${alpha})`;
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
      // Primary brand color – Royal purple
      primary: '#5D3FD3',
      primaryLight: '#7B5FE7',
      primaryDark: '#4A2FB8',
      // Secondary color – Orchid purple
      secondary: '#BF40BF',
      // Accent color – Bright magenta-purple
      accent: '#BF40BF',
      // Backgrounds – cool lavender neutrals
      background: '#F8F5FD',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      // Text colors – deep purple-slate palette
      textPrimary: '#2D1B4E',
      textStrong: '#1A0E33',
      textSecondary: '#5C4780',
      textMuted: '#8E7BAF',
      text: '#2D1B4E',
      textTertiary: '#8E7BAF',
      // Borders – purple-tinted
      border: '#E0D6F0',
      borderLight: '#EDE7F6',
      // Semantic colors
      danger: '#D32F2F',
      success: '#10B981',
      warning: '#F59E0B',
      info: '#5D3FD3',
      notification: '#BF40BF',
      // Navigation – purple pill tints
      navPill: '#EDE7F6',
      navIconActive: '#5D3FD3',
      navIconInactive: '#8E7BAF',
      // Header/Footer backgrounds (with transparency for glass effect)
      headerBg: 'rgba(248,245,253, 0.88)',
      footerBg: 'rgba(255,255,255, 0.92)',
      // Alert colors
      alertBg: '#F3EDFF',
      alertBorder: '#D4C4F7',
      alertIcon: '#5D3FD3',
      alertText: '#4A2FB8',
      alertBgDanger: '#FEF2F2',
      alertBorderDanger: '#FECACA',
      alertIconDanger: '#D32F2F',
      alertTextDanger: '#991B1B',
      alertBgInfo: '#F3EDFF',
      alertBorderInfo: '#D4C4F7',
      alertIconInfo: '#5D3FD3',
      alertTextInfo: '#4A2FB8',
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
      // Primary – lighter purple for dark mode legibility
      primary: '#9B7EF7',
      primaryLight: '#B39DFF',
      primaryDark: '#7B5FE7',
      // Secondary – lighter orchid purple
      secondary: '#D86FD8',
      // Accent – brighter magenta-purple for dark backgrounds
      accent: '#D86FD8',
      // Dark backgrounds – deep purple-ink tones
      background: '#120E1F',
      surface: '#1E1833',
      card: '#1E1833',
      // Light text for dark backgrounds
      textPrimary: '#EDE7F6',
      textStrong: '#F8F5FD',
      textSecondary: '#C4B5E0',
      textMuted: '#7E6BA8',
      text: '#EDE7F6',
      textTertiary: '#7E6BA8',
      // Darker borders – purple-ink
      border: '#2D2345',
      borderLight: '#3A2D55',
      // Lighter semantic colors for dark mode
      danger: '#F87171',
      success: '#34D399',
      warning: '#FBBF24',
      info: '#9B7EF7',
      notification: '#D86FD8',
      // Navigation – purple tint
      navPill: 'rgba(93,63,211, 0.15)',
      navIconActive: '#9B7EF7',
      navIconInactive: '#5C4780',
      // Header/Footer with dark purple glass effect
      headerBg: 'rgba(18,14,31, 0.88)',
      footerBg: 'rgba(30,24,51, 0.92)',
      // Alert colors (dark mode)
      alertBg: 'rgba(93,63,211, 0.1)',
      alertBorder: 'rgba(93,63,211, 0.2)',
      alertIcon: '#B39DFF',
      alertText: '#D4C4F7',
      alertBgDanger: 'rgba(248,113,113, 0.1)',
      alertBorderDanger: 'rgba(248,113,113, 0.2)',
      alertIconDanger: '#F87171',
      alertTextDanger: '#FECACA',
      alertBgInfo: 'rgba(93,63,211, 0.12)',
      alertBorderInfo: 'rgba(93,63,211, 0.25)',
      alertIconInfo: '#9B7EF7',
      alertTextInfo: '#D4C4F7',
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
  name: "Vikas Model School Balampet",

  // Short line under the school name on the header ribbon (gold text)
  tagline: "Arise Awake Stop Not till you reach the Goal",

  // Motto / core values shown in the first info column of the ribbon (letterhead)
  motto: "Wisdom, Knowledge and Victory",

  // The school logo used in headers and reports
  // Ensure the image exists in assets/images/
  logo: require('../../assets/images/icon-v2.png'),

  // Optional: School Address for reports
  address: "Vikas Model School ,Balampet, Mandal Doulathabad, Dist Vikarabad, Telangana-509336",

  // Optional: Contact info for reports
  contact: "9848981191",

  // Optional: School email for letterhead / reports
  email: "vmsbalampet@gmail.com",

  // Website or Email
  website: "www.nexsyrus.com",

  // CBSE Affiliation No (if applicable)
  cbseAffiliationNo: "NA",

  // School Code (if applicable)
  schoolCode: "VMS",

  /**
   * Colour theme for ribbon / letterhead chrome (SchoolRibbon, etc.).
   * Extracted from the VMS crest: gold shield, brown interior, red VMS lettering.
   */
  theme: {
    /** Purple stripes, dividers, and trim (ribbon accents) */
    accent: '#BF40BF',
    /** Tagline text – orchid purple */
    ribbonTagline: '#E8B4F8',
    /** Four-stop diagonal ribbon – deep royal purple to orchid (purple gradient) */
    ribbonGradient: ['#3A1F8C', '#5D3FD3', '#9B4DCA', '#BF40BF'] as const,
    /** Optional stops for expo-linear-gradient (length must match ribbonGradient) */
    ribbonGradientLocations: [0, 0.30, 0.65, 1] as const,
    /** Main title on the ribbon */
    ribbonTitle: '#FFFFFF',
    /** Scrolling marquee dot separator */
    marqueeSeparator: 'rgba(255,255,255,0.85)',
    /** Letterhead / info column body */
    ribbonBody: 'rgba(255,255,255,0.92)',
    ribbonBodyMuted: 'rgba(255,255,255,0.9)',
    /**
     * Icons over the ribbon / unsafe area (`expo-status-bar`).
     * Use `light` on dark gradients, `dark` if you switch to a light ribbon.
     */
    statusBarOnRibbon: 'light' as 'light' | 'dark',
  },
};
