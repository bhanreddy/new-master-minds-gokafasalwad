import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Pressable, Platform, Dimensions } from 'react-native';
import Animated, {
  FadeInLeft, FadeOutLeft, SlideInLeft, SlideOutLeft, FadeIn, FadeOut,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation, interpolateColor
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { SCHOOL_NAME } from '../constants/school';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';

export interface MenuActionItem {
  title: string;
  description?: string;
  icon: any;
  route: string;
  gradient?: [string, string];
}

interface DashboardMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoute: string | null;
  items: MenuActionItem[];
  onItemPress: (route: string) => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DashboardMenuOverlay({
  isOpen, onClose, activeRoute: propActiveRoute, items, onItemPress
}: DashboardMenuOverlayProps) {
  const { theme, isDark } = useTheme();
  const pathname = usePathname();
  const activeRoute = propActiveRoute || pathname;
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

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
        {/* Dark Backdrop */}
        <AnimatedBlurView
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          tint="dark"
          intensity={60}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </AnimatedBlurView>

        {/* Side Drawer Wrapper to properly animate */}
        <Animated.View
          entering={SlideInLeft.duration(350).withCallback(() => {})}
          exiting={SlideOutLeft.duration(250)}
          style={[styles.drawerContainer]}
        >
          {/* Glass Drawer Surface */}
          <BlurView
            tint={isDark ? "dark" : "light"}
            intensity={isDark ? 85 : 95}
            style={[
              StyleSheet.absoluteFill,
              styles.drawerSurface,
              { backgroundColor: isDark ? 'rgba(8, 10, 15, 0.85)' : 'rgba(255, 255, 255, 0.92)' }
            ]}
          />

          <View style={styles.drawerInner}>
            <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={styles.headerTextWrap}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.logoOrb}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="school" size={22} color="#FFFFFF" />
                </LinearGradient>
                <View>
                  <Text style={[styles.appName, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                    {SCHOOL_NAME || 'SchoolIMS'}
                  </Text>
                  <Text style={styles.appSubtitle}>Admin Workspace</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
              >
                <Ionicons name="close" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={items}
              keyExtractor={(item) => item.route}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => {
                // Match prefix if necessary, but exact match is usually better for highlighting current page
                const isActive = activeRoute === item.route;
                return (
                  <MenuItem
                    item={item}
                    isActive={isActive}
                    isDark={isDark}
                    styles={styles}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onItemPress(item.route);
                    }}
                    index={index}
                  />
                );
              }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuItem({ item, isActive, isDark, onPress, index, styles }: any) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({ 
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      glow.value,
      [0, 1],
      ['rgba(255,255,255,0)', isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)']
    )
  }));

  const gradient = item.gradient || ['#6366F1', '#4F46E5'];
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const mutedTextColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)';

  return (
    <Animated.View entering={FadeInLeft.delay(index * 15).duration(300)}>
      <Pressable
        onPressIn={() => { 
          scale.value = withSpring(0.98, { damping: 15 }); 
          glow.value = withTiming(1, { duration: 150 });
        }}
        onPressOut={() => { 
          scale.value = withSpring(1); 
          glow.value = withTiming(0, { duration: 250 });
        }}
        onPress={onPress}
      >
        <Animated.View
          style={[
            styles.menuItem,
            animStyle,
            isActive && styles.menuItemActive
          ]}
        >
          {isActive && (
            <LinearGradient
              colors={gradient}
              style={styles.activeIndicator}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          )}
          
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color="#FFFFFF"
              style={styles.iconShadow}
            />
          </LinearGradient>

          <View style={styles.itemTextContent}>
            <Text style={[
              styles.itemTitle, 
              { color: textColor },
              isActive && { fontWeight: '800' }
            ]}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={[styles.itemSub, { color: mutedTextColor }]} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: -15, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 24,
  },
  drawerSurface: {
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  drawerInner: {
    flex: 1,
    overflow: 'hidden',
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 60 : 70,
    paddingBottom: 24,
    borderBottomWidth: 1,
  },
  headerTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoOrb: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  appName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
    paddingRight: 10,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 60,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginVertical: 4,
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  menuItemActive: {
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.05)',
    borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.25 : 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '25%',
    bottom: '25%',
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 16,
    opacity: 0.85,
  },
  iconWrapperActive: {
    opacity: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  itemTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
    opacity: 0.7,
  },
});
