import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { clearStaffPortalSession } from '../services/staffPortalSession';

export default function ViewAsBanner({ name }: { name?: string }) {
  const { isDark } = useTheme();
  const exitPortal = () => {
    clearStaffPortalSession();
  };
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? 'rgba(255,176,26,0.14)' : 'rgba(255,176,26,0.10)',
          borderColor: isDark ? 'rgba(255,176,26,0.30)' : 'rgba(255,176,26,0.28)',
        },
      ]}
    >
      <Ionicons name="create-outline" size={14} color="#047857" style={{ marginRight: 7 }} />
      <Text style={styles.text} numberOfLines={2}>
        Managing {name || 'staff'}'s portal — Admin read/write access
      </Text>
      <Link href="/admin/manage-staff" replace asChild>
        <TouchableOpacity onPress={exitPortal} style={styles.exit} accessibilityRole="link" accessibilityLabel="Exit staff portal">
          <Text style={styles.exitText}>Exit</Text>
          <Ionicons name="close" size={14} color="#047857" />
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  exit: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: 'rgba(16,185,129,0.10)' },
  exitText: { color: '#047857', fontSize: 11, fontWeight: '800', marginRight: 2 },
});
