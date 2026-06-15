import React, { useEffect } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';

export default function ForceUpdateScreen() {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const openStore = async () => {
    const packageId = Application.applicationId || '';
    const storeUrl = `https://play.google.com/store/apps/details?id=${packageId}`;
    await Linking.openURL(storeUrl);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-download-outline" size={42} color="#2563EB" />
        </View>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.message}>
          A newer version of this school app is required to continue. Please update from the Play Store.
        </Text>
        <Pressable onPress={openStore} style={styles.button}>
          <Text style={styles.buttonText}>Update Now</Text>
          <Ionicons name="open-outline" size={18} color="#FFFFFF" />
        </Pressable>
        {Platform.OS !== 'android' && (
          <Text style={styles.helper}>If the store does not open, contact your school administrator.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 86,
    height: 86,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: 28,
  },
  button: {
    minHeight: 52,
    minWidth: 190,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  helper: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
});
