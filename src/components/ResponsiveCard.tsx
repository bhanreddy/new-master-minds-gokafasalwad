import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface ResponsiveCardProps {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    maxWidth?: number;
    /** When true, content stretches to the full available width instead of staying centered. */
    fullWidth?: boolean;
}

/**
 * A responsive wrapper that prevents cards from stretching excessively on wide screens (e.g., Web, Tablet).
 * It ensures the card stays centered and maintains an optimal reading width while still filling smaller screens.
 */
export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
    children,
    style,
    contentContainerStyle,
    maxWidth = 800,
    fullWidth = false,
}) => {
    return (
        <View style={[styles.outerContainer, fullWidth && styles.outerContainerFull, style]}>
            <View style={[
                styles.innerCard,
                { maxWidth },
                fullWidth && styles.innerCardFull,
                contentContainerStyle
            ]}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    outerContainerFull: {
        alignItems: 'stretch',
    },
    innerCard: {
        width: '100%',
        alignSelf: 'center',
        overflow: 'hidden',
    },
    innerCardFull: {
        alignSelf: 'stretch',
    },
});

export default ResponsiveCard;
