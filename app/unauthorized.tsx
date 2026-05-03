import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/hooks/useAuth';
import * as Haptics from '@/src/utils/haptics';

export default function UnauthorizedScreen() {
    const router = useRouter();
    const { signOut } = useAuth();

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/welcome');
        }
    };

    const handleLogout = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        signOut();
    };

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Ionicons name="lock-closed" size={64} color="#EF4444" />
            </View>
            <Text style={styles.title}>Access Denied</Text>
            <Text style={styles.message}>
                You do not have the required permissions to access this screen. If you believe this is an error, please contact your school administrator.
            </Text>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleBack}>
                    <Text style={styles.primaryButtonText}>Go Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={handleLogout}>
                    <Text style={styles.secondaryButtonText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    actions: {
        width: '100%',
        gap: 16,
    },
    primaryButton: {
        backgroundColor: '#1E293B',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    secondaryButtonText: {
        color: '#475569',
        fontSize: 16,
        fontWeight: '700',
    },
});
