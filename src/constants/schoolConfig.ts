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
      // Primary brand color – Icon solid black (graduation cap & letterform)
      primary: '#1A1A1A',
      primaryLight: '#4A4A4A',
      primaryDark: '#0D0D0D',
      // Secondary color – Warm charcoal (icon outline strokes)
      secondary: '#2D2D2D',
      // Accent color – Warm gold (complement to monochrome icon)
      accent: '#C9A84C',
      // Backgrounds – clean near-white (icon whitespace)
      background: '#FAFAFA',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      // Text colors – icon-derived dark tones
      textPrimary: '#1A1A1A',
      textStrong: '#0D0D0D',
      textSecondary: '#4A4A4A',
      textMuted: '#6B6B6B',
      text: '#1A1A1A',
      textTertiary: '#9E9E9E',
      // Borders – neutral grays
      border: '#E0E0E0',
      borderLight: '#F0F0F0',
      // Semantic colors
      danger: '#C62828',
      success: '#2E7D32',
      warning: '#E65100',
      info: '#1A1A1A',
      notification: '#C9A84C',
      // Navigation – charcoal/slate tints
      navPill: '#F0F0F0',
      navIconActive: '#1A1A1A',
      navIconInactive: '#9E9E9E',
      // Header/Footer backgrounds (with transparency for glass effect)
      headerBg: 'rgba(250,250,250, 0.92)',
      footerBg: 'rgba(255,255,255, 0.95)',
      // Alert colors
      alertBg: '#F5F5F5',
      alertBorder: '#E0E0E0',
      alertIcon: '#1A1A1A',
      alertText: '#2D2D2D',
      alertBgDanger: '#FEF2F2',
      alertBorderDanger: '#FECACA',
      alertIconDanger: '#C62828',
      alertTextDanger: '#991B1B',
      alertBgInfo: '#F5F5F5',
      alertBorderInfo: '#E0E0E0',
      alertIconInfo: '#1A1A1A',
      alertTextInfo: '#2D2D2D',
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
      // Primary – light silver for dark mode legibility (inverted icon white)
      primary: '#E0E0E0',
      primaryLight: '#F0F0F0',
      primaryDark: '#BDBDBD',
      // Secondary – warm light gray
      secondary: '#9E9E9E',
      // Accent – golden amber for dark backgrounds
      accent: '#D4B85C',
      // Dark backgrounds – deep charcoal from icon's blacks
      background: '#121212',
      surface: '#1E1E1E',
      card: '#1E1E1E',
      // Light text for dark backgrounds
      textPrimary: '#E0E0E0',
      textStrong: '#FFFFFF',
      textSecondary: '#BDBDBD',
      textMuted: '#757575',
      text: '#E0E0E0',
      textTertiary: '#757575',
      // Darker borders – charcoal tones
      border: '#333333',
      borderLight: '#424242',
      // Lighter semantic colors for dark mode
      danger: '#EF5350',
      success: '#66BB6A',
      warning: '#FFA726',
      info: '#E0E0E0',
      notification: '#D4B85C',
      // Navigation – charcoal tints
      navPill: 'rgba(255,255,255, 0.08)',
      navIconActive: '#FFFFFF',
      navIconInactive: '#757575',
      // Header/Footer with dark glass effect
      headerBg: 'rgba(18,18,18, 0.92)',
      footerBg: 'rgba(30,30,30, 0.95)',
      // Alert colors (dark mode)
      alertBg: 'rgba(255,255,255, 0.06)',
      alertBorder: 'rgba(255,255,255, 0.12)',
      alertIcon: '#E0E0E0',
      alertText: '#BDBDBD',
      alertBgDanger: 'rgba(239,83,80, 0.1)',
      alertBorderDanger: 'rgba(239,83,80, 0.2)',
      alertIconDanger: '#EF5350',
      alertTextDanger: '#FFCDD2',
      alertBgInfo: 'rgba(255,255,255, 0.08)',
      alertBorderInfo: 'rgba(255,255,255, 0.15)',
      alertIconInfo: '#E0E0E0',
      alertTextInfo: '#BDBDBD',
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
  name: "Nexsyrus School IMS",

  // Short line under the school name on the header ribbon (gold text)
  tagline: "Step in with Confidence and Step out with Success",

  // Motto / core values shown in the first info column of the ribbon (letterhead)
  motto: "Be Confident, Do Confidently",

  // The school logo used in headers and reports
  // Ensure the image exists in assets/images/
  logo: require('../../assets/images/icon.png'),

  // Optional: School Address for reports
  address: "Maddur , Telangana 509336",

  // Optional: Contact info for reports
  contact: "9347556547",

  // Optional: School email for letterhead / reports
  email: "nexsyrus@nexsyrus.com",

  // Website or Email
  website: "www.nexsyrus.com",

  // CBSE Affiliation No (if applicable)
  cbseAffiliationNo: "NA",

  // School Code (if applicable)
  schoolCode: "NSIMS",

  /**
   * Colour theme for ribbon / letterhead chrome (SchoolRibbon, etc.).
   * Extracted from the icon: monochrome black letterform with graduation cap.
   */
  theme: {
    /** Warm gold accent – stripes, dividers, and trim */
    accent: '#C9A84C',
    /** Tagline text – soft warm gold over dark ribbon */
    ribbonTagline: '#D4C49A',
    /** Four-stop diagonal ribbon – deep black to charcoal (icon letterform) */
    ribbonGradient: ['#0D0D0D', '#1A1A1A', '#2D2D2D', '#4A4A4A'] as const,
    /** Optional stops for expo-linear-gradient (length must match ribbonGradient) */
    ribbonGradientLocations: [0, 0.30, 0.65, 1] as const,
    /** Main title on the ribbon – crisp white (icon negative space) */
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