import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { getMediaUrl } from '../utils/media';

interface StudentPhotoProps {
  photoUrl?: string | null;
  displayName?: string | null;
  size: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  fallbackTextStyle?: StyleProp<TextStyle>;
}

/**
 * Student avatar that prefers the stored profile photo and falls back to an
 * initial if the URL is absent or the image cannot be loaded.
 */
export default function StudentPhoto({
  photoUrl,
  displayName,
  size,
  borderRadius = Math.round(size * 0.3),
  style,
  fallbackTextStyle,
}: StudentPhotoProps) {
  const uri = useMemo(() => getMediaUrl(photoUrl), [photoUrl]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const initial = (displayName?.trim()?.[0] || '?').toUpperCase();
  const showImage = !!uri && !failed;

  return (
    <View
      accessibilityLabel={displayName ? `${displayName} profile photo` : 'Student profile photo'}
      style={[
        styles.frame,
        style,
        { width: size, height: size, borderRadius },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initial, fallbackTextStyle]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 15,
    fontWeight: '800',
  },
});
