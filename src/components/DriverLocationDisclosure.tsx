import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

export type DriverLocationDisclosureStage = 'foreground' | 'background';

type Props = {
  visible: boolean;
  stage: DriverLocationDisclosureStage;
  onContinue: () => void;
  onCancel: () => void;
};

/**
 * Google Play prominent disclosure shown immediately before each Android
 * location permission request. Keep the data type, use, sharing, and
 * background behavior in the primary body so all required copy is visible.
 */
export default function DriverLocationDisclosure({
  visible,
  stage,
  onContinue,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const s = React.useMemo(() => getStyles(theme), [theme]);
  const isBackground = stage === 'background';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={s.backdrop} accessibilityViewIsModal>
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Ionicons
              name={isBackground ? 'phone-portrait-outline' : 'location-outline'}
              size={28}
              color={theme.colors.primary}
            />
          </View>

          <Text style={s.title} accessibilityRole="header">
            {t(
              isBackground
                ? 'driver_ui.location_disclosure_background_title'
                : 'driver_ui.location_disclosure_title',
            )}
          </Text>
          <Text style={s.body}>
            {t(
              isBackground
                ? 'driver_ui.location_disclosure_background_body'
                : 'driver_ui.location_disclosure_body',
            )}
          </Text>

          <View style={s.notice}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
            <Text style={s.noticeText}>{t('driver_ui.location_disclosure_control')}</Text>
          </View>

          <View style={s.actions}>
            <TouchableOpacity
              style={s.cancelButton}
              onPress={onCancel}
              accessibilityRole="button"
            >
              <Text style={s.cancelText}>{t('driver_ui.location_disclosure_not_now')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.continueButton}
              onPress={onContinue}
              accessibilityRole="button"
            >
              <Text style={s.continueText}>{t('driver_ui.location_disclosure_continue')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 22,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: theme.colors.primary + '16',
  },
  title: {
    marginBottom: 10,
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + '0D',
  },
  noticeText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  continueButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
  },
  continueText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
