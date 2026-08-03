import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { SCHOOL_NAME } from '../constants/school';
import * as Haptics from '../utils/haptics';
import { usePathname } from 'expo-router';

export interface MenuActionItem {
  title: string;
  description?: string;
  icon: any;
  route: string;
  gradient?: [string, string];
  category?: string;
  badge?: number;
}

interface DashboardMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoute: string | null;
  items: MenuActionItem[];
  onItemPress: (route: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_ORDER = [
  'Overview',
  'Academic',
  'Students',
  'Finance',
  'Analytics',
  'AI',
  'Comms',
  'Support',
  'Ops',
  'HR',
  'Security',
] as const;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type CategoryMeta = {
  icon: IconName;
  accent: string;
  accentDeep: string;
  soft: string;
  softDark: string;
  label: string;
  gradient: [string, string];
};

const CATEGORY_META: Record<string, CategoryMeta> = {
  Overview: {
    icon: 'grid-outline',
    accent: '#3B82F6',
    accentDeep: '#1D4ED8',
    soft: 'rgba(59,130,246,0.12)',
    softDark: 'rgba(59,130,246,0.18)',
    label: 'Overview',
    gradient: ['#60A5FA', '#2563EB'],
  },
  Academic: {
    icon: 'school-outline',
    accent: '#3B82F6',
    accentDeep: '#1D4ED8',
    soft: 'rgba(59,130,246,0.12)',
    softDark: 'rgba(59,130,246,0.18)',
    label: 'Academic',
    gradient: ['#60A5FA', '#2563EB'],
  },
  Students: {
    icon: 'people-outline',
    accent: '#14B8A6',
    accentDeep: '#0F766E',
    soft: 'rgba(20,184,166,0.12)',
    softDark: 'rgba(20,184,166,0.18)',
    label: 'Students',
    gradient: ['#2DD4BF', '#0F766E'],
  },
  Finance: {
    icon: 'wallet-outline',
    accent: '#14B8A6',
    accentDeep: '#0F766E',
    soft: 'rgba(20,184,166,0.12)',
    softDark: 'rgba(20,184,166,0.18)',
    label: 'Finance',
    gradient: ['#2DD4BF', '#0D9488'],
  },
  Analytics: {
    icon: 'bar-chart-outline',
    accent: '#38BDF8',
    accentDeep: '#0284C7',
    soft: 'rgba(56,189,248,0.12)',
    softDark: 'rgba(56,189,248,0.18)',
    label: 'Analytics',
    gradient: ['#7DD3FC', '#0EA5E9'],
  },
  AI: {
    icon: 'bulb-outline',
    accent: '#22D3EE',
    accentDeep: '#0891B2',
    soft: 'rgba(34,211,238,0.12)',
    softDark: 'rgba(34,211,238,0.18)',
    label: 'Insights',
    gradient: ['#67E8F9', '#06B6D4'],
  },
  Comms: {
    icon: 'megaphone-outline',
    accent: '#FB923C',
    accentDeep: '#C2410C',
    soft: 'rgba(251,146,60,0.14)',
    softDark: 'rgba(251,146,60,0.18)',
    label: 'Comms',
    gradient: ['#FDBA74', '#EA580C'],
  },
  Support: {
    icon: 'chatbubble-ellipses-outline',
    accent: '#FB7185',
    accentDeep: '#E11D48',
    soft: 'rgba(251,113,133,0.14)',
    softDark: 'rgba(251,113,133,0.18)',
    label: 'Support',
    gradient: ['#FDA4AF', '#F43F5E'],
  },
  Ops: {
    icon: 'bus-outline',
    accent: '#FBBF24',
    accentDeep: '#B45309',
    soft: 'rgba(251,191,36,0.16)',
    softDark: 'rgba(251,191,36,0.18)',
    label: 'Operations',
    gradient: ['#FCD34D', '#D97706'],
  },
  HR: {
    icon: 'people-outline',
    accent: '#F472B6',
    accentDeep: '#BE185D',
    soft: 'rgba(244,114,182,0.14)',
    softDark: 'rgba(244,114,182,0.18)',
    label: 'People',
    gradient: ['#F9A8D4', '#DB2777'],
  },
  Security: {
    icon: 'shield-checkmark-outline',
    accent: '#F87171',
    accentDeep: '#B91C1C',
    soft: 'rgba(248,113,113,0.14)',
    softDark: 'rgba(248,113,113,0.18)',
    label: 'Security',
    gradient: ['#FCA5A5', '#DC2626'],
  },
};

function getCategoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_META[category] ?? {
      icon: 'grid-outline' as IconName,
      accent: '#3B82F6',
      accentDeep: '#1D4ED8',
      soft: 'rgba(59,130,246,0.12)',
      softDark: 'rgba(59,130,246,0.18)',
      label: category,
      gradient: ['#60A5FA', '#2563EB'],
    }
  );
}

function routeIsActive(pathname: string, itemRoute: string): boolean {
  if (pathname === itemRoute) return true;
  if (itemRoute === '/admin' || itemRoute === '/admin/dashboard') return false;
  return pathname.startsWith(`${itemRoute}/`);
}

function MobileSubItem({
  item,
  isActive,
  isDark,
  meta,
  styles,
  onPress,
}: {
  item: MenuActionItem;
  isActive: boolean;
  isDark: boolean;
  meta: CategoryMeta;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const showBadge = item.badge !== undefined && item.badge > 0;
  const [g0, g1] = item.gradient?.length === 2 ? item.gradient : meta.gradient;

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 16 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={onPress}
    >
      <Animated.View style={[styles.subItem, animStyle, isActive && styles.subItemActiveShell]}>
        {isActive ? (
          <LinearGradient
            colors={[g0, g1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 13 }]}
            pointerEvents="none"
          />
        ) : null}

        <View
          style={[
            styles.subIcon,
            {
              backgroundColor: isActive
                ? 'rgba(255,255,255,0.22)'
                : isDark
                  ? meta.softDark
                  : meta.soft,
              borderColor: isActive
                ? 'rgba(255,255,255,0.28)'
                : isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(255,255,255,0.7)',
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={15}
            color={isActive ? '#FFFFFF' : meta.accentDeep}
          />
        </View>

        <Text
          style={[
            styles.subTitle,
            {
              color: isActive
                ? '#FFFFFF'
                : isDark
                  ? 'rgba(248,250,252,0.88)'
                  : 'rgba(15,23,42,0.8)',
            },
            isActive && { fontWeight: '700' },
          ]}
          numberOfLines={1}
        >
          {item.title}
        </Text>

        {showBadge ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isActive
                  ? 'rgba(255,255,255,0.24)'
                  : meta.accentDeep,
              },
            ]}
          >
            <Text style={styles.badgeText}>{item.badge! > 99 ? '99+' : item.badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function MobileCategorySection({
  category,
  items,
  expanded,
  onToggle,
  isDark,
  activeRoute,
  onItemPress,
  styles,
}: {
  category: string;
  items: MenuActionItem[];
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
  activeRoute: string;
  onItemPress: (route: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const meta = getCategoryMeta(category);
  const hasActive = items.some((it) => routeIsActive(activeRoute, it.route));
  const badgeTotal = items.reduce((sum, it) => sum + (it.badge && it.badge > 0 ? it.badge : 0), 0);
  const chevron = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    chevron.value = withTiming(expanded ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, chevron]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevron.value * 90}deg` }],
  }));

  return (
    <View
      style={[
        styles.categoryWrap,
        expanded && {
          backgroundColor: isDark ? meta.softDark : meta.soft,
          borderColor: isDark ? `${meta.accent}44` : `${meta.accent}33`,
        },
        !expanded &&
          hasActive && {
            borderColor: isDark ? `${meta.accent}40` : `${meta.accent}28`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
          },
      ]}
    >
      <Pressable
        onPress={onToggle}
        style={styles.categoryHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <LinearGradient
          colors={meta.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.categoryOrb}
        >
          <Ionicons name={meta.icon} size={16} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.categoryTextCol}>
          <Text
            style={[
              styles.categoryTitle,
              {
                color:
                  expanded || hasActive
                    ? isDark
                      ? '#F8FAFC'
                      : '#0F172A'
                    : isDark
                      ? 'rgba(248,250,252,0.55)'
                      : 'rgba(15,23,42,0.48)',
              },
            ]}
            numberOfLines={1}
          >
            {meta.label}
          </Text>
          {expanded ? (
            <Text style={[styles.categoryHint, { color: meta.accentDeep }]}>
              {items.length} modules
            </Text>
          ) : null}
        </View>

        {badgeTotal > 0 ? (
          <View style={[styles.badge, { backgroundColor: meta.accentDeep }]}>
            <Text style={styles.badgeText}>{badgeTotal > 99 ? '99+' : badgeTotal}</Text>
          </View>
        ) : (
          <View
            style={[
              styles.countPill,
              expanded && {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)',
                borderColor: `${meta.accent}33`,
              },
            ]}
          >
            <Text style={[styles.countText, expanded && { color: meta.accentDeep }]}>
              {items.length}
            </Text>
          </View>
        )}

        <Animated.View style={chevronStyle}>
          <Ionicons
            name="chevron-forward"
            size={15}
            color={
              expanded
                ? meta.accentDeep
                : isDark
                  ? 'rgba(255,255,255,0.3)'
                  : 'rgba(15,23,42,0.28)'
            }
          />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <Animated.View entering={FadeInDown.duration(200).springify().damping(18)} style={styles.subList}>
          {items.map((item) => (
            <MobileSubItem
              key={item.route}
              item={item}
              isActive={routeIsActive(activeRoute, item.route)}
              isDark={isDark}
              meta={meta}
              styles={styles}
              onPress={() => {
                Haptics.selectionAsync();
                onItemPress(item.route);
              }}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function DashboardMenuOverlay({
  isOpen,
  onClose,
  activeRoute: propActiveRoute,
  items,
  onItemPress,
}: DashboardMenuOverlayProps) {
  const { theme, isDark } = useTheme();
  const pathname = usePathname();
  const { width: windowWidth } = useWindowDimensions();
  const activeRoute = propActiveRoute || pathname;
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, MenuActionItem[]>();
    items.forEach((item) => {
      const key = item.category || 'Academic';
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    });

    const ordered: Array<{ key: string; items: MenuActionItem[] }> = CATEGORY_ORDER.filter((key) => buckets.has(key)).map((key) => ({
      key,
      items: buckets.get(key)!,
    }));

    buckets.forEach((list, key) => {
      if (!CATEGORY_ORDER.includes(key as (typeof CATEGORY_ORDER)[number])) {
        ordered.push({ key, items: list });
      }
    });

    return ordered;
  }, [items]);

  const activeCategory = useMemo(() => {
    for (const group of grouped) {
      if (group.items.some((it) => routeIsActive(activeRoute, it.route))) return group.key;
    }
    return grouped[0]?.key ?? 'Academic';
  }, [grouped, activeRoute]);

  const [openKey, setOpenKey] = useState<string | null>(activeCategory);
  const lastAuto = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (lastAuto.current === activeCategory) return;
    lastAuto.current = activeCategory;
    setOpenKey(activeCategory);
  }, [activeCategory, isOpen]);

  const toggleCategory = useCallback((key: string) => {
    Haptics.selectionAsync();
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  if (Platform.OS === 'web' && windowWidth >= 768) return null;
  if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(220)}
          style={StyleSheet.absoluteFill}
        >
          <BlurView tint="dark" intensity={64} style={StyleSheet.absoluteFill}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          </BlurView>
        </Animated.View>

        <Animated.View
          entering={SlideInLeft.duration(340)}
          exiting={SlideOutLeft.duration(240)}
          style={styles.drawerContainer}
        >
          <LinearGradient
            colors={isDark ? ['#070B14', '#0F172A'] : ['#E8EEF8', '#F3F6FC']}
            style={StyleSheet.absoluteFill}
          />
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={isDark ? 40 : 50}
            style={[
              StyleSheet.absoluteFill,
              styles.drawerSurface,
              { backgroundColor: isDark ? 'rgba(8,12,20,0.55)' : 'rgba(255,255,255,0.35)' },
            ]}
          />

          <View style={styles.drawerInner}>
            <View style={styles.header}>
              <LinearGradient
                colors={['#1E40AF', '#2563EB', '#0D9488']}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.brandPill}
              >
                <View style={styles.logoOrb}>
                  <Ionicons name="school" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.appName} numberOfLines={1}>
                    {SCHOOL_NAME || 'SchoolIMS'}
                  </Text>
                  <View style={styles.brandSubRow}>
                    <View style={styles.brandLiveDot} />
                    <Text style={styles.appSubtitle}>Admin Console</Text>
                  </View>
                </View>
              </LinearGradient>

              <Pressable
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' },
                ]}
              >
                <Ionicons name="close" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
              <View style={styles.sectionHead}>
                <Text
                  style={[
                    styles.sectionHeadLabel,
                    { color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.4)' },
                  ]}
                >
                  Workspace
                </Text>
                <View
                  style={[
                    styles.sectionHeadLine,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(15,23,42,0.08)',
                    },
                  ]}
                />
              </View>

              <View style={styles.categoriesStack}>
                {grouped.map((group) => (
                  <MobileCategorySection
                    key={group.key}
                    category={group.key}
                    items={group.items}
                    expanded={openKey === group.key}
                    onToggle={() => toggleCategory(group.key)}
                    isDark={isDark}
                    activeRoute={activeRoute}
                    onItemPress={onItemPress}
                    styles={styles}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (_theme: any, isDark: boolean) =>
  StyleSheet.create({
    drawerContainer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: Math.min(SCREEN_WIDTH * 0.9, 390),
      shadowColor: '#000',
      shadowOffset: { width: -12, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 28,
      elevation: 26,
      overflow: 'hidden',
      borderTopRightRadius: 28,
      borderBottomRightRadius: 28,
    },
    drawerSurface: {
      borderTopRightRadius: 28,
      borderBottomRightRadius: 28,
      overflow: 'hidden',
    },
    drawerInner: {
      flex: 1,
      overflow: 'hidden',
      borderTopRightRadius: 28,
      borderBottomRightRadius: 28,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: Platform.OS === 'android' ? 52 : 60,
      paddingBottom: 12,
      gap: 10,
    },
    brandPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 11,
      paddingHorizontal: 12,
      gap: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    logoOrb: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
    },
    appName: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: '#FFFFFF',
      paddingRight: 4,
    },
    brandSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    brandLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#5EEAD4',
    },
    appSubtitle: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.78)',
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingTop: 6,
      paddingBottom: 48,
      paddingHorizontal: 12,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    sectionHeadLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    sectionHeadLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    categoriesStack: {
      gap: 9,
    },
    categoryWrap: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)',
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.7)',
      overflow: 'hidden',
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 11,
    },
    categoryOrb: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
    },
    categoryTextCol: {
      flex: 1,
      minWidth: 0,
    },
    categoryTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    categoryHint: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 1,
    },
    countPill: {
      minWidth: 24,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
    },
    countText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.4)',
    },
    subList: {
      paddingHorizontal: 10,
      paddingBottom: 12,
      gap: 6,
    },
    subItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 13,
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.65)',
      overflow: 'hidden',
      position: 'relative',
    },
    subItemActiveShell: {
      borderColor: 'rgba(255,255,255,0.25)',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 4,
    },
    subIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      zIndex: 1,
    },
    subTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.15,
      zIndex: 1,
    },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
  });
