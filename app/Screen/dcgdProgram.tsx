import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Linking,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useTheme } from '../../src/hooks/useTheme';
import {
  DcgdContentItem,
  DcgdProgramContentPayload,
  fetchProgramContent,
} from '../../src/services/dcgdService';

const CONTENT_MAX_W = 720;

function resolveIonIcon(raw: string): keyof typeof Ionicons.glyphMap {
  const key = (raw || 'ribbon-outline') as keyof typeof Ionicons.glyphMap;
  return key in Ionicons.glyphMap ? key : 'ribbon-outline';
}

/* ── Content item card — renders ALL present fields ──────── */
function ContentItemCard({
  item,
  isDark,
}: {
  item: DcgdContentItem;
  isDark: boolean;
}) {
  const bg = isDark ? 'rgba(15,23,42,0.85)' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)';
  const titleColor = isDark ? '#F1F5F9' : '#0F172A';
  const hintColor = isDark ? '#94A3B8' : '#64748B';
  const bodyColor = isDark ? 'rgba(248,250,252,0.85)' : '#334155';

  const hasLink = !!item.link_url;
  const hasPdf = !!item.pdf_url;
  const hasText = !!item.content_body;
  const hasImage = !!item.image_url;

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor }]}>
      {/* Title */}
      <Text style={[styles.cardTitle, { color: titleColor }]}>
        {item.title}
      </Text>

      {/* Image */}
      {hasImage && (
        <Image
          source={{ uri: item.image_url! }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      )}

      {/* Text body */}
      {hasText && (
        <View style={[styles.textSection, {
          backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)',
          borderColor: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)',
        }]}>
          <Ionicons name="reader-outline" size={16} color="#8B5CF6" style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={[styles.textBody, { color: bodyColor }]}>
            {item.content_body}
          </Text>
        </View>
      )}

      {/* Action buttons for link & pdf */}
      {(hasLink || hasPdf) && (
        <View style={styles.actionRow}>
          {hasLink && (
            <Pressable
              onPress={() => Linking.openURL(item.link_url!)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                  borderColor: isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.18)',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="link-outline" size={18} color="#3B82F6" />
              <Text style={styles.linkBtnText} numberOfLines={1}>
                Open link
              </Text>
              <Ionicons name="open-outline" size={14} color="#3B82F6" />
            </Pressable>
          )}

          {hasPdf && (
            <Pressable
              onPress={() => Linking.openURL(item.pdf_url!)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                  borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.18)',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="document-text-outline" size={18} color="#EF4444" />
              <Text style={styles.pdfBtnText} numberOfLines={1}>
                View PDF
              </Text>
              <Ionicons name="download-outline" size={14} color="#EF4444" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────── */
const DCGDProgramScreen = () => {
  const { isDark } = useTheme();
  const { width: winW } = useWindowDimensions();
  const padH = winW >= 900 ? 32 : 18;
  const innerW = Math.min(CONTENT_MAX_W, winW - padH * 2);

  const params = useLocalSearchParams<{
    id: string;
    name: string;
    icon: string;
    description: string;
  }>();

  const programId = parseInt(params.id || '0', 10);
  const programName = params.name || 'Program';
  const programIcon = params.icon || 'ribbon-outline';
  const programDesc = params.description || '';

  const [payload, setPayload] = useState<DcgdProgramContentPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isFinite(programId) || programId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchProgramContent(programId);
    setPayload(data);
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  const content = useMemo(() => {
    if (!payload?.content?.length) return [];
    return [...payload.content].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  }, [payload]);

  const iconName = resolveIonIcon(programIcon);
  const accent = '#0D9488';

  return (
    <ScreenLayout>
      <StudentHeader showBackButton title={programName} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: padH, paddingBottom: 40 }]}
      >
        <View style={[styles.centerColumn, { maxWidth: innerW, width: '100%', alignSelf: 'center' }]}>
          {/* Hero */}
          <LinearGradient
            colors={isDark ? ['#134E4A', '#0F172A', '#020617'] : ['#0D9488', '#14B8A6', '#5EEAD4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIconRow}>
              <View style={styles.heroIconWrap}>
                <Ionicons name={iconName} size={32} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.heroTitle}>{programName}</Text>
            {programDesc ? (
              <Text style={styles.heroSubtitle}>{programDesc}</Text>
            ) : null}
          </LinearGradient>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={accent} />
            </View>
          ) : content.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: isDark ? 'rgba(15,23,42,0.8)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(13,148,136,0.15)',
                },
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={44}
                color={isDark ? '#475569' : '#94A3B8'}
                style={{ marginBottom: 12 }}
              />
              <Text style={[styles.emptyTitle, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>
                No content available yet
              </Text>
              <Text style={[styles.emptyHint, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Your school's Super Admin will add learning materials here soon. Check back later!
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Learning materials
                </Text>
                <Text style={[styles.sectionHint, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {content.length} item{content.length !== 1 ? 's' : ''} available
                </Text>
              </View>

              {content.map((item) => (
                <ContentItemCard key={item.id} item={item} isDark={isDark} />
              ))}
            </>
          )}

          <Text style={[styles.footerNote, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            Content is managed by Nexsyrus Pvt Ltd and your school Super Admin console.
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
};

export default DCGDProgramScreen;

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
  },
  centerColumn: {},
  hero: {
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 22,
    ...Platform.select({
      web: { boxShadow: '0 18px 50px rgba(13,148,136,0.25)' },
      default: {
        shadowColor: '#0D9488',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  heroIconRow: { marginBottom: 14 },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    maxWidth: 520,
  },
  loader: { paddingVertical: 32, alignItems: 'center' },
  emptyCard: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 10px 32px rgba(15,23,42,0.06)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
    }),
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyHint: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320, fontWeight: '500' },
  sectionHead: { marginTop: 24, marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionHint: { marginTop: 4, fontSize: 13, fontWeight: '500' },

  /* ── Content card ──────────────────────────────── */
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      web: { boxShadow: '0 8px 28px rgba(15,23,42,0.06)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  textSection: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  textBody: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
    minWidth: 130,
  },
  linkBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  pdfBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  footerNote: {
    marginTop: 28,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
});
