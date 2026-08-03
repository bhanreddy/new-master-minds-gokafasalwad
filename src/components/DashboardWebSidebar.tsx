import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../hooks/useTheme';
import { SCHOOL_NAME } from '../constants/school';

export const DASHBOARD_SIDEBAR_EXPANDED = 272;
export const DASHBOARD_SIDEBAR_COLLAPSED = 74;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface WebSidebarActionItem {
  title: string;
  icon: IconName;
  route: string;
  gradient: [string, string];
  badge?: number;
  category?: string;
}

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

type CategoryKey = (typeof CATEGORY_ORDER)[number] | string;

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

function routeIsActive(pathname: string, itemRoute: string): boolean {
  if (pathname === itemRoute) return true;
  if (itemRoute === '/admin' || itemRoute === '/admin/dashboard') return false;
  return pathname.startsWith(`${itemRoute}/`);
}

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

interface DashboardWebSidebarProps {
  collapsed: boolean;
  items: WebSidebarActionItem[];
}

function SubItem({
  item,
  collapsed,
  active,
  isDark,
  meta,
  onNavigate,
  styles,
}: {
  item: WebSidebarActionItem;
  collapsed: boolean;
  active: boolean;
  isDark: boolean;
  meta: CategoryMeta;
  onNavigate: (route: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, setHovered] = useState(false);
  const showBadge = item.badge !== undefined && item.badge > 0;
  const [g0, g1] = item.gradient?.length === 2 ? item.gradient : meta.gradient;

  return (
    <Pressable
      onPress={() => onNavigate(item.route)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[Platform.OS === 'web' && { cursor: 'pointer' }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View
        style={[
          styles.subItem,
          collapsed && styles.subItemCollapsed,
          active && styles.subItemActiveShell,
          !active &&
            hovered && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
              transform: [{ translateX: 2 }],
            },
          !active &&
            !hovered && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.55)',
            },
        ]}
      >
        {active ? (
          <LinearGradient
            colors={[g0, g1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
            pointerEvents="none"
          />
        ) : null}

        <View
          style={[
            styles.subIcon,
            collapsed && styles.subIconCollapsed,
            active
              ? {
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  borderColor: 'rgba(255,255,255,0.28)',
                }
              : {
                  backgroundColor: isDark ? meta.softDark : meta.soft,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
                },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={collapsed ? 17 : 14}
            color={active ? '#FFFFFF' : meta.accentDeep}
          />
          {collapsed && showBadge ? <View style={styles.badgeDot} /> : null}
        </View>

        {!collapsed ? (
          <Text style={[styles.subTitle, active && styles.subTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
        ) : null}

        {!collapsed && showBadge ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: active
                  ? 'rgba(255,255,255,0.24)'
                  : isDark
                    ? 'rgba(255,255,255,0.12)'
                    : meta.accentDeep,
              },
            ]}
          >
            <Text style={styles.badgeText}>{item.badge! > 99 ? '99+' : item.badge}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function CategorySection({
  category,
  items,
  expanded,
  onToggle,
  collapsed,
  isDark,
  pathname,
  onNavigate,
  styles,
}: {
  category: CategoryKey;
  items: WebSidebarActionItem[];
  expanded: boolean;
  onToggle: () => void;
  collapsed: boolean;
  isDark: boolean;
  pathname: string;
  onNavigate: (route: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const meta = getCategoryMeta(String(category));
  const hasActive = items.some((it) => routeIsActive(pathname, it.route));
  const badgeTotal = items.reduce((sum, it) => sum + (it.badge && it.badge > 0 ? it.badge : 0), 0);
  const [headerHovered, setHeaderHovered] = useState(false);
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

  if (collapsed) {
    return (
      <View style={styles.collapsedGroup}>
        {items.map((item) => (
          <SubItem
            key={item.route}
            item={item}
            collapsed
            active={routeIsActive(pathname, item.route)}
            isDark={isDark}
            meta={meta}
            onNavigate={onNavigate}
            styles={styles}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.categoryWrap,
        expanded && {
          backgroundColor: isDark ? meta.softDark : meta.soft,
          borderColor: isDark ? `${meta.accent}44` : `${meta.accent}33`,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: `0 10px 28px ${meta.accent}18, inset 0 1px 0 rgba(255,255,255,0.55)`,
              } as any)
            : {}),
        },
        !expanded && hasActive && {
          borderColor: isDark ? `${meta.accent}40` : `${meta.accent}28`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)',
        },
      ]}
    >
      <Pressable
        onPress={onToggle}
        onHoverIn={() => setHeaderHovered(true)}
        onHoverOut={() => setHeaderHovered(false)}
        style={[
          styles.categoryHeader,
          !expanded &&
            headerHovered && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
            },
          Platform.OS === 'web' && { cursor: 'pointer' },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <LinearGradient
          colors={meta.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.categoryOrb,
            Platform.OS === 'web' &&
              ({
                boxShadow: `0 6px 14px ${meta.accent}44, inset 0 1px 0 rgba(255,255,255,0.35)`,
              } as any),
          ]}
        >
          <Ionicons name={meta.icon} size={15} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.categoryTextCol}>
          <Text
            style={[
              styles.categoryTitle,
              (expanded || hasActive) && { color: isDark ? '#F8FAFC' : '#0F172A' },
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

        <Animated.View style={[styles.chevronWrap, chevronStyle]}>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={expanded ? meta.accentDeep : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.3)'}
          />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <Animated.View entering={FadeInDown.duration(200).springify().damping(18)} style={styles.subList}>
          {items.map((item) => (
            <SubItem
              key={item.route}
              item={item}
              collapsed={false}
              active={routeIsActive(pathname, item.route)}
              isDark={isDark}
              meta={meta}
              onNavigate={onNavigate}
              styles={styles}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function DashboardWebSidebar({ collapsed, items }: DashboardWebSidebarProps) {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const width = collapsed ? DASHBOARD_SIDEBAR_COLLAPSED : DASHBOARD_SIDEBAR_EXPANDED;
  const styles = useMemo(() => createStyles(isDark, collapsed), [isDark, collapsed]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, WebSidebarActionItem[]>();
    items.forEach((item) => {
      const key = item.category || 'Academic';
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    });

    const ordered: Array<{ key: string; items: WebSidebarActionItem[] }> = CATEGORY_ORDER.filter((key) => buckets.has(key)).map((key) => ({
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
      if (group.items.some((it) => routeIsActive(pathname, it.route))) return group.key;
    }
    return grouped[0]?.key ?? 'Academic';
  }, [grouped, pathname]);

  const [openKey, setOpenKey] = useState<string | null>(activeCategory);
  const lastAuto = useRef<string | null>(null);

  useEffect(() => {
    if (lastAuto.current === activeCategory) return;
    lastAuto.current = activeCategory;
    setOpenKey(activeCategory);
  }, [activeCategory]);

  const onNavigate = useCallback(
    (route: string) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(route as any);
      } catch (e) {
        console.error('Button action failed:', e);
      }
    },
    [router],
  );

  const toggleCategory = useCallback((key: string) => {
    Haptics.selectionAsync();
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  return (
    <View style={[styles.shell, { width }]}>
      <LinearGradient
        colors={isDark ? ['#070B14', '#0F172A', '#111827'] : ['#E8EEF8', '#F3F6FC', '#EEF2F9']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {Platform.OS === 'web' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundImage: isDark
                ? 'radial-gradient(80% 45% at 10% 0%, rgba(59,130,246,0.22) 0%, transparent 55%), radial-gradient(70% 40% at 100% 100%, rgba(20,184,166,0.12) 0%, transparent 50%)'
                : 'radial-gradient(90% 50% at 0% 0%, rgba(59,130,246,0.16) 0%, transparent 52%), radial-gradient(70% 40% at 100% 85%, rgba(20,184,166,0.10) 0%, transparent 48%), radial-gradient(50% 30% at 50% 100%, rgba(251,146,60,0.06) 0%, transparent 55%)',
            } as any,
          ]}
        />
      ) : null}

      <View style={[styles.topBrand, !collapsed && styles.topBrandExpanded]}>
        <LinearGradient
          colors={isDark ? ['#1E3A8A', '#1D4ED8', '#0F766E'] : ['#1E40AF', '#2563EB', '#0D9488']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandPill}
        >
          <View style={styles.brandSheen} pointerEvents="none" />
          <View style={styles.brandOrb}>
            <Ionicons name="school" size={collapsed ? 17 : 19} color="#FFFFFF" />
          </View>
          {!collapsed ? (
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandName} numberOfLines={1}>
                {SCHOOL_NAME || 'SchoolIMS'}
              </Text>
              <View style={styles.brandSubRow}>
                <View style={styles.brandLiveDot} />
                <Text style={styles.brandSub}>Admin Console</Text>
              </View>
            </View>
          ) : null}
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {!collapsed ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionHeadLabel}>Workspace</Text>
              <View style={styles.sectionHeadLine} />
            </View>
            <View style={styles.categoriesStack}>
              {grouped.map((group) => (
                <CategorySection
                  key={group.key}
                  category={group.key}
                  items={group.items}
                  expanded={openKey === group.key}
                  onToggle={() => toggleCategory(group.key)}
                  collapsed={false}
                  isDark={isDark}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  styles={styles}
                />
              ))}
            </View>
          </>
        ) : (
          grouped.map((group) => (
            <CategorySection
              key={group.key}
              category={group.key}
              items={group.items}
              expanded={false}
              onToggle={() => {}}
              collapsed
              isDark={isDark}
              pathname={pathname}
              onNavigate={onNavigate}
              styles={styles}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(isDark: boolean, collapsed: boolean) {
  const fgMuted = isDark ? 'rgba(248,250,252,0.45)' : 'rgba(15,23,42,0.42)';

  return StyleSheet.create({
    shell: {
      alignSelf: 'stretch',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      borderRightWidth: 1,
      borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.25)',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: isDark
              ? '4px 0 24px rgba(0,0,0,0.35)'
              : '4px 0 24px rgba(15,23,42,0.05)',
          } as any)
        : {}),
    },
    topBrand: {
      paddingHorizontal: collapsed ? 10 : 14,
      paddingTop: 16,
      paddingBottom: 8,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    topBrandExpanded: {
      alignItems: 'stretch',
    },
    brandPill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: collapsed ? 12 : 13,
      gap: 11,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 14px 32px rgba(29,78,216,0.32), 0 2px 0 rgba(255,255,255,0.2) inset',
          } as any)
        : {
            shadowColor: '#1D4ED8',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }),
    },
    brandSheen: {
      ...StyleSheet.absoluteFillObject,
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 38%, transparent 55%)',
          } as any)
        : { backgroundColor: 'rgba(255,255,255,0.08)' }),
    },
    brandOrb: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    brandTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    brandName: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    brandSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
    },
    brandLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#5EEAD4',
    },
    brandSub: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 1.3,
      color: 'rgba(255,255,255,0.78)',
      textTransform: 'uppercase',
    },
    scroll: { flex: 1, minHeight: 0, zIndex: 2 },
    scrollContent: {
      paddingHorizontal: collapsed ? 10 : 12,
      paddingBottom: 32,
      paddingTop: 6,
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
      letterSpacing: 1.8,
      color: fgMuted,
      textTransform: 'uppercase',
    },
    sectionHeadLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    categoriesStack: {
      gap: 8,
    },
    categoryWrap: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.62)',
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: isDark
              ? '0 6px 16px rgba(0,0,0,0.2)'
              : '0 6px 18px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
          } as any)
        : {
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }),
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 10,
      borderRadius: 16,
    },
    categoryOrb: {
      width: 32,
      height: 32,
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
      fontSize: 13,
      fontWeight: '700',
      color: fgMuted,
      letterSpacing: -0.2,
    },
    categoryHint: {
      fontSize: 10,
      fontWeight: '600',
      marginTop: 1,
      letterSpacing: 0.1,
    },
    countPill: {
      minWidth: 22,
      height: 20,
      paddingHorizontal: 7,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
    },
    countText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: fgMuted,
    },
    chevronWrap: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subList: {
      paddingHorizontal: 8,
      paddingBottom: 10,
      gap: 5,
    },
    subItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      minHeight: 38,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 9,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
      overflow: 'hidden',
      position: 'relative',
      ...(Platform.OS === 'web'
        ? ({
            transition: 'transform 140ms ease, background-color 140ms ease, box-shadow 160ms ease',
          } as any)
        : {}),
    },
    subItemCollapsed: {
      justifyContent: 'center',
      minHeight: 44,
      marginBottom: 5,
      paddingHorizontal: 0,
      borderRadius: 13,
    },
    subItemActiveShell: {
      borderColor: 'rgba(255,255,255,0.25)',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 8px 18px rgba(15,23,42,0.18)',
          } as any)
        : {
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.18,
            shadowRadius: 10,
            elevation: 4,
          }),
    },
    subIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      zIndex: 1,
    },
    subIconCollapsed: {
      width: 40,
      height: 40,
      borderRadius: 12,
    },
    subTitle: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '600',
      color: isDark ? 'rgba(248,250,252,0.82)' : 'rgba(15,23,42,0.78)',
      letterSpacing: -0.15,
      zIndex: 1,
    },
    subTitleActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    badge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
    badgeDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#FB7185',
      borderWidth: 1.5,
      borderColor: isDark ? '#070B14' : '#E8EEF8',
    },
    collapsedGroup: {
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
    },
  });
}
