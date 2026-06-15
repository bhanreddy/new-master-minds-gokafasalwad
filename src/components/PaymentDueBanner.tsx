import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePaymentBanner } from '../hooks/usePaymentBanner';

const DEFAULT_REASON = 'Payment is due. Please contact the SuperAdmin team.';

export default function PaymentDueBanner() {
  const { enabled, reason } = usePaymentBanner();

  if (!enabled) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.iconWrap}>
        <Ionicons name="warning-outline" size={18} color="#B45309" />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Payment Notice</Text>
        <Text style={styles.message}>{reason?.trim() || DEFAULT_REASON}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    marginBottom: 18,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  message: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
