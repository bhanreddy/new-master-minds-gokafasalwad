import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

/**
 * Circular avatar shared across all portals. Renders the photo when a URL is
 * present; otherwise falls back to the user's initials on a deterministic
 * colour derived from their name (stable per person, no random flicker).
 */

const PALETTE = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#EA580C',
  '#D97706', '#059669', '#0891B2', '#2563EB', '#9333EA',
];

function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  /** Public photo URL, or null/undefined to show initials. */
  photoUrl?: string | null;
  /** Display name used for initials + fallback colour. */
  name?: string | null;
  /** Diameter in px. */
  size?: number;
  /** Corner radius override. Defaults to size/2 (full circle). */
  borderRadius?: number;
  /** Optional border ring. */
  ringColor?: string;
  ringWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<AvatarProps> = ({
  photoUrl,
  name,
  size = 96,
  borderRadius,
  ringColor,
  ringWidth = 0,
  style,
}) => {
  const [failed, setFailed] = React.useState(false);

  // Reset the error state whenever the URL changes (e.g. after a new upload).
  React.useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  const safeName = (name && name.trim()) || 'User';
  const showImage = !!photoUrl && !failed;

  const radius = borderRadius ?? size / 2;
  const dimStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    borderColor: ringColor,
    borderWidth: ringColor ? ringWidth : 0,
  };

  if (showImage) {
    return (
      <Image
        source={{ uri: photoUrl! }}
        style={[styles.base, dimStyle, style as any]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        onError={() => setFailed(true)}
        accessibilityLabel={`${safeName} profile photo`}
      />
    );
  }

  return (
    <View
      style={[styles.base, styles.fallback, dimStyle, { backgroundColor: colorFromString(safeName) }, style]}
      accessibilityLabel={`${safeName} initials`}
    >
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(safeName)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default Avatar;
