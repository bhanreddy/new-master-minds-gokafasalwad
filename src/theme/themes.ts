/* ─────────────────────────────────────────────
 *  Design System — Elite SaaS EdTech v2.0
 *  "Mature & Professional"
 *  Clean · Sophisticated · Deep · Airy
 * ───────────────────────────────────────────── */

// ── Surfaces (Refined for Depth) ─────────────────
export const Surfaces = {
    light: {
        base: '#F8FAFC',       // Slate-50: Cool, clean background
        raised: '#FFFFFF',     // Pure White: High contrast cards
        overlay: '#F1F5F9',    // Slate-100: Subtle segmentation
        muted: '#F3F4F6',      // Gray-100: Neutral elements
        tinted: '#F9FAFB',     // Gray-50: Very subtle difference
    },
    dark: {
        base: '#0B0F19',       // Deep Navy/Black: Richer than pure black
        raised: '#151B2B',     // Dark Blue-Grey: Professional card surface
        overlay: '#1E293B',    // Slate-800: Secondary depth
        muted: '#111827',      // Gray-900: Input backgrounds
        tinted: '#161E2E',     // Slight variant
    },
} as const;

// ── Elevation (Subtle & Diffused) ────────────────
export const Elevation = {
    level0: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    /** Card Default */
    level1: {
        shadowColor: '#0F172A', // Slate-900
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    /** Floating / Active */
    level2: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 6,
    },
    /** Modal / Popover */
    level3: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
    },
} as const;

// ── Shadows (Contextual) ────────────────────────
export const Shadows = {
    none: Elevation.level0,
    sm: Elevation.level1,
    md: Elevation.level2,
    lg: Elevation.level3,
    /** Specialized Shadows */
    primaryBy: {
        shadowColor: '#4F46E5', // Primary specific glow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    soft: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
} as const;

// ── Spacing (Strict Grid) ───────────────────────
export const Spacing = {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    xxxl: 48,
    xxxxl: 64,
} as const;

// ── Radii (Modern Squircle-ish) ────────────────
export const Radii = {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,    // Standard Card
    xl: 20,
    xxl: 24,   // Hero Card
    pill: 9999,
} as const;

// ── Typography (Scale & Hierarchy) ──────────────
export const Typography = {
    /** Page Headings (H1) */
    heading: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5, lineHeight: 34 },
    /** Section Headers (H2/H3) */
    subheading: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3, lineHeight: 28 },
    /** Card Titles */
    title: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 22 },
    /** Body Text */
    body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 22 },
    /** Secondary Information */
    caption: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 18 },
    /** Micro Labels / Badges */
    label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
    /** Big Stats */
    stat: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1, lineHeight: 38 },
} as const;

// ── Icon Badge Colors (Muted & Professional) ────
// Used for the icon backgrounds to ensure they don't clash
export const IconBadgeColors = {
    attendance: { bg: '#EEF2FF', icon: '#4F46E5' }, // Indigo
    diary: { bg: '#F0F9FF', icon: '#0EA5E9' },     // Sky
    timetable: { bg: '#ECFDF5', icon: '#10B981' }, // Emerald
    results: { bg: '#FFF7ED', icon: '#F59E0B' },   // Amber
    leaves: { bg: '#FEF2F2', icon: '#EF4444' },    // Red
    complaints: { bg: '#F5F3FF', icon: '#8B5CF6' },// Violet
    lms: { bg: '#FDF2F8', icon: '#EC4899' },       // Pink
} as const;

export const IconBadgeColorsDark = {
    attendance: { bg: 'rgba(79, 70, 229, 0.15)', icon: '#818CF8' },
    diary: { bg: 'rgba(14, 165, 233, 0.15)', icon: '#38BDF8' },
    timetable: { bg: 'rgba(16, 185, 129, 0.15)', icon: '#34D399' },
    results: { bg: 'rgba(245, 158, 11, 0.15)', icon: '#FBBF24' },
    leaves: { bg: 'rgba(239, 68, 68, 0.15)', icon: '#F87171' },
    complaints: { bg: 'rgba(139, 92, 246, 0.15)', icon: '#A78BFA' },
    lms: { bg: 'rgba(236, 72, 153, 0.15)', icon: '#F472B6' },
} as const;

// ── Gradients (Professional Mesh-like) ──────────
export const CardGradients = {
    indigo: ['#4F46E5', '#6366F1'] as [string, string],
    blue: ['#2563EB', '#3B82F6'] as [string, string],
    emerald: ['#059669', '#10B981'] as [string, string],
    amber: ['#D97706', '#F59E0B'] as [string, string],
    orange: ['#EA580C', '#F97316'] as [string, string],
    rose: ['#DC2626', '#EF4444'] as [string, string],
    purple: ['#7C3AED', '#8B5CF6'] as [string, string],
    pink: ['#DB2777', '#EC4899'] as [string, string],
    // Specialized "Glass" gradients
    glassLight: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)'] as [string, string],
    glassDark: ['rgba(30,41,59,0.8)', 'rgba(30,41,59,0.4)'] as [string, string],
} as const;

// ── Light Theme ─────────────────────────────────
export const lightTheme = {
    dark: false,
    colors: {
        primary: '#4F46E5',       // Indigo-600
        primaryDark: '#4338CA',   // Indigo-700
        primaryLight: '#818CF8',  // Indigo-400

        background: Surfaces.light.base,
        card: Surfaces.light.raised,

        text: '#334155',          // Slate-700 (Body)
        textStrong: '#0F172A',    // Slate-900 (Headings)
        textSecondary: '#64748B', // Slate-500
        textTertiary: '#94A3B8',  // Slate-400

        border: '#E2E8F0',        // Slate-200
        borderLight: '#F1F5F9',   // Slate-100

        notification: '#EF4444',

        // Semantic
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',

        // Component Specific
        navPill: '#EEF2FF',
        navIconActive: '#4F46E5',
        navIconInactive: '#94A3B8',

        // Dashboard
        headerBg: 'rgba(248,250,252, 0.85)', // Glass effect
        footerBg: 'rgba(255,255,255, 0.90)',

        // Alerts
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
};

// ── Dark Theme ──────────────────────────────────
export const darkTheme = {
    dark: true,
    colors: {
        primary: '#818CF8',       // Indigo-400
        primaryDark: '#6366F1',   // Indigo-500
        primaryLight: '#A5B4FC',  // Indigo-300

        background: Surfaces.dark.base,
        card: Surfaces.dark.raised,

        text: '#E2E8F0',          // Slate-200
        textStrong: '#F1F5F9',    // Slate-100
        textSecondary: '#94A3B8', // Slate-400
        textTertiary: '#64748B',  // Slate-500

        border: '#1E293B',        // Slate-800
        borderLight: '#334155',   // Slate-700

        notification: '#F87171',

        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171',
        info: '#60A5FA',

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
};

export type ThemeColors = Record<keyof typeof lightTheme.colors, string>;
export interface Theme {
    dark: boolean;
    colors: ThemeColors;
}

// Re-export SchoolTheme types for backward compatibility
export type { SchoolTheme } from './types';
export { defaultLightTheme, defaultDarkTheme } from './types';
