import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated,
  Dimensions, Platform, BackHandler,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────────
export type AlertType = 'success' | 'error' | 'warning' | 'confirm' | 'info';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertConfig {
  visible: boolean;
  type?: AlertType;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

// ─── Icon SVGs (inline for zero dependencies) ───────────────────────────────
const iconConfig: Record<AlertType, { emoji: string; bg: string; ring: string; text: string }> = {
  success: { emoji: '✓', bg: '#D1FAE5', ring: '#34D399', text: '#059669' },
  error:   { emoji: '✕', bg: '#FEE2E2', ring: '#F87171', text: '#DC2626' },
  warning: { emoji: '!', bg: '#FEF3C7', ring: '#FBBF24', text: '#D97706' },
  confirm: { emoji: '?', bg: '#DBEAFE', ring: '#60A5FA', text: '#2563EB' },
  info:    { emoji: 'i', bg: '#E0E7FF', ring: '#818CF8', text: '#4F46E5' },
};

// ─── Portal ID constant ─────────────────────────────────────────────────────────
const PORTAL_ROOT_ID = 'custom-alert-portal-root';

/**
 * Ensure the portal root div exists in document.body (web only).
 * Called once from CustomAlertProvider and can also be called from _layout.tsx.
 */
export function ensurePortalRoot(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(PORTAL_ROOT_ID)) return;
  const el = document.createElement('div');
  el.id = PORTAL_ROOT_ID;
  el.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:0;z-index:99999;pointer-events:none;';
  document.body.appendChild(el);
}

// ─── Alert content (shared between Modal wrapper and Portal wrapper) ─────────
function AlertContent({
  visible, type = 'info', title, message, buttons, onDismiss,
}: AlertConfig) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      ]).start(() => {
        // Bounce the icon
        Animated.sequence([
          Animated.timing(iconBounce, { toValue: 1.2, duration: 150, useNativeDriver: true }),
          Animated.spring(iconBounce, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
        ]).start();
      });
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.75);
      iconBounce.setValue(0);
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      onDismiss?.();
    });
  }, [onDismiss]);

  // Android back button
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, handleDismiss]);

  const resolvedButtons: AlertButton[] = buttons && buttons.length > 0
    ? buttons
    : [{ text: 'OK', style: 'default' }];

  const icon = iconConfig[type];

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Pressable style={styles.backdrop} onPress={handleDismiss} />
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Accent stripe */}
        <View style={[styles.accentStripe, { backgroundColor: icon.ring }]} />

        {/* Icon circle */}
        <Animated.View style={[styles.iconCircle, { backgroundColor: icon.bg, borderColor: icon.ring, transform: [{ scale: iconBounce }] }]}>
          <Text style={[styles.iconText, { color: icon.text }]}>{icon.emoji}</Text>
        </Animated.View>

        {/* Content */}
        <View style={styles.body}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        {/* Buttons */}
        <View style={[styles.buttonRow, resolvedButtons.length === 1 && styles.buttonRowSingle]}>
          {resolvedButtons.map((btn, i) => {
            const isCancel = btn.style === 'cancel';
            const isDestructive = btn.style === 'destructive';
            const isPrimary = !isCancel && !isDestructive && (resolvedButtons.length === 1 || i === resolvedButtons.length - 1);

            return (
              <Pressable
                key={i}
                style={[
                  styles.btn,
                  isCancel && styles.btnCancel,
                  isDestructive && styles.btnDestructive,
                  isPrimary && [styles.btnPrimary, { backgroundColor: icon.ring }],
                  resolvedButtons.length === 1 && styles.btnFull,
                  Platform.OS === 'web' && { cursor: 'pointer' }
                ]}
                onPress={() => {
                  btn.onPress?.();
                  handleDismiss();
                }}
              >
                <Text style={[
                  styles.btnText,
                  isCancel && styles.btnTextCancel,
                  isDestructive && styles.btnTextDestructive,
                  isPrimary && styles.btnTextPrimary,
                ]}>
                  {btn.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Web Portal wrapper ─────────────────────────────────────────────────────────
function WebPortalAlert(props: AlertConfig) {
  if (!props.visible) return null;

  // Dynamic require to avoid bundling react-dom on native
  try {
    const { createPortal } = require('react-dom');
    const portalRoot = document.getElementById(PORTAL_ROOT_ID);
    if (!portalRoot) {
      // Fallback: ensure it exists
      ensurePortalRoot();
      const el = document.getElementById(PORTAL_ROOT_ID);
      if (!el) return <AlertContent {...props} />;
      return createPortal(
        <View style={styles.portalContainer}>
          <AlertContent {...props} />
        </View>,
        el,
      );
    }
    return createPortal(
      <View style={styles.portalContainer}>
        <AlertContent {...props} />
      </View>,
      portalRoot,
    );
  } catch {
    // If createPortal fails for any reason, fall back to inline rendering
    return <AlertContent {...props} />;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────
export default function CustomAlert(props: AlertConfig) {
  const { visible } = props;

  // On web, use portal to escape stacking contexts
  if (Platform.OS === 'web') {
    return <WebPortalAlert {...props} />;
  }

  // On native, use Modal (works correctly)
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={props.onDismiss}>
      <AlertContent {...props} />
    </Modal>
  );
}

// ─── Imperative helper (drop-in for window.alert / window.confirm) ───────────
let _setAlert: ((config: AlertConfig) => void) | null = null;

export function registerAlertSetter(setter: (config: AlertConfig) => void) {
  _setAlert = setter;
}

/**
 * Show a beautiful custom alert. Works like window.alert on web.
 * Returns a Promise that resolves to the button index pressed (useful for confirm).
 */
export function showAlert(opts: {
  type?: AlertType;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
}): Promise<number> {
  return new Promise((resolve) => {
    const buttons = (opts.buttons && opts.buttons.length > 0)
      ? opts.buttons.map((b, i) => ({
          ...b,
          onPress: () => { b.onPress?.(); resolve(i); },
        }))
      : [{ text: 'OK', onPress: () => resolve(0) }];

    if (_setAlert) {
      _setAlert({
        visible: true,
        type: opts.type || 'info',
        title: opts.title,
        message: opts.message,
        buttons,
        onDismiss: () => {
          _setAlert?.({ visible: false });
          resolve(-1);
        },
      });
    } else {
      // Fallback if provider not mounted
      if (typeof window !== 'undefined') {
        window.alert(`${opts.title || ''}\n${opts.message || ''}`);
        resolve(0);
      }
    }
  });
}

export async function showConfirm(opts: {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: AlertType;
  onConfirm?: () => void;
}): Promise<boolean> {
  const idx = await showAlert({
    type: opts.type || 'confirm',
    title: opts.title,
    message: opts.message,
    buttons: [
      { text: opts.cancelText || 'Cancel', style: 'cancel' },
      { text: opts.confirmText || 'Confirm', onPress: opts.onConfirm },
    ],
  });
  return idx === 1;
}

export async function showSuccess(title: string, message?: string, buttons?: AlertButton[]): Promise<number> {
  return showAlert({ type: 'success', title, message, buttons });
}

export async function showError(title: string, message?: string): Promise<number> {
  return showAlert({ type: 'error', title, message });
}

// ─── Provider (mount once at app root) ──────────────────────────────────────
export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = React.useState<AlertConfig>({ visible: false });

  useEffect(() => {
    // Ensure portal root exists on web
    ensurePortalRoot();
    registerAlertSetter(setAlertState);
    return () => { _setAlert = null; };
  }, []);

  return (
    <>
      {children}
      <CustomAlert {...alertState} />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 48, 420);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  // Web portal container: covers the viewport, on top of everything
  portalContainer: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...(Platform.OS === 'web' ? {
      position: 'fixed',
      width: '100%',
      height: '100%',
      pointerEvents: 'auto',
    } as any : {}),
  },
  card: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.2,
        shadowRadius: 32,
      },
      android: { elevation: 24 },
      web: {
        boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25)',
      } as any,
    }),
  },
  accentStripe: {
    height: 4,
    width: '100%',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 24,
  },
  iconText: {
    fontSize: 24,
    fontWeight: '800',
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 10,
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnFull: {
    flex: undefined,
    minWidth: 160,
    alignSelf: 'center',
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnDestructive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnPrimary: {
    // backgroundColor set dynamically
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnTextCancel: {
    color: '#6B7280',
  },
  btnTextDestructive: {
    color: '#DC2626',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
  },
});
