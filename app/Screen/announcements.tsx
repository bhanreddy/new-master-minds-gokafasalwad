// OPT: Student notices — useStudentQuery for GET /notices + memoized row renderer (replaces useEffect + NoticeService direct fetch pattern).
import React, { useMemo, useCallback, memo } from 'react'; // OPT: Data from hook; memo/useCallback for list perf.
import { View, Text, StyleSheet, FlatList } from 'react-native'; // OPT: Layout + list.
import { Ionicons } from '@expo/vector-icons'; // OPT: Icons.
import { useTranslation } from 'react-i18next'; // OPT: i18n.
import ScreenLayout from '../../src/components/ScreenLayout'; // OPT: Page shell.
import StudentHeader from '../../src/components/StudentHeader'; // OPT: Header.
import type { Notice } from '../../src/services/commonServices'; // OPT: Row typing only — data comes from useStudentQuery('/notices').
import { useTheme } from '../../src/hooks/useTheme'; // OPT: Theme.
import type { SchoolTheme } from '../../src/hooks/useTheme'; // OPT: Align getStyles with useTheme() context shape.
import { t_field } from '../../src/utils/lang'; // OPT: Bilingual fields.
import LogoLoader from '../../src/components/LogoLoader'; // OPT: Loader.
import { useStudentQuery } from '../../src/hooks/useStudentQuery'; // OPT: Cached GET layer.
import { useAuth } from '../../src/hooks/useAuth'; // OPT: userId for cache partition keying in useStudentQuery.
import { ErrorBoundary } from '../../src/components/ErrorBoundary'; // OPT: Same boundary as Screen/_layout export target.

interface UINotice { // OPT: FlatList row model (UI-only shape).
  id: string; // OPT:
  title: string; // OPT:
  title_te?: string; // OPT:
  message: string; // OPT:
  message_te?: string; // OPT:
  date: string; // OPT:
  time: string; // OPT:
  important: boolean; // OPT:
  icon: string; // OPT:
  color: string; // OPT:
}

/** Newest publish/created time first so the latest alert stays at the top regardless of pin. */
const noticeSortKeyMs = (n: Notice): number =>
  new Date(n.published_at || n.publish_at || n.created_at).getTime();

const sortNoticesNewestFirst = (data: Notice[]): Notice[] =>
  [...data].sort((a, b) => noticeSortKeyMs(b) - noticeSortKeyMs(a));

const mapNoticesToUi = (data: Notice[]): UINotice[] => // OPT: Pure mapper extracted for useMemo.
  data.map((n: Notice) => ({
    id: n.id, // OPT:
    title: n.title, // OPT:
    title_te: n.title_te, // OPT:
    message: n.content, // OPT:
    message_te: n.content_te, // OPT:
    date: (n.published_at || n.created_at).split('T')[0], // OPT:
    time: 'All Day', // OPT:
    important: n.is_pinned, // OPT:
    icon: 'notifications', // OPT:
    color: '#3b82f6', // OPT:
  })); // OPT:

const NoticeTimelineRow = memo(function NoticeTimelineRow({ // OPT: Pure timeline row — memoized.
  item, // OPT: One UI notice.
  styles, // OPT: Themed styles.
  onMessagePress, // OPT: Parent useCallback for Text onPress.
}: {
  item: UINotice; // OPT:
  styles: ReturnType<typeof getStyles>; // OPT:
  onMessagePress: () => void; // OPT: Stable handler from useCallback.
}) {
  const { t } = useTranslation(); // OPT: Subscribe so t_field + labels update on language change.
  return (
    <View style={styles.timelineItem}>
      <View style={styles.leftCol}>
        <Text style={styles.dateText}>{item.date}</Text>
        <Text style={styles.timeText}>{item.time}</Text>
        <View style={styles.verticalLine} />
      </View>
      <View style={[styles.dot, { backgroundColor: item.color }]} />
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t_field(item.title, item.title_te)}</Text>
          {item.important ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('announcements.important', 'Important')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.message} onPress={onMessagePress}>
          {t_field(item.message, item.message_te)}
        </Text>
        <Ionicons name={item.icon as 'notifications'} size={24} color={item.color + '40'} style={styles.bgIcon} />
      </View>
    </View>
  ); // OPT: memoized row subtree
});

function AnnouncementsScreenInner() { // OPT: Wrapped by ErrorBoundary in default export.
  const { theme } = useTheme(); // OPT: Theme.
  const styles = React.useMemo(() => getStyles(theme), [theme]); // OPT: Stylesheet memo.
  const { t } = useTranslation(); // OPT: i18n.
  const { user } = useAuth(); // OPT: userId for hook partition in useStudentQuery.

  const { data: noticePayload, loading } = useStudentQuery<Notice[]>( // OPT: Network-first notices list with TTL.
    '/notices', // OPT: Backend notices collection route.
    'notices:students', // OPT: Cache bucket for this screen.
    2 * 60 * 1000, // OPT: 2m TTL — aligns with “semi-static” school comms.
    user?.userId, // OPT: Per-login cache partition.
    { enabled: true, query: { audience: 'students' } } // OPT: Query param forwarded via useStudentQuery options.
  );

  const notices = useMemo(
    () => mapNoticesToUi(sortNoticesNewestFirst(noticePayload ?? [])),
    [noticePayload]
  ); // OPT: Derive UI rows — sorted so latest is always first (matches API + resilient to cache order).

  const noopMessagePress = useCallback(() => {}, []); // OPT: Stable press handler until navigation is wired.

  const renderItem = useCallback( // OPT: Stable FlatList renderItem.
    ({ item }: { item: UINotice }) => <NoticeTimelineRow item={item} styles={styles} onMessagePress={noopMessagePress} />, // OPT: Delegate to memo row.
    [styles, noopMessagePress] // OPT: Recreate when styles or handlers change.
  );

  const keyExtractor = useCallback((item: UINotice) => item.id, []); // OPT: Stable key extractor.

  const listProps = useMemo( // OPT: FlatList perf tuning object stable across renders.
    () => ({
      initialNumToRender: 10, // OPT:
      maxToRenderPerBatch: 10, // OPT:
      windowSize: 5, // OPT:
      removeClippedSubviews: true as const, // OPT:
    }),
    [] // OPT: Static tuning.
  );

  const emptyList = useCallback( // OPT: Stable empty component.
    () => <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>No announcements.</Text>, // OPT:
    [] // OPT:
  );

  return ( // OPT: Screen chrome + conditional list vs loader.
    <ScreenLayout> {/* OPT: */}
      <StudentHeader showBackButton={true} title={t('announcements.title', 'Announcements')} /> {/* OPT: */}
      <View style={styles.container}> {/* OPT: */}
        <View style={styles.headerSection}> {/* OPT: */}
          <View style={styles.iconBox}> {/* OPT: */}
            <Ionicons name="notifications" size={24} color="#4f46e5" /> {/* OPT: */}
          </View> {/* OPT: */}
          <View> {/* OPT: */}
            <Text style={styles.pageTitle}>{t('announcements.title', 'Notice Board')}</Text> {/* OPT: */}
            <Text style={styles.subtitle}>{t('announcements.subtitle', 'Latest updates and events')}</Text> {/* OPT: */}
          </View> {/* OPT: */}
        </View> {/* OPT: */}
        {loading ? ( // OPT: First paint while hook resolves cache/network.
          <LogoLoader size={60} color="#4f46e5" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={notices}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            {...listProps}
            ListEmptyComponent={emptyList}
          />
        )}
      </View> {/* OPT: main column */}
    </ScreenLayout>
  ); // OPT:
}

export default function AnnouncementsScreen() { // OPT: Root export wraps inner content with ErrorBoundary.
  return ( // OPT:
    <ErrorBoundary> {/* OPT: Same boundary pattern as Screen/_layout */}
      <AnnouncementsScreenInner /> {/* OPT: */}
    </ErrorBoundary>
  ); // OPT: boundary-wrapped export default
}

const getStyles = (theme: SchoolTheme) => {
  const c = theme.colors;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    headerSection: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      backgroundColor: c.background,
      borderBottomWidth: 1,
      borderColor: c.borderLight,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#e0e7ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    pageTitle: { fontSize: 20, fontWeight: '800', color: c.textStrong },
    subtitle: { fontSize: 13, color: c.textSecondary },
    listContainer: { padding: 20 },
    timelineItem: { flexDirection: 'row', marginBottom: 24 },
    leftCol: { width: 60, alignItems: 'flex-end', marginRight: 10, position: 'relative' },
    dateText: { fontSize: 13, fontWeight: '700', color: c.textPrimary },
    timeText: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    verticalLine: { position: 'absolute', right: -16, top: 24, bottom: -40, width: 2, backgroundColor: c.border },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginTop: 6,
      marginRight: 10,
      zIndex: 1,
      borderWidth: 2,
      borderColor: c.background,
      elevation: 2,
    },
    card: {
      flex: 1,
      backgroundColor: c.background,
      borderRadius: 16,
      padding: 14,
      elevation: 2,
      shadowColor: c.textPrimary,
      shadowOpacity: 0.05,
      shadowRadius: 8,
      borderWidth: 1,
      borderColor: c.borderLight,
      position: 'relative',
      overflow: 'hidden',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.textStrong, flex: 1, marginRight: 8 },
    badge: { backgroundColor: '#fecaca', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#dc2626' },
    message: { fontSize: 14, color: c.textPrimary, lineHeight: 20 },
    bgIcon: { position: 'absolute', right: -5, bottom: -5, transform: [{ scale: 2 }], opacity: 0.1 },
  });
};
