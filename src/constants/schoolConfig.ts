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

/**
 * Build `rgba(...)` from `#RRGGBB` / `#RGB` for ribbon overlays and dividers.
 *
 * Marked as a Reanimated worklet so it can be called from inside `useAnimatedStyle`
 * on the UI thread (the scroll-driven dashboard headers do this). Reanimated 4 throws
 * a hard "tried to synchronously call a non-worklet function on the UI thread" error
 * otherwise, which blanks every dashboard after login. It remains a normal function
 * when called from the JS thread (PDFs, welcome screen, ribbon, etc.).
 */
export function schoolColorWithAlpha(hex: string, alpha: number): string {
  'worklet';
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
      // Extracted from assets/images/icon.png
      // Primary – dark blue outer ring
      primary: '#283090',
      primaryLight: '#0A6FBF',   // Cerulean (center figure & book)
      primaryDark: '#1E2468',    // Deep ring shadow
      // Secondary – vibrant orange (side figures)
      secondary: '#F05820',
      // Accent – bright yellow (ring text "BHASHYAM VIDYANIKETHAN")
      accent: '#F8F000',
      // Backgrounds – cool blue-tinted neutrals
      background: '#F8FAFC',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      // Text – logo dark blue
      textPrimary: '#283090',
      textStrong: '#1E2468',
      textSecondary: '#475569',
      textMuted: '#64748B',
      text: '#283090',
      textTertiary: '#64748B',
      // Borders – blue-tinted
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      // Semantic colors
      danger: '#D32F2F',
      success: '#10B981',
      warning: '#F59E0B',
      info: '#0A6FBF',           // Cerulean (logo book)
      notification: '#F05820',
      // Navigation – logo-blue pill tints
      navPill: '#E0E4FF',
      navIconActive: '#283090',
      navIconInactive: '#64748B',
      // Header/Footer backgrounds (with transparency for glass effect)
      headerBg: 'rgba(248,250,252, 0.88)',
      footerBg: 'rgba(255,255,255, 0.92)',
      // Alert colors
      alertBg: '#EEF0FA',        // Light logo-blue wash
      alertBorder: '#C5C9F0',
      alertIcon: '#283090',
      alertText: '#1E2468',
      alertBgDanger: '#FEF2F2',
      alertBorderDanger: '#FECACA',
      alertIconDanger: '#D32F2F',
      alertTextDanger: '#991B1B',
      alertBgInfo: '#E6F4FE',    // Cerulean wash
      alertBorderInfo: '#B3DDFB',
      alertIconInfo: '#0A6FBF',
      alertTextInfo: '#1E2468',
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
      // Primary – lightened logo blue for dark-mode legibility
      primary: '#8B93E8',
      primaryLight: '#7EC4F0',   // Light cerulean
      primaryDark: '#283090',   // Logo ring (full strength)
      // Secondary – light orange for dark mode
      secondary: '#FF8A55',
      // Accent – logo yellow
      accent: '#F8F000',
      // Dark backgrounds – deep slate/blue tones
      background: '#0E1228',
      surface: '#1A1E3A',
      card: '#1A1E3A',
      // Light text for dark backgrounds
      textPrimary: '#F1F5F9',
      textStrong: '#FFFFFF',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      text: '#F1F5F9',
      textTertiary: '#64748B',
      // Darker borders – blue-tinted slate
      border: '#2A2E52',
      borderLight: '#3A3E68',
      // Lighter semantic colors for dark mode
      danger: '#F87171',
      success: '#34D399',
      warning: '#FBBF24',
      info: '#5CC4F0',
      notification: '#FF8A55',
      // Navigation
      navPill: 'rgba(40, 48, 144, 0.25)',
      navIconActive: '#A8B0F0',
      navIconInactive: '#94A3B8',
      // Header/Footer glass
      headerBg: 'rgba(14, 18, 40, 0.88)',
      footerBg: 'rgba(26, 30, 58, 0.92)',
      // Alert colors (dark mode)
      alertBg: 'rgba(40, 48, 144, 0.15)',
      alertBorder: 'rgba(40, 48, 144, 0.3)',
      alertIcon: '#A8B0F0',
      alertText: '#A8B0F0',
      alertBgDanger: 'rgba(248,113,113, 0.1)',
      alertBorderDanger: 'rgba(248,113,113, 0.2)',
      alertIconDanger: '#F87171',
      alertTextDanger: '#FECACA',
      alertBgInfo: 'rgba(10, 111, 191, 0.15)',
      alertBorderInfo: 'rgba(10, 111, 191, 0.3)',
      alertIconInfo: '#5CC4F0',
      alertTextInfo: '#B3DDFB',
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
  name: "Bhashyam Vidyanikethan Mohammadabad",

  // Short line under the school name on the header ribbon (gold text)
  tagline: "Education with Moral Values",

  // Motto / core values shown in the first info column of the ribbon (letterhead)
  motto: "Care and Achieve through Quality Education and Discipline",

  // The school logo used in headers and reports
  // Ensure the image exists in assets/images/
  logo: require('../../assets/images/icon.png'),

  // Optional: School Address for reports
  address: "Bhashyam Vidyanikethan School,VenkatReddypally Road, Mohammadabad,Mahabubnagar District, Telangana-509337",

  // Optional: Contact info for reports
  contact: "9966868389",

  // Optional: School email for letterhead / reports
  email: "bhashyamvidyanikethan@gmail.com",

  // Website or Email
  website: "www.nexsyrus.com",

  // CBSE Affiliation No (if applicable)
  cbseAffiliationNo: "NA",

  // School Code (if applicable)
  schoolCode: "BVS",

  /**
   * Colour theme for ribbon / letterhead chrome (SchoolRibbon, etc.).
   * Extracted from logo: dark blue ring → cerulean book, yellow ring text.
   */
  theme: {
    /** Bright yellow dividers & trim (logo ring text) */
    accent: '#F8F000',
    /** Tagline + info-column labels – logo yellow */
    ribbonTagline: '#F8F000',
    /** Four-stop vertical ribbon – deep ring blue → cerulean */
    ribbonGradient: ['#1E2468', '#283090', '#1A5AA0', '#0A6FBF'] as const,
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