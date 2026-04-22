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
import { defaultLightTheme, defaultDarkTheme } from '../theme/types';

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
      // Primary brand color - Indigo 600 (current app default)
      primary: '#4F46E5',
      primaryLight: '#818CF8',
      primaryDark: '#4338CA',
      // Secondary color - Emerald for success/positive actions
      secondary: '#10B981',
      // Accent color - Gold (matches ribbon accent)
      accent: '#D4AF37',
      // Backgrounds
      background: '#F8FAFC',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      // Text colors - Slate palette
      textPrimary: '#334155',
      textStrong: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      // Borders
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      // Semantic colors
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      info: '#3B82F6',
      notification: '#EF4444',
      // Navigation
      navPill: '#EEF2FF',
      navIconActive: '#4F46E5',
      navIconInactive: '#94A3B8',
      // Header/Footer backgrounds (with transparency for glass effect)
      headerBg: 'rgba(248,250,252, 0.85)',
      footerBg: 'rgba(255,255,255, 0.90)',
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
      // Primary colors shift to lighter variants for dark mode
      primary: '#818CF8',
      primaryLight: '#A5B4FC',
      primaryDark: '#6366F1',
      secondary: '#34D399',
      accent: '#D4AF37',
      // Dark backgrounds
      background: '#0B0F19',
      surface: '#151B2B',
      card: '#151B2B',
      // Light text for dark backgrounds
      textPrimary: '#E2E8F0',
      textStrong: '#F1F5F9',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      // Darker borders
      border: '#1E293B',
      borderLight: '#334155',
      // Lighter semantic colors for dark mode
      danger: '#F87171',
      success: '#34D399',
      warning: '#FBBF24',
      info: '#60A5FA',
      notification: '#F87171',
      // Navigation
      navPill: 'rgba(99,102,241, 0.15)',
      navIconActive: '#818CF8',
      navIconInactive: '#475569',
      // Header/Footer with dark glass effect
      headerBg: 'rgba(11,15,25, 0.85)',
      footerBg: 'rgba(21,27,43, 0.90)',
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
    name: "SCHOOL IMS",

    // Short line under the school name on the header ribbon (gold text)
    tagline: "Excellence in education since inception",

    // Motto / core values shown in the first info column of the ribbon (letterhead)
    motto: "Integrity · Respect · Excellence · Responsibility",

    // The school logo used in headers and reports
    // Ensure the image exists in assets/images/
    logo: require('../../assets/images/icon-v2.png'),

    // Optional: School Address for reports
    address: "123 School Street, City, State - 509407",

    // Optional: Contact info for reports
    contact: "9347556547",

    // Optional: School email for letterhead / reports
    email: "office@schoolims.com",

    // Website or Email
    website: "www.schoolims.com",

    // CBSE Affiliation No (if applicable)
    cbseAffiliationNo: "NA",

    // School Code (if applicable)
    schoolCode: "NA",

    /**
     * Colour theme for ribbon / letterhead chrome (SchoolRibbon, etc.).
     * Adjust `ribbonGradient` stops for your brand; `accent` drives gold trim and taglines.
     */
    theme: {
        /** Stripes, tagline text, soft dividers (derived via schoolColorWithAlpha) */
        accent: '#D4AF37',
        /** Four-stop diagonal ribbon background */
        ribbonGradient: ['#062A4A', '#0F4C81', '#1B6CB0', '#0D3A5C'] as const,
        /** Optional stops for expo-linear-gradient (length must match ribbonGradient) */
        ribbonGradientLocations: [0, 0.32, 0.68, 1] as const,
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
