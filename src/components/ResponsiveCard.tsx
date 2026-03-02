import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface ResponsiveCardProps {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
    maxWidth?: number;
}

/**
 * A responsive wrapper that prevents cards from stretching excessively on wide screens (e.g., Web, Tablet).
 * It ensures the card stays centered and maintains an optimal reading width while still filling smaller screens.
 */
export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
    children,
    style,
    contentContainerStyle,
    maxWidth = 800 // Default max-width for optimal reading/viewing
}) => {
    return (
        <View style={[styles.outerContainer, style]}>
            <View style={[
                styles.innerCard,
                { maxWidth },
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
        alignItems: 'center', // Centers the card within the parent full width
        justifyContent: 'center',
    },
    innerCard: {
        width: '100%',
        alignSelf: 'center', // Safeguard for center alignment
        // We defer borderRadius, padding, and backgroundColor to the specific implementation via contentContainerStyle
        // to keep this component strictly for layout constraints.
        overflow: 'hidden',
    },
});

export default ResponsiveCard;
