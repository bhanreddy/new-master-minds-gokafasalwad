import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { SCHOOL_NAME } from "../src/constants/school";
import { SCHOOL_CONFIG, schoolColorWithAlpha } from "../src/constants/schoolConfig";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { AuthService } from "../src/services/authService";
import { isStudentRole } from "../src/utils/roleHelpers";

/* ─── Responsive layout constants ────────────────────────────────────────── */
/* BASE_W is the design reference width — every scalable dimension in this
   screen was designed against a 480pt canvas. At runtime we compute a scale
   factor from the live window width and multiply layout-critical dimensions
   by it, so the whole screen grows on tablets / web and shrinks gracefully
   on small phones instead of overflowing or leaving dead space. */
const BASE_W = 480;
const MIN_SCALE = 0.72; // small phones
const MAX_SCALE = 1.45; // large tablets / desktop web
const STUDENT_DOODLE_ASPECT = 434 / 575;

/* Base (unscaled) design values */
const GRID_GAP = 12;

/** Horizontal inset — scales with viewport so cards use available width on every device. */
const getPagePad = (winW: number): number => {
  if (winW >= 1200) return Math.round(winW * 0.06);
  if (winW >= 768) return Math.round(winW * 0.05);
  if (winW >= 480) return 24;
  return Math.max(16, Math.round(winW * 0.04));
};

/* Small hook that returns a scale function + resolved layout metrics.
   Re-computes live on browser resize / device rotation. */
const useResponsiveLayout = () => {
  const { width: winW } = useWindowDimensions();

  return useMemo(() => {
    const pagePad = getPagePad(winW);
    /* Cards span the full viewport minus side inset — no separate max-width cap
       that would leave tiles narrower than their parent (the previous bug). */
    const innerW = winW - pagePad * 2;
    const scale = Math.min(Math.max(innerW / BASE_W, MIN_SCALE), MAX_SCALE);
    const s = (n: number) => Math.round(n * scale);

    const gridGap = s(GRID_GAP);
    /* 2-up tiles on every real phone; only collapse to one column on
       ultra-narrow (<340pt) devices where two tiles become unreadable. */
    const gridColumns: 1 | 2 = winW < 340 ? 1 : 2;
    const glowSize = winW * 0.85;
    /* Below the small-tablet breakpoint, the student card switches to the
       compact treatment (doodle pinned to the corner, out of the flow). */
    const isMobile = winW < 520;

    return {
      winW,
      scale,
      s,
      pagePad,
      gridGap,
      innerW,
      gridColumns,
      glowSize,
      isMobile,
    };
  }, [winW]);
};

/* ─── Theme ──────────────────────────────────────────────────────────────── */
const useWelcomeTheme = () => {
  const { theme } = useTheme();
  const p = theme.colors.primary;
  const pD = theme.colors.primaryDark;
  const rgba = schoolColorWithAlpha;

  return {
    p,
    pD,
    glow: rgba(p, 0.1),
    glowSoft: rgba(p, 0.05),
    tint: rgba(p, 0.07),
    tintBorder: rgba(p, 0.14),

    ink: theme.colors.textStrong,
    inkB: theme.colors.textPrimary,
    inkC: theme.colors.textSecondary,
    inkD: theme.colors.textMuted,
  } as const;
};

/* ─── Hero orbit crest (central logo + satellite icons) ─────────────────── */
const polarXY = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const ORBIT_SATELLITES = [
  { angle: -52, phase: 0, colors: ["#A78BFA", "#7C3AED", "#6D28D9"] as const, icon: "school" as const },
  { angle: 42, phase: 2.09, colors: ["#60A5FA", "#3B82F6", "#1D4ED8"] as const, icon: "people" as const },
  { angle: 152, phase: 4.19, colors: ["#FB923C", "#F97316", "#EF4444"] as const, icon: "book" as const },
] as const;

const TILE_ENTER = FadeIn.duration(320);
const HERO_ENTER = FadeInDown.duration(450);
const CARD_ENTER = FadeInUp.duration(380);

const OrbitSatellite = memo(function OrbitSatellite({
  angle,
  colors,
  icon,
  orbitR,
  sat,
  cx,
  cy,
  iconSize,
  bobAmp,
  floatY,
  phase,
  motionEnabled,
}: {
  angle: number;
  colors: readonly [string, string, string];
  icon: keyof typeof Ionicons.glyphMap;
  orbitR: number;
  sat: number;
  cx: number;
  cy: number;
  iconSize: number;
  bobAmp: number;
  floatY: SharedValue<number>;
  phase: number;
  motionEnabled: boolean;
}) {
  const anim = useAnimatedStyle(() => ({
    transform: motionEnabled
      ? [{ translateY: Math.sin(floatY.value * Math.PI * 2 + phase) * bobAmp }]
      : [],
  }));

  const rad = (angle * Math.PI) / 180;
  const left = cx + orbitR * Math.cos(rad) - sat / 2;
  const top = cy + orbitR * Math.sin(rad) - sat / 2;

  return (
    <Animated.View
      style={[
        styles.orbitSatellite,
        anim,
        {
          width: sat,
          height: sat,
          borderRadius: sat / 2,
          left,
          top,
        },
      ]}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: sat / 2 }]}
      />
      <View
        pointerEvents="none"
        style={[styles.orbitSatelliteShine, { borderRadius: sat / 2 }]}
      />
      <View style={[styles.orbitSatelliteRing, { borderRadius: sat / 2 }]} pointerEvents="none" />
      <Ionicons name={icon} size={iconSize} color="#FFFFFF" />
    </Animated.View>
  );
});

const HeroOrbitCrest = memo(function HeroOrbitCrest({
  s,
  primary,
  glowSoft,
  motionEnabled,
}: {
  s: (n: number) => number;
  primary: string;
  glowSoft: string;
  motionEnabled: boolean;
}) {
  const stage = s(320);
  const hub = s(168);
  const sat = s(58);
  const orbitR = s(118);
  const cx = stage / 2;
  const cy = stage / 2;
  const iconSize = s(24);
  const bobAmp = s(5);
  const floatY = useSharedValue(0);
  const hubPulse = useSharedValue(1);

  useEffect(() => {
    if (!motionEnabled) {
      floatY.value = 0;
      hubPulse.value = 1;
      return;
    }
    floatY.value = withRepeat(
      withTiming(1, { duration: 4800, easing: Easing.linear }),
      -1,
      false,
    );
    hubPulse.value = withRepeat(
      withSequence(
        withTiming(1.01, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [floatY, hubPulse, motionEnabled]);

  const hubAnim = useAnimatedStyle(() => ({
    transform: motionEnabled ? [{ scale: hubPulse.value }] : [],
  }));

  const ringRadii = useMemo(
    () => [orbitR * 0.76, orbitR * 0.9, orbitR * 1.04, orbitR * 1.18],
    [orbitR],
  );
  const ringOpacities = [0.05, 0.09, 0.06, 0.04];
  const dotOnMidRing = useMemo(
    () => polarXY(cx, cy, ringRadii[1], 192),
    [cx, cy, ringRadii],
  );
  const orbitCirc = 2 * Math.PI * orbitR;
  const orbitArcLen = orbitCirc * 0.54;
  const dashGap = s(10);
  const dashLen = s(6);

  return (
    <View
      style={[styles.orbitStage, { width: stage, height: stage, marginBottom: s(16) }]}
      renderToHardwareTextureAndroid={motionEnabled}
      shouldRasterizeIOS={motionEnabled}
    >
      <View
        pointerEvents="none"
        style={[
          styles.orbitGlow,
          {
            width: stage * 0.92,
            height: stage * 0.92,
            borderRadius: stage * 0.46,
            left: (stage - stage * 0.92) / 2,
            top: (stage - stage * 0.92) / 2,
            backgroundColor: glowSoft,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.orbitGlowInner,
          {
            width: stage * 0.62,
            height: stage * 0.62,
            borderRadius: stage * 0.31,
            left: (stage - stage * 0.62) / 2,
            top: (stage - stage * 0.62) / 2,
            backgroundColor: schoolColorWithAlpha(primary, 0.08),
          },
        ]}
      />

      <Svg width={stage} height={stage} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgGradient id="heroOrbitGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#F97316" stopOpacity={0.9} />
            <Stop offset="50%" stopColor="#C084FC" stopOpacity={0.75} />
            <Stop offset="100%" stopColor="#7C3AED" stopOpacity={0.95} />
          </SvgGradient>
        </Defs>

        {ringRadii.map((r, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            stroke={schoolColorWithAlpha(primary, ringOpacities[i])}
            strokeWidth={i === 1 ? 1.25 : 1}
            strokeDasharray={i === 3 ? `${dashLen} ${dashGap}` : undefined}
            fill="none"
          />
        ))}

        <Circle
          cx={cx}
          cy={cy}
          r={orbitR}
          stroke="url(#heroOrbitGrad)"
          strokeWidth={s(2.5)}
          fill="none"
          strokeDasharray={`${orbitArcLen} ${orbitCirc - orbitArcLen}`}
          strokeLinecap="round"
          transform={`rotate(208 ${cx} ${cy})`}
        />

        <Circle cx={dotOnMidRing.x} cy={dotOnMidRing.y} r={s(5)} fill={primary} opacity={0.92} />
        <Circle
          cx={dotOnMidRing.x}
          cy={dotOnMidRing.y}
          r={s(10)}
          fill={primary}
          opacity={0.14}
        />
      </Svg>

      {ORBIT_SATELLITES.map((satellite) => (
        <OrbitSatellite
          key={satellite.icon}
          angle={satellite.angle}
          colors={satellite.colors}
          icon={satellite.icon}
          orbitR={orbitR}
          sat={sat}
          cx={cx}
          cy={cy}
          iconSize={iconSize}
          bobAmp={bobAmp}
          floatY={floatY}
          phase={satellite.phase}
          motionEnabled={motionEnabled}
        />
      ))}

      <Animated.View
        style={[
          styles.orbitHubRing,
          hubAnim,
          {
            width: hub + s(10),
            height: hub + s(10),
            borderRadius: (hub + s(10)) / 2,
            left: (stage - hub - s(10)) / 2,
            top: (stage - hub - s(10)) / 2,
            borderColor: schoolColorWithAlpha(primary, 0.12),
          },
        ]}
      >
        <View
          style={[
            styles.crestDisc,
            {
              width: hub,
              height: hub,
              borderRadius: hub / 2,
            },
          ]}
        >
          <Image
            source={SCHOOL_CONFIG.logo}
            style={{ width: hub * 0.74, height: hub * 0.74, resizeMode: "contain" }}
          />
        </View>
      </Animated.View>
    </View>
  );
});

/* ─── Secondary portal card (glass grid tile) ────────────────────────────── */
const PortalTile = memo(function PortalTile({
  icon,
  title,
  subtitle,
  tintBg,
  onPress,
  gridColumns,
  s,
  borderRadius,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tintBg: string;
  onPress: () => void;
  gridColumns: 1 | 2;
  s: (n: number) => number;
  borderRadius: number;
}) {
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: 90 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [pressed]);
  const onPressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: 120 });
  }, [pressed]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.tile,
        gridColumns === 1 ? styles.tileFull : styles.tileHalf,
        { borderRadius },
        anim,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.tileInner, { padding: s(16), gap: s(12), minHeight: s(128) }]}
        android_ripple={{ color: "rgba(0,0,0,0.04)", foreground: true }}
      >
        <View
          style={[
            styles.tileIcon,
            {
              backgroundColor: tintBg,
              width: s(48),
              height: s(48),
              borderRadius: s(16),
            },
          ]}
        >
          {icon}
        </View>
        <View style={styles.tileText}>
          <Text style={[styles.tileTitle, { fontSize: s(16) }]} numberOfLines={1}>
            {title}
          </Text>
          <Text
            style={[styles.tileSub, { fontSize: Math.max(s(12), 11), lineHeight: Math.max(s(17), 15) }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/* ─── MAIN ───────────────────────────────────────────────────────────────── */
export default function Index() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const C = useWelcomeTheme();
  const reduceMotion = useReducedMotion();
  const motionEnabled = !reduceMotion;

  /* Live, resize-aware layout metrics. Every card, icon disc, and display
     font below derives from `s()` so the whole composition grows on
     tablets / web and compresses on small phones. */
  const {
    winW,
    s,
    pagePad,
    gridGap,
    gridColumns,
    glowSize,
    isMobile,
  } = useResponsiveLayout();

  const tileBorderRadius = s(24);
  const ambientGlowSize = Math.min(glowSize, 520);

  /* Portal icon sizes track the tile scale */
  const tileIconSize = s(22);
  const tileIconSizeLg = s(23);

  /* Student card illustration — larger on every breakpoint, anchored bottom-right */
  const studentDoodleW = isMobile ? s(188) : s(280);
  const studentDoodleH = studentDoodleW * STUDENT_DOODLE_ASPECT;
  const studentTextGutter = isMobile ? s(148) : 0;

  /* Student card press */
  const studentPressed = useSharedValue(0);
  const onStudentIn = useCallback(() => {
    studentPressed.value = withTiming(1, { duration: 90 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [studentPressed]);
  const onStudentOut = useCallback(() => {
    studentPressed.value = withTiming(0, { duration: 120 });
  }, [studentPressed]);
  const studentAnim = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(studentPressed.value, [0, 1], [1, 0.975]) }],
  }));

  /* Subtle forward nudge on the primary CTA arrow */
  const arrowNudge = useSharedValue(0);
  useEffect(() => {
    if (!motionEnabled) return;
    arrowNudge.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 760, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 760, easing: Easing.inOut(Easing.sin) }),
        ), -1, true,
      ),
    );
  }, [arrowNudge, motionEnabled]);
  const arrowAnim = useAnimatedStyle(() => ({
    transform: motionEnabled
      ? [{ translateX: interpolate(arrowNudge.value, [0, 1], [0, 3]) }]
      : [],
  }));

  /* Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  /* ── Student session persistence guard ───────────────────────── */
  const [studentCheckDone, setStudentCheckDone] = useState(false);
  useEffect(() => {
    if (loading || user) return;
    AuthService.getSession().then((storedSession) => {
      const storedRole = storedSession?.validatedUser?.role?.code;
      if (isStudentRole(storedRole)) {
        if (__DEV__) console.log('[welcome] Student session found in storage — auto-navigating to student dashboard');
        router.replace('/(tabs)/home');
      } else {
        setStudentCheckDone(true);
      }
    }).catch(() => {
      setStudentCheckDone(true);
    });
  }, [loading, user]);

  if (loading || user || !studentCheckDone) {
    return <View style={{ flex: 1, backgroundColor: "#F6F4FF" }} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Ambient layered background */}
      <LinearGradient
        colors={["#F8F5FF", "#F4F7FF", "#FFFFFF"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            backgroundColor: C.glowSoft,
            width: ambientGlowSize,
            height: ambientGlowSize,
            borderRadius: ambientGlowSize / 2,
            top: -glowSize * 0.42,
          },
        ]}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { width: winW, paddingBottom: insets.bottom + s(48) },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
        scrollEventThrottle={16}
        decelerationRate="normal"
        overScrollMode="never"
        nestedScrollEnabled={false}
      >
       <View style={styles.contentColumn}>
        {/* ═══════════════════════════ HERO ═══════════════════════════ */}
        <View
          style={[
            styles.hero,
            {
              paddingTop: insets.top + s(28),
              paddingHorizontal: pagePad,
              paddingBottom: s(36),
            },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[
              schoolColorWithAlpha(C.p, 0.1),
              schoolColorWithAlpha(C.p, 0.04),
              "transparent",
            ]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroBackdrop}
          />

          <HeroOrbitCrest
            s={s}
            primary={C.p}
            glowSoft={C.glowSoft}
            motionEnabled={motionEnabled}
          />

          <Animated.View
            entering={motionEnabled ? HERO_ENTER.delay(80) : undefined}
            style={[
              styles.heroGreetingPill,
              {
                backgroundColor: C.tint,
                borderColor: C.tintBorder,
                paddingHorizontal: s(14),
                paddingVertical: s(7),
                marginBottom: s(14),
              },
            ]}
          >
            <View style={[styles.heroGreetingDot, { backgroundColor: C.p }]} />
            <Text style={[styles.heroEyebrow, { color: C.pD, marginBottom: 0 }]}>
              {greeting.toUpperCase()}  ·  WELCOME
            </Text>
          </Animated.View>

          <Animated.Text
            entering={motionEnabled ? HERO_ENTER.delay(120) : undefined}
            style={[
              styles.heroTitle,
              {
                color: C.ink,
                fontSize: s(40),
                lineHeight: s(44),
                maxWidth: winW - pagePad * 2,
              },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {SCHOOL_NAME || SCHOOL_CONFIG.name}
          </Animated.Text>

          <View style={[styles.heroTitleRule, { backgroundColor: schoolColorWithAlpha(C.p, 0.22), width: s(48), marginBottom: s(12) }]} />

          {SCHOOL_CONFIG.tagline ? (
            <Animated.Text
              entering={motionEnabled ? HERO_ENTER.delay(160) : undefined}
              style={[
                styles.heroSubtitle,
                {
                  color: C.inkC,
                  fontSize: Math.max(s(15), 13),
                  maxWidth: winW - pagePad * 2 - s(16),
                },
              ]}
              numberOfLines={2}
            >
              {SCHOOL_CONFIG.tagline}
            </Animated.Text>
          ) : null}

          {SCHOOL_CONFIG.motto ? (
            <Animated.View
              entering={motionEnabled ? HERO_ENTER.delay(200) : undefined}
              style={[
                styles.heroMottoPill,
                {
                  marginTop: s(10),
                  paddingHorizontal: s(14),
                  paddingVertical: s(6),
                  borderColor: C.tintBorder,
                  backgroundColor: C.tint,
                },
              ]}
            >
              <Text style={[styles.heroMotto, { color: C.inkD, marginTop: 0 }]} numberOfLines={1}>
                &ldquo;{SCHOOL_CONFIG.motto}&rdquo;
              </Text>
            </Animated.View>
          ) : null}
        </View>

        {/* ═══════════════════════════ BODY ═══════════════════════════ */}
        <View style={[styles.body, { paddingHorizontal: pagePad }]}>

          <Animated.Text
            entering={motionEnabled ? CARD_ENTER : undefined}
            style={[styles.sectionLabel, { marginBottom: s(16) }]}
          >
            CHOOSE YOUR PORTAL
          </Animated.Text>

          {/* ── Primary: Student Portal ─────────────────────────────── */}
          <Animated.View
            entering={motionEnabled ? CARD_ENTER.delay(40) : undefined}
            style={[
              styles.studentWrap,
              { width: "100%", borderRadius: s(32), marginBottom: s(24) },
              studentAnim,
            ]}
          >
            <Pressable
              onPress={() => router.push("/login")}
              onPressIn={onStudentIn}
              onPressOut={onStudentOut}
              style={[styles.studentPressable, { borderRadius: s(32) }]}
            >
              <LinearGradient
                colors={["#5B3DF5", "#7C3AED", "#9333EA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ minHeight: s(isMobile ? 218 : 228), padding: s(24) }}
              >
                {/* Soft depth layers */}
                <View pointerEvents="none" style={styles.studentAura} />
                <View pointerEvents="none" style={styles.studentAura2} />

                <View style={styles.studentBadge}>
                  <Text style={styles.studentBadgeText}>✦  PRIMARY PORTAL</Text>
                </View>

                <View
                  style={[
                    styles.studentMiddle,
                    {
                      marginTop: s(12),
                      minHeight: s(isMobile ? 112 : 156),
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "flex-end",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.studentTextCol,
                      { paddingRight: studentTextGutter, zIndex: 1 },
                    ]}
                  >
                    <Text style={[styles.studentTitle, { fontSize: s(26), lineHeight: s(32) }]}>
                      {t("index.student_login") || "Student Login"}
                    </Text>
                    <Text
                      style={[
                        styles.studentSub,
                        { fontSize: Math.max(s(14), 12), lineHeight: Math.max(s(22), 18) },
                      ]}
                    >
                      Grades · Attendance{"\n"}Timetable · And more
                    </Text>
                  </View>

                  {!isMobile ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.studentDoodle,
                        {
                          width: studentDoodleW,
                          height: studentDoodleH,
                          marginRight: -s(18),
                          marginBottom: -s(34),
                        },
                      ]}
                    >
                      <Image
                        source={require("../assets/images/studentDoodle.png")}
                        style={styles.studentDoodleImage}
                      />
                    </View>
                  ) : null}
                </View>

                {isMobile ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.studentDoodleHero,
                      {
                        width: studentDoodleW,
                        height: studentDoodleH,
                        right: -s(8),
                        bottom: s(52),
                      },
                    ]}
                  >
                    <Image
                      source={require("../assets/images/studentDoodle.png")}
                      style={styles.studentDoodleImage}
                    />
                  </View>
                ) : null}

                <View style={[styles.studentCtaRow, { marginTop: s(16) }]}>
                  <Text style={styles.studentCtaText}>Continue to sign in</Text>
                  <View
                    style={[
                      styles.studentCtaArrow,
                      { width: s(38), height: s(38), borderRadius: s(19) },
                    ]}
                  >
                    <Animated.View style={arrowAnim}>
                      <Ionicons name="arrow-forward" size={s(16)} color="#6D28D9" />
                    </Animated.View>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ── Secondary portals ───────────────────────────────────── */}
          <Animated.View
            entering={motionEnabled ? TILE_ENTER.delay(60) : undefined}
            style={[styles.tileGrid, { gap: gridGap, marginBottom: s(24) }]}
          >
            <PortalTile
              gridColumns={gridColumns}
              borderRadius={tileBorderRadius}
              s={s}
              icon={<Ionicons name="people-outline" size={tileIconSize} color="#0D9488" />}
              title={t("index.staff_login") || "Staff"}
              subtitle="Classes & records"
              tintBg="rgba(13,148,136,0.09)"
              onPress={() => router.push("/staff-login")}
            />
            <PortalTile
              gridColumns={gridColumns}
              borderRadius={tileBorderRadius}
              s={s}
              icon={<MaterialIcons name="admin-panel-settings" size={tileIconSizeLg} color="#4F46E5" />}
              title={t("index.admin_login") || "Admin"}
              subtitle="School management"
              tintBg="rgba(79,70,229,0.09)"
              onPress={() => router.push("/admin-login")}
            />
            <PortalTile
              gridColumns={gridColumns}
              borderRadius={tileBorderRadius}
              s={s}
              icon={<Ionicons name="wallet-outline" size={tileIconSize} color="#B45309" />}
              title={t("index.accounts_login") || "Accounts"}
              subtitle="Fees & finance"
              tintBg="rgba(180,83,9,0.09)"
              onPress={() => router.push("/accounts-login")}
            />
            <PortalTile
              gridColumns={gridColumns}
              borderRadius={tileBorderRadius}
              s={s}
              icon={<Ionicons name="bus-outline" size={tileIconSizeLg} color="#BE123C" />}
              title="Driver"
              subtitle="Live trip tracking"
              tintBg="rgba(190,18,60,0.09)"
              onPress={() => router.push("/driver-login")}
            />
          </Animated.View>

          {/* ── Support ─────────────────────────────────────────────── */}
          <View
            style={[
              styles.supportCard,
              { width: "100%", borderRadius: s(24), padding: s(16), gap: s(14), marginBottom: s(20) },
            ]}
          >
            <View
              style={[
                styles.supportIcon,
                {
                  backgroundColor: C.tint,
                  width: s(44),
                  height: s(44),
                  borderRadius: s(15),
                },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={s(20)} color={C.p} />
            </View>
            <View style={styles.supportText}>
              <Text style={[styles.supportTitle, { color: C.inkB }]}>Need help signing in?</Text>
              <Text style={styles.supportSub}>Reach out to your school office for credentials</Text>
            </View>
          </View>

          {/* ══ Startup India — government recognition strip ══════════
              Deliberately styled as a CERTIFICATE, not a card:
              · tricolor hairline + centered emblem layout (portal tiles
                are left-aligned icon/text rows, so this reads differently)
              · flat bordered surface, no elevation, no press feedback —
                nothing about it invites a tap
              · formal small-caps labelling like a printed credential   */}
          <View style={[styles.certWrap, { width: "100%", borderRadius: s(22), marginBottom: s(32) }]}>
            {/* Tricolor hairline — the national identity mark */}
            <LinearGradient
              colors={["#FF9933", "#FF9933", "#FFFFFF", "#138808", "#138808"]}
              locations={[0, 0.32, 0.5, 0.68, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.certTricolor}
            />

            {/* Faint warm→green wash echoing the flag, kept near-white */}
            <LinearGradient
              colors={["#FFFBF5", "#FFFFFF", "#F5FBF6"]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={[styles.certBody, { paddingVertical: s(20), paddingHorizontal: s(20) }]}>
              {/* Emblem — centered, ringed like an official seal */}
              <View
                style={[
                  styles.certSeal,
                  { width: s(58), height: s(58), borderRadius: s(29) },
                ]}
              >
                <Image
                  source={require("../assets/images/startup-india.png")}
                  style={{ width: s(38), height: s(38), resizeMode: "contain" }}
                />
              </View>

              <Text style={styles.certEyebrow}>GOVERNMENT OF INDIA</Text>

              <Text style={[styles.certTitle, { fontSize: s(17) }]}>
                DPIIT Recognized Startup
              </Text>

              <Text style={styles.certSub}>
                Recognized under the Startup India initiative by the{"\n"}
                Department for Promotion of Industry and Internal Trade
              </Text>

              {/* Verification pill — green, official */}
              <View style={styles.certVerified}>
                <Ionicons name="shield-checkmark" size={12} color="#138808" />
                <Text style={styles.certVerifiedText}>VERIFIED CREDENTIAL</Text>
              </View>
            </View>
          </View>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>POWERED BY NEXSYRUS</Text>
            <Text style={styles.footerVersion}>v 2.0.0 · SchoolIMS</Text>
          </View>

        </View>
       </View>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
/* NOTE: every dimension that must respond to display size is applied inline
   via the s() scale function above. This sheet keeps only the static,
   scale-independent properties (colors, weights, shadows, flex behavior). */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F4FF",
  },
  scrollContent: {
    alignItems: "stretch",
    flexGrow: 1,
    ...Platform.select({
      web: { boxSizing: "border-box" as any },
    }),
  },
  contentColumn: {
    width: "100%",
    alignSelf: "stretch",
  },
  body: {
    width: "100%",
    alignSelf: "stretch",
  },
  ambientGlow: {
    position: "absolute",
    alignSelf: "center",
  },

  /* ── Hero ──────────────────────────────────────────────── */
  hero: {
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    width: "100%",
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGreetingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  heroGreetingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroTitleRule: {
    height: 3,
    borderRadius: 2,
    marginTop: 4,
  },
  heroMottoPill: {
    borderRadius: 100,
    borderWidth: 1,
  },
  orbitStage: {
    alignSelf: "center",
    position: "relative",
  },
  orbitGlow: {
    position: "absolute",
  },
  orbitGlowInner: {
    position: "absolute",
  },
  orbitHubRing: {
    position: "absolute",
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#5B3DF5",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.14,
        shadowRadius: 28,
      },
      android: { elevation: 8 },
      web: { boxShadow: "0 14px 32px rgba(91, 61, 245, 0.14)" } as any,
    }),
  },
  orbitSatellite: {
    position: "absolute",
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B4B",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
      web: { boxShadow: "0 8px 22px rgba(30, 27, 75, 0.22)", willChange: "transform" as any } as any,
    }),
  },
  orbitSatelliteRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  orbitSatelliteShine: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.22)",
    opacity: 0.55,
  },
  crestDisc: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#5B3DF5",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
      web: { boxShadow: "0 10px 24px rgba(91, 61, 245, 0.12)" } as any,
    }),
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    opacity: 0.88,
  },
  heroTitle: {
    fontWeight: "900",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  heroSubtitle: {
    lineHeight: 22,
    fontWeight: "500",
    textAlign: "center",
    opacity: 0.72,
  },
  heroMotto: {
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: "500",
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: 0.85,
  },

  /* ── Body ──────────────────────────────────────────────── */
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#0F172A",
    opacity: 0.5,
  },

  /* ── Student primary card ──────────────────────────────── */
  studentWrap: {
    /* Android elevation needs a background color on the elevated view */
    backgroundColor: "#5B3DF5",
    ...Platform.select({
      ios: {
        shadowColor: "#5B3DF5",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 36,
      },
      android: { elevation: 12 },
    }),
  },
  studentPressable: {
    overflow: "hidden",
  },
  studentAura: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -120,
    right: -70,
  },
  studentAura2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -60,
    left: -40,
  },
  studentBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  studentBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.9)",
  },
  studentMiddle: {
    position: "relative",
    gap: 8,
  },
  studentTextCol: {
    flex: 1,
    gap: 4,
  },
  studentDoodle: {
    flexShrink: 0,
    zIndex: 0,
  },
  studentDoodleHero: {
    position: "absolute",
    zIndex: 2,
  },
  studentDoodleImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B4B",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  studentTitle: {
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.8,
  },
  studentSub: {
    fontWeight: "500",
    color: "rgba(255,255,255,0.65)",
  },
  studentCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 3,
  },
  studentCtaText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.9)",
  },
  studentCtaArrow: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Secondary tiles ───────────────────────────────────── */
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    alignSelf: "stretch",
  },
  tile: {
    backgroundColor: "rgba(255,255,255,0.9)",
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B4B",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: { elevation: 2 },
    }),
  },
  tileFull: {
    width: "100%",
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: "100%",
  },
  tileHalf: {
    flex: 1,
    minWidth: "46%",
  },
  tileInner: {},
  tileIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: {
    gap: 2,
  },
  tileTitle: {
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  tileSub: {
    fontWeight: "500",
    color: "#64748B",
    opacity: 0.9,
  },

  /* ── Support card ──────────────────────────────────────── */
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B4B",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: { elevation: 2 },
    }),
  },
  supportIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  supportText: {
    flex: 1,
    gap: 2,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  supportSub: {
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B",
    opacity: 0.9,
  },

  /* ── Startup India certification strip ─────────────────── */
  certWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.07)",
    backgroundColor: "#FFFFFF",
    /* Intentionally NO elevation / shadow — flat like a printed
       credential, so it never reads as a tappable card. */
  },
  certTricolor: {
    height: 3,
    width: "100%",
  },
  certBody: {
    alignItems: "center",
  },
  certSeal: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(19, 136, 8, 0.18)",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#138808",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 1 },
    }),
  },
  certEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2.4,
    color: "#B45309",
    opacity: 0.85,
    marginBottom: 6,
  },
  certTitle: {
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 6,
  },
  certSub: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 14,
  },
  certVerified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(19, 136, 8, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(19, 136, 8, 0.16)",
  },
  certVerifiedText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#138808",
  },

  /* ── Footer ────────────────────────────────────────────── */
  footer: {
    alignItems: "center",
    gap: 4,
  },
  footerBrand: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#94A3B8",
  },
  footerVersion: {
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 0.5,
    opacity: 0.7,
  },
});