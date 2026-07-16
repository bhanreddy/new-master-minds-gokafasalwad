import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Switch,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/hooks/useAuth';
import { useTheme } from '@/src/hooks/useTheme';
import { showAlert } from '@/src/components/CustomAlert';
import { AccessControlService } from '@/src/services/accessControlService';
import * as accountVault from '@/src/services/accountVault';
import type { VaultAccount } from '@/src/services/accountVault';
import { removeVaultedAccount } from '@/src/services/pushFanout';
import {
  getHomeRouteForRole,
  getVaultAccountSubtitle,
} from '@/src/utils/portalRoutes';
import { isStudentRole, isStaffPortalRole } from '@/src/utils/roleHelpers';
import type { ValidatedUser } from '@/src/types/auth';
import { LoginFormDoodle } from '@/src/components/doodles/LoginFormDoodle';
import type { LoginFocusedField } from '@/src/components/doodles/doodleTypes';
import { useLoginDoodleState } from '@/src/hooks/useLoginDoodleState';
import LogoLoader from '../src/components/LogoLoader';
import AdminHeaderCard from '@/src/components/AdminHeaderCard';

import { useLoginTheme } from '@/src/hooks/useLoginTheme';
import {
  FloatingInput,
  LoginAmbientBackground,
  LoginCardHeader,
  SignInButton,
} from '@/src/components/auth/LoginShared';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/2922/2922506.png';

// ─── Unified Login Screen ─────────────────────────────────────────────────────
//
// A single login screen for every role. After a successful authentication the
// user is routed to their preferred dashboard by getHomeRouteForRole() — there
// is NO per-portal gate. Previously-used logins persist in the multi-account
// vault and are offered as one-tap "Continue as" rows (seamless switch, no
// password re-entry). The Accounts-department out-of-hours restriction is
// preserved via the access-request modal.

const UnifiedLoginScreen: React.FC = () => {
  const C = useLoginTheme();
  const styles = getStyles(C);
  const router = useRouter();
  const { t } = useTranslation();
  const { toggleTheme } = useTheme();
  const { user, loading: authLoading, signIn, switchAccount } = useAuth();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // ── Saved logins (multi-account vault) ─────────────────────────────────────
  const [savedAccounts, setSavedAccounts] = useState<VaultAccount[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // ── Form-reactive doodle state ──────────────────────────────────────────────
  const reduceMotion = useReducedMotion();
  const motionEnabled = !reduceMotion;
  const { width: winW } = useWindowDimensions();
  const doodleSize = Math.min(Math.max(Math.round(winW * 0.24), 88), 124);
  const [focusedField, setFocusedField] = useState<LoginFocusedField>(null);
  const [loginResult, setLoginResult] = useState<'success' | 'error' | null>(null);
  const errorResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (errorResetTimer.current) clearTimeout(errorResetTimer.current);
  }, []);

  /** Brief "concerned + head shake" reaction, then back to field-reactive state. */
  const flagLoginError = useCallback(() => {
    setLoginResult('error');
    if (errorResetTimer.current) clearTimeout(errorResetTimer.current);
    errorResetTimer.current = setTimeout(() => setLoginResult(null), 1800);
  }, []);

  const doodleState = useLoginDoodleState({
    focusedField,
    showPassword,
    isSubmitting: loading || !!switchingId,
    loginResult,
  });

  // ── Accounts-department out-of-hours access request ────────────────────────
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [restrictedUserId, setRestrictedUserId] = useState<string | null>(null);

  // ── Load saved logins from the vault ───────────────────────────────────────
  const loadSavedAccounts = useCallback(async () => {
    try {
      const accts = await accountVault.listAccounts();
      setSavedAccounts(accts);
    } catch {
      // Vault read failures must never block the login form.
      setSavedAccounts([]);
    }
  }, []);

  useEffect(() => {
    loadSavedAccounts();
  }, [loadSavedAccounts]);

  // If a session is already live (or being restored), never show the form —
  // useAuthGuard routes the user to their dashboard.
  if (authLoading || user) {
    return (
      <View style={styles.loadingScreen}>
        <LogoLoader size={56} color={C.accent} />
      </View>
    );
  }

  // ── Route an authenticated user to their landing screen ────────────────────
  // Mirrors app/index.tsx's resolveTarget so a profile-less student/staff lands
  // on /no-profile in one hop (no dashboard flash before useAuthGuard corrects).
  const goToDashboard = (validatedUser: ValidatedUser) => {
    const roleCode = validatedUser.role?.code;
    if (isStudentRole(roleCode) && validatedUser.has_student_profile === false) {
      router.replace('/no-profile');
      return;
    }
    if (isStaffPortalRole(roleCode) && validatedUser.has_staff_profile === false) {
      router.replace('/no-profile');
      return;
    }
    router.replace(getHomeRouteForRole(roleCode));
  };

  // ── One-tap continue with a saved login (seamless, no password) ────────────
  const handleContinueAs = async (acct: VaultAccount) => {
    if (switchingId || loading) return;
    setSwitchingId(acct.userId);
    try {
      const res = await switchAccount(acct.userId);
      if (res.error || !res.session) {
        flagLoginError();
        showAlert({
          type: 'error',
          title: 'Could not continue',
          message:
            res.error ||
            'This saved login could not be restored. Please sign in again below.',
        });
        return;
      }
      setLoginResult('success');
      goToDashboard(res.session.validatedUser);
    } catch (err: any) {
      flagLoginError();
      showAlert({
        type: 'error',
        title: 'Could not continue',
        message: err?.message || 'Please sign in again below.',
      });
    } finally {
      setSwitchingId(null);
    }
  };

  // ── Remove a saved login from this device ──────────────────────────────────
  const handleRemoveSaved = async (acct: VaultAccount) => {
    if (switchingId || loading) return;
    try {
      await removeVaultedAccount(acct.userId);
    } catch {
      // best-effort — reload the list regardless
    }
    await loadSavedAccounts();
  };

  // ── Out-of-hours access request (Accounts department) ──────────────────────
  const handleRequestAccess = async () => {
    if (!restrictedUserId) return;
    setRequestingAccess(true);
    try {
      await AccessControlService.requestOutOfHoursAccess(restrictedUserId, 'accounts', accessReason);
      showAlert({ type: 'success', title: 'Request Sent', message: 'Your request has been sent to the Admin for approval.' });
      setShowAccessModal(false);
      setAccessReason('');
    } catch (error: any) {
      showAlert({ type: 'error', title: 'Error', message: error.message || 'Failed to submit request' });
    } finally {
      setRequestingAccess(false);
    }
  };

  // ── Validate & sign in (any role) ──────────────────────────────────────────
  const handleLogin = async () => {
    let hasErr = false;
    if (!email) { setEmailError('Email is required'); hasErr = true; }
    if (!password) { setPasswordError('Password is required'); hasErr = true; }
    if (hasErr) return;

    setLoading(true);
    try {
      const response = await signIn(email, password);

      if (response.error || !response.session) {
        flagLoginError();
        showAlert({ type: 'error', title: 'Login Failed', message: response.error || 'Invalid credentials' });
        return;
      }

      // Success — brief celebratory doodle, then route to the signed-in role's
      // dashboard immediately (never delay navigation for the animation).
      setLoginResult('success');
      goToDashboard(response.session.validatedUser);
    } catch (err: any) {
      // Accounts department outside school hours — offer the access-request flow.
      if (err?.code === 'OUT_OF_HOURS_NO_ACCESS' && err.userId) {
        setRestrictedUserId(err.userId);
        setShowAccessModal(true);
      } else {
        flagLoginError();
        showAlert({ type: 'error', title: 'Login Failed', message: err?.message || 'Invalid credentials' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <LoginAmbientBackground />
      <StatusBar barStyle={C.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shell}>
            <SafeAreaView edges={['top']} style={styles.topArea}>
              <View style={styles.themeRow}>
                <View style={styles.themeToggle}>
                  <Ionicons
                    name={C.isDark ? 'moon' : 'sunny'}
                    size={14}
                    color={C.accent}
                  />
                  <Text style={styles.themeToggleText}>
                    {C.isDark ? 'Dark mode' : 'Light mode'}
                  </Text>
                  <Switch
                    value={C.isDark}
                    onValueChange={toggleTheme}
                    thumbColor="#FFFFFF"
                    trackColor={{
                      false: 'rgba(107,47,160,0.22)',
                      true: C.accentDark,
                    }}
                    style={styles.themeSwitch}
                  />
                </View>
              </View>

              <View style={styles.headerWrap}>
                <AdminHeaderCard
                  variant="login"
                  portalBadge="SIGN IN"
                  tagline="One login for every portal"
                />
              </View>
            </SafeAreaView>

            {/* ── FORM BODY ────────────────────────────────────────────────── */}
            <View style={styles.body}>

            {/* Saved logins (multi-account) */}
            {savedAccounts.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(60).duration(500)}
                style={styles.savedCard}
              >
                <Text style={styles.savedTitle}>Continue as</Text>
                {savedAccounts.map((acct, idx) => {
                  const busy = switchingId === acct.userId;
                  return (
                    <View key={acct.userId}>
                      {idx > 0 && <View style={styles.savedDivider} />}
                      <TouchableOpacity
                        style={styles.savedRow}
                        activeOpacity={0.7}
                        disabled={!!switchingId || loading}
                        onPress={() => handleContinueAs(acct)}
                      >
                        <View style={styles.savedAvatarRing}>
                          <Image
                            source={{ uri: acct.photoUrl || FALLBACK_AVATAR }}
                            style={styles.savedAvatar}
                          />
                        </View>
                        <View style={styles.savedMeta}>
                          <Text style={styles.savedName} numberOfLines={1}>
                            {acct.displayName || 'Account'}
                          </Text>
                          <Text style={styles.savedSub} numberOfLines={1}>
                            {getVaultAccountSubtitle(acct)}
                          </Text>
                        </View>
                        {busy ? (
                          <ActivityIndicator size="small" color={C.accent} />
                        ) : (
                          <View style={styles.savedRight}>
                            <Ionicons name="chevron-forward" size={18} color={C.inkGhost} />
                            <TouchableOpacity
                              style={styles.savedRemoveBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              disabled={!!switchingId || loading}
                              onPress={() => handleRemoveSaved(acct)}
                            >
                              <Ionicons name="close" size={15} color={C.inkGhost} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </Animated.View>
            )}

            {/* Form-reactive mascot — decorative, sits on the card's top edge.
                zIndex keeps its overlapping feet above the card; pointerEvents
                none means it can never block the form. No `entering` — must
                stay visible even where layout animations are unsupported. */}
            <View
              pointerEvents="none"
              style={{
                alignItems: 'center',
                zIndex: 2,
                marginBottom: -Math.round(doodleSize * 0.13),
              }}
            >
              <LoginFormDoodle
                state={doodleState}
                size={doodleSize}
                primaryColor={C.accent}
                primaryDarkColor={C.accentDark}
                motionEnabled={motionEnabled}
              />
            </View>

            {/* Form card */}
            <Animated.View
              entering={FadeInUp.delay(100).duration(600).springify()}
              style={styles.card}
            >
              <LoginCardHeader
                portalBadge="SECURE LOGIN"
                tagline="Login To your School"
                title={
                  savedAccounts.length > 0
                    ? 'Use another account'
                    : (t('welcomeBack') || 'Welcome back')
                }
                subtitle={t('signInToContinue') || 'Sign in to continue'}
                icon="shield-checkmark-outline"
              />

              {/* Email */}
              <View style={styles.fieldGap}>
                <FloatingInput
                  label={t('emailAddress') || 'Email Address'}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                  icon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  autoComplete="email"
                  hasError={!!emailError}
                  errorText={emailError}
                  delay={200}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                />
              </View>

              {/* Password */}
              <View style={styles.fieldGap}>
                <FloatingInput
                  label={t('password') || 'Password'}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setPasswordError(''); }}
                  icon="lock-closed-outline"
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="current-password"
                  hasError={!!passwordError}
                  errorText={passwordError}
                  delay={280}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                  rightAction={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={19}
                        color={C.inkSoft}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* Forgot password */}
              <Animated.View
                entering={FadeInDown.delay(360).duration(500)}
                style={styles.forgotRow}
              >
                <TouchableOpacity
                  onPress={() => router.push('/forgot-password')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotText}>
                    {t('forgotPassword') || 'Forgot password?'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Sign in button */}
              <View style={styles.btnWrap}>
                <SignInButton
                  onPress={handleLogin}
                  loading={loading}
                  label={t('signIn') || 'Sign In'}
                />
              </View>

              {/* Trust strip */}
              <Animated.View
                entering={FadeInUp.delay(600).duration(500)}
                style={styles.trustStrip}
              >
                <View style={styles.trustItem}>
                  <Ionicons name="lock-closed" size={12} color={C.accent} />
                  <Text style={styles.trustText}>256-bit encrypted</Text>
                </View>
                <View style={styles.trustItem}>
                  <Ionicons name="shield-outline" size={12} color={C.accent} />
                  <Text style={styles.trustText}>Secure login</Text>
                </View>
                <View style={styles.trustItem}>
                  <Ionicons name="server-outline" size={12} color={C.accent} />
                  <Text style={styles.trustText}>Data protected</Text>
                </View>
              </Animated.View>
            </Animated.View>

            {/* Help row */}
            <Animated.View
              entering={FadeInUp.delay(700).duration(500)}
              style={styles.helpRow}
            >
              <Ionicons name="help-circle-outline" size={14} color={C.inkGhost} />
              <Text style={styles.helpText}>
                Having trouble?{' '}
                <Text style={styles.helpLink}>Contact your school admin</Text>
              </Text>
            </Animated.View>

            {/* Footer */}
            <Animated.View
              entering={FadeInUp.delay(800).duration(400)}
              style={styles.footer}
            >
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>
                Powered by{' '}
                <Text style={styles.footerBrand}>NexSyrus</Text>
              </Text>
            </Animated.View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Access Restricted Modal (Accounts department, out of hours) */}
      <Modal visible={showAccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowAccessModal(false)} activeOpacity={1} />
          <Animated.View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-closed" size={32} color={C.error} />
              </View>
              <Text style={styles.modalTitle}>Access Restricted</Text>
              <Text style={styles.modalSubtitle}>
                The Accounts portal is restricted to school hours. You need administrator approval to log in.
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Reason for access (optional)</Text>
              <TextInput
                style={[styles.reasonInput, { color: C.ink }]}
                placeholder="Why do you need access outside hours?"
                placeholderTextColor={C.inkSoft}
                value={accessReason}
                onChangeText={setAccessReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAccessModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <SignInButton
                onPress={handleRequestAccess}
                loading={requestingAccess}
                label="Request Access"
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

export default UnifiedLoginScreen;

// ─── Stylesheet ───────────────────────────────────────────────────────────────

const getStyles = (C: ReturnType<typeof useLoginTheme>) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    ...Platform.select({
      web: {
        justifyContent: 'center',
        minHeight: '100%',
        paddingVertical: 28,
      } as any,
    }),
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 8 : 12,
    paddingBottom: 36,
  },
  topArea: {
    width: '100%',
  },
  themeRow: {
    alignItems: 'flex-end',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 34,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 999,
    backgroundColor: C.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: C.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(107,47,160,0.10)',
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.inkSoft,
  },
  themeSwitch: {
    transform: [{ scale: 0.72 }],
  },

  headerWrap: {
    paddingBottom: 12,
    width: '100%',
    ...Platform.select({
      web: { alignItems: 'center' } as any,
    }),
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    width: '100%',
    paddingBottom: 28,
  },

  // ── Saved logins card ─────────────────────────────────────────────────────
  savedCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.isDark ? 'rgba(255,255,255,0.08)' : C.borderNeutral,
    ...C.shadow.md,
    shadowColor: C.isDark ? '#000000' : C.shadow.color,
    ...Platform.select({
      web: {
        boxShadow: C.isDark
          ? '0 16px 34px rgba(0,0,0,0.44)'
          : '0 12px 30px rgba(107,47,160,0.10)',
      } as any,
    }),
  },
  savedTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.inkSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  savedDivider: {
    height: 1,
    backgroundColor: C.isDark ? 'rgba(255,255,255,0.06)' : C.borderNeutral,
    opacity: 0.7,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  savedAvatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
  },
  savedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.borderNeutral,
  },
  savedMeta: {
    flex: 1,
  },
  savedName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  savedSub: {
    fontSize: 12.5,
    color: C.inkSoft,
    fontWeight: '500',
    marginTop: 2,
  },
  savedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.isDark ? 'rgba(255,255,255,0.05)' : C.surfaceAlt,
  },

  // ── Form Card ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: C.isDark ? 'rgba(255,255,255,0.08)' : C.borderNeutral,
    overflow: 'hidden',
    ...C.shadow.lg,
    shadowColor: C.isDark ? '#000000' : C.shadow.color,
    ...Platform.select({
      web: {
        width: '100%',
        boxShadow: C.isDark
          ? '0 24px 52px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.05)'
          : '0 18px 44px rgba(107,47,160,0.12)',
      } as any,
    }),
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  fieldGap: {
    marginBottom: 16,
  },

  // ── Forgot row ────────────────────────────────────────────────────────────
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },

  // ── Sign In Button ────────────────────────────────────────────────────────
  btnWrap: {
    marginBottom: 20,
  },

  // ── Trust strip ───────────────────────────────────────────────────────────
  trustStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(107,47,160,0.10)',
    backgroundColor: C.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(107,47,160,0.05)',
  },
  trustText: {
    fontSize: 11,
    color: C.inkSoft,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Help + Footer ─────────────────────────────────────────────────────────
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 20,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: C.inkGhost,
    fontWeight: '400',
  },
  helpLink: {
    color: C.accent,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerDivider: {
    width: 36,
    height: 1,
    backgroundColor: C.borderNeutral,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: C.inkGhost,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '400',
  },
  footerBrand: {
    fontWeight: '700',
    color: C.inkSoft,
    letterSpacing: 1.2,
  },

  // ── Access-restricted modal ───────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: { backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(217, 119, 6, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: C.inkSoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  modalBody: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: C.inkMid, marginBottom: 8 },
  reasonInput: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderNeutral, borderRadius: 16, padding: 16, fontSize: 15, color: C.ink, minHeight: 100 },
  modalFooter: { flexDirection: 'row', alignItems: 'center' },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: C.surfaceAlt, alignItems: 'center', marginRight: 12 },
  cancelBtnText: { color: C.inkSoft, fontSize: 15, fontWeight: '600' },
});
