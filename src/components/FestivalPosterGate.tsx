import React, { useEffect, useState } from 'react';
import { Modal, View, Image, Pressable, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';

type FestivalPoster = {
  id: string;
  title: string;
  image_url: string | null;
  ends_at: string;
};

// Android emulators reach the dev machine via 10.0.2.2 — rewrite to loopback on web.
function resolveSuperAdminApiUrl(): string {
  const primary = (process.env.EXPO_PUBLIC_SUPERADMIN_API_URL || '').trim();
  const resolved = Platform.OS === 'web'
    ? primary.replace(/10\.0\.2\.2/g, '127.0.0.1').replace(/10\.0\.3\.2/g, '127.0.0.1')
    : primary;
  return resolved || 'https://superadminbackend-8ulw.onrender.com';
}

const SUPERADMIN_API_URL = resolveSuperAdminApiUrl();

const seenKey = (userId: string, posterId: string) => `festival_poster_seen:${userId}:${posterId}`;

const { width: W, height: H } = Dimensions.get('window');

/**
 * Festival poster popup uploaded from the SuperAdmin app. Shown at most once
 * per user per poster, for every role. Fail-silent: any error means no popup.
 */
export default function FestivalPosterGate() {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const [poster, setPoster] = useState<FestivalPoster | null>(null);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    (async () => {
      try {
        const res = await fetch(`${SUPERADMIN_API_URL}/api/public/festival-poster?app=schoolims`);
        if (!res.ok) return;
        const body = await res.json();
        const p: FestivalPoster | null = body?.poster ?? null;
        if (!p || !p.image_url || !mounted) return;
        const seen = await AsyncStorage.getItem(seenKey(userId, p.id));
        if (seen || !mounted) return;
        // Mark seen at show-time so an app kill can't re-show it.
        await AsyncStorage.setItem(seenKey(userId, p.id), new Date().toISOString());
        if (mounted) setPoster(p);
      } catch {
        // Silent: the poster popup must never affect app startup.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  if (!poster?.image_url) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setPoster(null)}>
      <Pressable style={styles.backdrop} onPress={() => setPoster(null)}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Image
            source={{ uri: poster.image_url }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setPoster(null)}
          />
          <Pressable
            style={styles.closeBtn}
            onPress={() => setPoster(null)}
            hitSlop={12}
            accessibilityLabel="Close festival poster"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: Math.min(W - 32, 420),
    maxHeight: H * 0.8,
    borderRadius: 20,
    overflow: 'visible',
  },
  image: {
    width: '100%',
    height: Math.min(H * 0.72, 560),
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  closeBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
});
