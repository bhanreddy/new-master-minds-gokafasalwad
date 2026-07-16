/**
 * KeyboardAwareScreen — shared keyboard-avoidance primitive.
 *
 * Two variants:
 *   • "scroll" — wraps children in react-native-keyboard-controller's
 *     KeyboardAwareScrollView so the focused input auto-scrolls above
 *     the keyboard. Ideal for long forms.
 *
 *   • "fixed" — renders children normally and provides a
 *     KeyboardStickyView at the bottom that rides up with the keyboard.
 *     Ideal for chat / comment / single-input screens.
 *
 * On web the library no-ops; we fall back to a plain ScrollView / View
 * so web rendering is never broken.
 *
 * No JS-thread-driven keyboard animation — react-native-keyboard-controller
 * uses native drivers on iOS (InputAccessoryView) and Android
 * (WindowInsetsAnimation).
 */
import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/src/theme/themes';

// react-native-keyboard-controller exports.
// On web the library's components either no-op or are unavailable;
// we import from 'react-native-keyboard-controller' and gate by Platform.
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BaseProps {
  /** Theme-driven background; avoids hard-coded colours. */
  backgroundColor?: string;
  /** Extra style applied to the outermost container. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

interface ScrollVariantProps extends BaseProps {
  variant: 'scroll';
  /**
   * Extra space (px) between the focused input and the keyboard top.
   * @default Spacing.lg (24)
   */
  bottomOffset?: number;
  /**
   * Extra padding appended to the scroll content so the last input
   * is never flush with the screen bottom.
   * @default Spacing.xxl (40)
   */
  extraScrollPadding?: number;
  /** Content container style forwarded to the scroll view. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Whether scroll indicators are visible. @default false */
  showsVerticalScrollIndicator?: boolean;
  /**
   * Optional ref to the underlying scroll view, for programmatic
   * scrolling (`scrollTo`, `scrollToEnd`). Forwarded to the native
   * KeyboardAwareScrollView and the web ScrollView fallback alike.
   */
  scrollViewRef?: React.Ref<ScrollView>;
  stickyContent?: never;
}

interface FixedVariantProps extends BaseProps {
  variant: 'fixed';
  /**
   * Content rendered inside the KeyboardStickyView (e.g. a chat input bar).
   * This element rides up on top of the keyboard.
   */
  stickyContent: React.ReactNode;
  /**
   * Offset between the sticky view and the keyboard top.
   * @default 0
   */
  stickyOffset?: number;
  bottomOffset?: never;
  extraScrollPadding?: never;
  contentContainerStyle?: never;
  showsVerticalScrollIndicator?: never;
}

export type KeyboardAwareScreenProps = ScrollVariantProps | FixedVariantProps;

// ─── Component ────────────────────────────────────────────────────────────────

export default function KeyboardAwareScreen(props: KeyboardAwareScreenProps) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  if (props.variant === 'scroll') {
    return (
      <ScrollVariant
        {...props}
        safeBottom={insets.bottom}
        isWeb={isWeb}
      />
    );
  }

  return (
    <FixedVariant
      {...props}
      safeBottom={insets.bottom}
      isWeb={isWeb}
    />
  );
}

// ─── Scroll variant ───────────────────────────────────────────────────────────

function ScrollVariant({
  children,
  backgroundColor,
  style,
  bottomOffset = Spacing.lg,
  extraScrollPadding = Spacing.xxl,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  scrollViewRef,
  safeBottom,
  isWeb,
}: ScrollVariantProps & { safeBottom: number; isWeb: boolean }) {
  const containerStyle: ViewStyle = {
    flex: 1,
    ...(backgroundColor ? { backgroundColor } : undefined),
  };

  // On web, fall back to a plain ScrollView because the native library
  // is a no-op there. This keeps web rendering unaffected.
  if (isWeb) {
    return (
      <View style={[containerStyle, style]}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            { paddingBottom: extraScrollPadding + safeBottom },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        contentContainerStyle={[
          { paddingBottom: extraScrollPadding + safeBottom },
          contentContainerStyle,
        ]}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

// ─── Fixed variant ────────────────────────────────────────────────────────────

function FixedVariant({
  children,
  backgroundColor,
  style,
  stickyContent,
  stickyOffset = 0,
  safeBottom,
  isWeb,
}: FixedVariantProps & { safeBottom: number; isWeb: boolean }) {
  const containerStyle: ViewStyle = {
    flex: 1,
    ...(backgroundColor ? { backgroundColor } : undefined),
  };

  // On web the keyboard doesn't overlap the viewport in the same way,
  // so we just render the sticky content at the bottom with safe area
  // padding.
  if (isWeb) {
    return (
      <View style={[containerStyle, style]}>
        <View style={styles.flexFill}>{children}</View>
        <View style={{ paddingBottom: safeBottom }}>{stickyContent}</View>
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <View style={styles.flexFill}>{children}</View>
      <KeyboardStickyView
        offset={{ closed: 0, opened: stickyOffset }}
      >
        <View style={{ paddingBottom: safeBottom }}>{stickyContent}</View>
      </KeyboardStickyView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
});
