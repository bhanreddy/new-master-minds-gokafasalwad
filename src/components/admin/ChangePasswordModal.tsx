import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/apiClient';
import AnimatedInput from '../AnimatedInput';
import PremiumButton from '../PremiumButton';
import { SCHOOL_NAME, SCHOOL_LOGO } from '../../constants/school';

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  passwordsMatch: boolean;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

const ChangePasswordModal: React.FC = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const { requiresPasswordChange, setRequiresPasswordChange, session } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ newPassword: false, confirmPassword: false });

  useEffect(() => {
    if (!requiresPasswordChange) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backHandler.remove();
  }, [requiresPasswordChange]);

  const validation: PasswordValidation = useMemo(() => ({
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    passwordsMatch: newPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword]);

  const passwordStrength: PasswordStrength = useMemo(() => {
    const score = [
      validation.minLength,
      validation.hasUppercase,
      validation.hasNumber,
      validation.hasSpecial,
    ].filter(Boolean).length;

    if (score <= 1) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  }, [validation]);

  const strengthColor = useMemo(() => {
    switch (passwordStrength) {
      case 'weak': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'strong': return '#10B981';
    }
  }, [passwordStrength]);

  const isFormValid = useMemo(() => {
    return Object.values(validation).every(Boolean);
  }, [validation]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || loading) return;

    setLoading(true);
    setApiError(null);

    try {
      const response = await api.post<ChangePasswordResponse>('/auth/admin/change-password', {
        newPassword,
        confirmPassword,
      }, {
        headers: {
          Authorization: `Bearer ${session?.supabaseSession?.access_token}`,
        },
      });

      if (response.success) {
        setRequiresPasswordChange(false);
        Toast.show({
          type: 'success',
          text1: 'Password Updated',
          text2: 'Your password has been changed successfully.',
          position: 'top',
          visibilityTime: 3000,
        });
        router.replace('/admin');
      } else {
        setApiError(response.message || 'Failed to update password');
      }
    } catch (error: any) {
      const message = error?.message || 'An unexpected error occurred. Please try again.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }, [isFormValid, loading, newPassword, confirmPassword, session, setRequiresPasswordChange, router]);

  const renderValidationItem = useCallback((
    label: string,
    isValid: boolean,
    show: boolean = true
  ) => {
    if (!show) return null;
    return (
      <View style={styles.validationItem}>
        <Ionicons
          name={isValid ? 'checkmark-circle' : 'close-circle'}
          size={18}
          color={isValid ? '#10B981' : '#94A3B8'}
        />
        <Text style={[
          styles.validationText,
          { color: isValid ? '#10B981' : theme.colors.textMuted }
        ]}>
          {label}
        </Text>
      </View>
    );
  }, [theme]);

  const styles = useMemo(() => StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 40,
    },
    headerSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 20,
      marginBottom: 24,
    },
    logoPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: '#7C3AED',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.textStrong,
      marginBottom: 12,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 20,
    },
    formCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      padding: 24,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.05,
          shadowRadius: 24,
        },
        android: { elevation: 4 },
        web: { boxShadow: '0 8px 24px rgba(0,0,0,0.05)' } as any,
      }),
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.03)',
    },
    inputWrapper: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
    },
    strengthContainer: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    strengthBarBackground: {
      flex: 1,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      marginRight: 12,
    },
    strengthBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    strengthText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
      minWidth: 60,
    },
    validationContainer: {
      marginTop: 16,
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    validationTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    validationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    validationText: {
      fontSize: 14,
      marginLeft: 10,
      fontWeight: '500',
    },
    errorContainer: {
      backgroundColor: '#FEE2E2',
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorText: {
      color: '#DC2626',
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 10,
      flex: 1,
    },
    mismatchError: {
      color: '#EF4444',
      fontSize: 13,
      marginTop: 8,
      marginLeft: 4,
      fontWeight: '500',
    },
    buttonWrapper: {
      marginTop: 24,
    },
  }), [theme]);

  const strengthWidth = useMemo(() => {
    switch (passwordStrength) {
      case 'weak': return '33%';
      case 'medium': return '66%';
      case 'strong': return '100%';
    }
  }, [passwordStrength]);

  return (
    <Modal
      visible={requiresPasswordChange}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {}}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            entering={FadeInDown.delay(100).duration(500).springify()}
            style={styles.headerSection}
          >
            {SCHOOL_LOGO ? (
              <Image source={{ uri: SCHOOL_LOGO }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="shield-checkmark" size={40} color="#FFFFFF" />
              </View>
            )}
            <Text style={styles.title}>Set a New Password</Text>
            <Text style={styles.subtitle}>
              Your account was set up with a temporary password. You must create a new password before continuing to {SCHOOL_NAME}.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(200).duration(500).springify()}
            style={styles.formCard}
          >
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>New Password</Text>
              <AnimatedInput
                icon={({ color }) => <Ionicons name="lock-closed-outline" size={20} color={color} />}
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  setTouched(prev => ({ ...prev, newPassword: true }));
                  setApiError(null);
                }}
                secureTextEntry={!showNewPassword}
                accentColor="#7C3AED"
                rightAccessory={
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons
                      name={showNewPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                }
              />
              {touched.newPassword && newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarBackground}>
                    <View
                      style={[
                        styles.strengthBarFill,
                        { width: strengthWidth, backgroundColor: strengthColor },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthText, { color: strengthColor }]}>
                    {passwordStrength}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <AnimatedInput
                icon={({ color }) => <Ionicons name="lock-closed-outline" size={20} color={color} />}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setTouched(prev => ({ ...prev, confirmPassword: true }));
                  setApiError(null);
                }}
                secureTextEntry={!showConfirmPassword}
                accentColor="#7C3AED"
                error={touched.confirmPassword && confirmPassword.length > 0 && !validation.passwordsMatch}
                rightAccessory={
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                }
              />
              {touched.confirmPassword && confirmPassword.length > 0 && !validation.passwordsMatch && (
                <Text style={styles.mismatchError}>Passwords do not match</Text>
              )}
            </View>

            <View style={styles.validationContainer}>
              <Text style={styles.validationTitle}>Password Requirements</Text>
              {renderValidationItem('At least 8 characters', validation.minLength)}
              {renderValidationItem('At least 1 uppercase letter', validation.hasUppercase)}
              {renderValidationItem('At least 1 number', validation.hasNumber)}
              {renderValidationItem('At least 1 special character (!@#$%^&*)', validation.hasSpecial)}
              {renderValidationItem('Passwords match', validation.passwordsMatch, confirmPassword.length > 0)}
            </View>

            {apiError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <Text style={styles.errorText}>{apiError}</Text>
              </View>
            )}

            <View style={styles.buttonWrapper}>
              <PremiumButton
                title="Update Password"
                onPress={handleSubmit}
                loading={loading}
                disabled={!isFormValid}
                colors={['#8B5CF6', '#7C3AED']}
                icon={
                  !loading ? (
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 8 }} />
                  ) : undefined
                }
              />
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ChangePasswordModal;
