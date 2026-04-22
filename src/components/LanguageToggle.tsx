import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTelugu } from '../utils/lang';
import * as Haptics from '../utils/haptics';

/**
 * Pill-style language toggle: EN / తె
 * Place in any header. Tapping switches between English and Telugu.
 */
const LanguageToggle: React.FC<{ style?: any }> = ({ style }) => {
  const { i18n } = useTranslation();
  const isTeluguLang = isTelugu(i18n.language);

  const toggle = async () => {
    const next = isTeluguLang ? 'en' : 'te';
    i18n.changeLanguage(next);
    await AsyncStorage.setItem('appLanguage', next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable
      onPress={toggle}
      style={[styles.pill, style]}
      accessibilityRole="button"
      accessibilityLabel={isTeluguLang ? 'Switch to English' : 'Switch to Telugu'}
    >
      <View style={[styles.segment, !isTeluguLang && styles.activeSegment]}>
        <Text style={[styles.label, !isTeluguLang && styles.activeLabel]}>EN</Text>
      </View>
      <View style={[styles.segment, isTeluguLang && styles.activeSegment]}>
        <Text style={[styles.label, isTeluguLang && styles.activeLabel]}>తె</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 2,
    gap: 2,
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSegment: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  activeLabel: {
    color: '#FFFFFF',
  },
});

export default LanguageToggle;
