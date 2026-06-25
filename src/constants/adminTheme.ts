import { ViewStyle } from "react-native";

export const ADMIN_THEME = {
    colors: {
        primary: '#1A1A1A', // Icon solid black – graduation cap & letterform
        secondary: '#C9A84C', // Warm gold – accent complement to monochrome icon
        success: '#2E7D32', // Deep green
        warning: '#E65100', // Deep orange
        danger: '#C62828', // Deep red
        info: '#4A4A4A', // Icon charcoal
        background: {
            app: '#FAFAFA', // Clean near-white (icon background)
            surface: '#FFFFFF',
            subtle: '#F5F5F5',
        },
        text: {
            primary: '#1A1A1A', // Icon solid black
            secondary: '#4A4A4A', // Icon charcoal outline
            muted: '#9E9E9E', // Mid-tone gray
            inverse: '#FFFFFF',
        },
        border: '#E0E0E0', // Neutral light gray border
        icon: '#4A4A4A', // Icon charcoal for icon elements
    },
    spacing: {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        s: 8,
        m: 12,
        l: 16,
        xl: 24,
        full: 9999,
    },
    shadows: {
        sm: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 2,
        } as ViewStyle,
        md: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 4,
        } as ViewStyle,
        lg: {
            shadowColor: "#1A1A1A", // Icon black shadow for brand emphasis
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
        } as ViewStyle,
        none: {
            shadowColor: "transparent",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
        } as ViewStyle,
    },
    typography: {
        size: {
            xs: 12,
            s: 14,
            m: 16,
            l: 18,
            xl: 20,
            xxl: 24,
            xxxl: 30,
        },
        weight: {
            regular: '400',
            medium: '500',
            semibold: '600',
            bold: '700',
        } as const,
    }
};
