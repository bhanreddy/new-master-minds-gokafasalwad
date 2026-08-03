import React, { memo, useEffect, useRef, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { readAloudService } from '../services/readAloudService';

type Props = {
  id: string;
  text: readonly (string | null | undefined)[];
  color?: string;
  size?: number;
  style?: ViewStyle;
};

const ReadAloudButton = memo(function ReadAloudButton({
  id,
  text,
  color,
  size = 34,
  style,
}: Props) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const snapshot = useSyncExternalStore(
    readAloudService.subscribe,
    readAloudService.getSnapshot,
    readAloudService.getSnapshot
  );
  const lastErrorSequence = useRef(0);
  const isActive = snapshot.activeId === id && snapshot.status !== 'idle';
  const isLoading = snapshot.activeId === id && snapshot.status === 'loading';
  const iconColor = color ?? theme.colors.primary;

  useEffect(() => {
    const error = snapshot.error;
    if (!error || error.id !== id || error.sequence === lastErrorSequence.current) return;
    lastErrorSequence.current = error.sequence;
    Alert.alert(
      t('readAloud.errorTitle', 'Audio unavailable'),
      error.code === 'missing-telugu-voice'
        ? t(
          'readAloud.teluguVoiceMissing',
          'Install the Telugu voice in your device Text-to-speech settings once, then it will work offline.'
        )
        : t('readAloud.speechFailed', 'This text could not be read aloud on this device.')
    );
  }, [id, snapshot.error, t]);

  useEffect(() => () => {
    void readAloudService.stop(id);
  }, [id]);

  const label = isActive
    ? t('readAloud.stop', 'Stop reading')
    : t('readAloud.play', 'Read aloud');

  return (
    <Pressable
      onPress={() => { void readAloudService.toggle(id, text); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('readAloud.hint', 'Reads this card using the matching Telugu or English voice')}
      accessibilityState={{ busy: isLoading, selected: isActive }}
      hitSlop={8}
      style={({ pressed }) => [{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isActive
          ? iconColor
          : isDark ? `${iconColor}24` : `${iconColor}14`,
        borderWidth: 1,
        borderColor: isActive ? iconColor : `${iconColor}38`,
        opacity: pressed ? 0.72 : 1,
      }, style]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Ionicons
          name={isActive ? 'stop' : 'volume-high-outline'}
          size={Math.round(size * 0.5)}
          color={isActive ? '#FFFFFF' : iconColor}
        />
      )}
    </Pressable>
  );
});

export default ReadAloudButton;
