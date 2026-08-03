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
      // Primary – dark navy from logo ring text ("THE GLOBAL SCHOOL")
      primary: '#103070',
      primaryLight: '#3090D0',
      primaryDark: '#0A2548',
      // Secondary – golden yellow from logo background
      secondary: '#D0B030',
      // Accent – forest green from laurel wreath & framing bars
      accent: '#227030',
      // Backgrounds – warm gold-tinted neutrals
      background: '#FFFBF0',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      // Text – navy-slate palette matching logo lettering
      textPrimary: '#103050',
      textStrong: '#0A2548',
      textSecondary: '#4A6080',
      textMuted: '#7A8FA8',
      text: '#103050',
      textTertiary: '#7A8FA8',
      // Borders – gold-tinted
      border: '#E8DFC8',
      borderLight: '#F5F0E4',
      // Semantic colors
      danger: '#C41E3A',
      success: '#227030',
      warning: '#E87820',
      info: '#3090D0',
      notification: '#C41E3A',
      // Navigation – gold-tinted pills, navy active icons
      navPill: '#F5F0E0',
      navIconActive: '#103070',
      navIconInactive: '#7A8FA8',
      // Header/Footer backgrounds (with transparency for glass effect)
      headerBg: 'rgba(255,251,240, 0.88)',
      footerBg: 'rgba(255,255,255, 0.92)',
      // Alert colors
      alertBg: '#FEF9E8',
      alertBorder: '#F5E6A8',
      alertIcon: '#D0B030',
      alertText: '#7A5A10',
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
      // Primary – sky blue from inner circle, legible on dark backgrounds
      primary: '#50B0D0',
      primaryLight: '#7BC8E8',
      primaryDark: '#3090D0',
      // Secondary – bright gold from motto text
      secondary: '#E5C85A',
      // Accent – lighter wreath green
      accent: '#4CAF6A',
      // Dark backgrounds – deep navy tones
      background: '#0A1520',
      surface: '#102840',
      card: '#102840',
      // Light text for dark backgrounds
      textPrimary: '#E8EDF5',
      textStrong: '#F5F8FC',
      textSecondary: '#9BB0C8',
      textMuted: '#6A8098',
      text: '#E8EDF5',
      textTertiary: '#6A8098',
      // Darker borders – navy-ink
      border: '#1E3A58',
      borderLight: '#2A4A68',
      // Lighter semantic colors for dark mode
      danger: '#F87171',
      success: '#4CAF6A',
      warning: '#FBBF24',
      info: '#50B0D0',
      notification: '#F87171',
      // Navigation – navy tint
      navPill: 'rgba(80,176,208, 0.15)',
      navIconActive: '#50B0D0',
      navIconInactive: '#4A6080',
      // Header/Footer with dark navy glass effect
      headerBg: 'rgba(10,21,32, 0.88)',
      footerBg: 'rgba(16,40,64, 0.92)',
      // Alert colors (dark mode)
      alertBg: 'rgba(208,176,48, 0.12)',
      alertBorder: 'rgba(208,176,48, 0.25)',
      alertIcon: '#E5C85A',
      alertText: '#F5E6A8',
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
    /** Stripes, tagline text – bright gold from "KNOWLEDGE IS POWER" motto */
    accent: '#F0D030',
    /** Four-stop diagonal ribbon – navy → green → gold → saffron (logo + Indian flag ribbon) */
    ribbonGradient: ['#103070', '#227030', '#D0B030', '#E87820'] as const,
    /** Optional stops for expo-linear-gradient (length must match ribbonGradient) */
    ribbonGradientLocations: [0, 0.33, 0.66, 1] as const,
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
