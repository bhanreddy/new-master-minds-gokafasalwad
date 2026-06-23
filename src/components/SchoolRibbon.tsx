import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SCHOOL_NAME } from '../constants/school';
import { SCHOOL_CONFIG, schoolColorWithAlpha } from '../constants/schoolConfig';

const ribbonTheme = SCHOOL_CONFIG.theme;

const STRIPE_H = 3;
const MOVING_RIBBON_H = 42;
const REPEAT_COUNT = 5;
const SEPARATOR = '  •  ';

function RibbonSegment({
  schoolName,
  tagline,
}: {
  schoolName: string;
  tagline: string;
}) {
  return (
    <View style={marqueeStyles.segment}>
      <Image
        source={SCHOOL_CONFIG.logo}
        style={marqueeStyles.logo}
        resizeMode="contain"
      />
      <Text style={marqueeStyles.schoolName} numberOfLines={1}>
        {schoolName}
      </Text>
      {tagline ? (
        <Text style={marqueeStyles.taglineInline} numberOfLines={1}>
          {' · '}
          {tagline}
        </Text>
      ) : null}
      <Text style={marqueeStyles.separator}>{SEPARATOR}</Text>
    </View>
  );
}

function movingRibbonBodyHeight() {
  return STRIPE_H * 2 + MOVING_RIBBON_H;
}

/** Backdrop fills the status-bar (unsafe) region + ribbon so the gradient is seamless. */
function NativeRibbonUnsafeBackdrop({ totalHeight }: { totalHeight: number }) {
  const g = ribbonTheme.ribbonGradient;
  const loc = ribbonTheme.ribbonGradientLocations;
  const a = ribbonTheme.accent;
  return (
    <>
      <LinearGradient
        colors={[...g]}
        locations={[...loc]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[nativeEdgeStyles.backdrop, { height: totalHeight }]}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.14)']}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[nativeEdgeStyles.gloss, { height: totalHeight }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[schoolColorWithAlpha(a, 0.22), schoolColorWithAlpha(a, 0), 'transparent']}
        locations={[0, 0.35, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[nativeEdgeStyles.topGoldWash, { height: Math.min(totalHeight * 0.45, 56) }]}
        pointerEvents="none"
      />
    </>
  );
}

function MovingSchoolRibbon() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const width = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(width)).current;
  const [contentWidth, setContentWidth] = useState(0);
  const schoolName = SCHOOL_NAME || SCHOOL_CONFIG.name;
  const tagline = SCHOOL_CONFIG.tagline?.trim() || '';

  const bodyH = movingRibbonBodyHeight();
  const backdropH = insets.top + bodyH;

  useEffect(() => {
    if (contentWidth <= 0) return;

    let cancelled = false;

    const animate = () => {
      if (cancelled) return;
      translateX.setValue(width);
      Animated.timing(translateX, {
        toValue: -contentWidth,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) animate();
      });
    };

    animate();

    return () => {
      cancelled = true;
      translateX.stopAnimation();
    };
  }, [contentWidth, width]);

  return (
    <View
      style={[nativeEdgeStyles.shell, { height: backdropH }]}
      accessibilityRole="header"
    >
      <StatusBar style={ribbonTheme.statusBarOnRibbon} />
      <NativeRibbonUnsafeBackdrop totalHeight={backdropH} />
      <View style={{ paddingTop: insets.top }}>
        <View style={marqueeStyles.goldStripe} />
        <View style={marqueeStyles.gradientBar}>
          <View style={marqueeStyles.clip}>
            <Animated.View
              style={[
                marqueeStyles.track,
                { transform: [{ translateX }] },
              ]}
              onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
            >
              {Array.from({ length: REPEAT_COUNT }, (_, i) => (
                <RibbonSegment key={i} schoolName={schoolName} tagline={tagline} />
              ))}
            </Animated.View>
          </View>
        </View>
        <View style={[marqueeStyles.goldStripe, marqueeStyles.goldStripeBottom]} />
      </View>
    </View>
  );
}

const nativeEdgeStyles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: ribbonTheme.ribbonGradient[0],
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  gloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  topGoldWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});

const marqueeStyles = StyleSheet.create({
  goldStripe: {
    height: STRIPE_H,
    backgroundColor: ribbonTheme.accent,
  },
  goldStripeBottom: {
    opacity: 1,
  },
  gradientBar: {
    height: MOVING_RIBBON_H,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  clip: {
    height: MOVING_RIBBON_H,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  schoolName: {
    color: ribbonTheme.ribbonTitle,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.25,
  },
  taglineInline: {
    color: ribbonTheme.ribbonTagline,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.15,
  },
  separator: {
    color: ribbonTheme.marqueeSeparator,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default function SchoolRibbon() {
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView
        style={shellStyles.safeTop}
        edges={['top']}
        accessibilityRole="header"
      >
        <StaticLetterheadRibbon />
      </SafeAreaView>
    );
  }
  return <MovingSchoolRibbon />;
}

const shellStyles = StyleSheet.create({
  safeTop: {
    backgroundColor: ribbonTheme.accent,
  },
});

function StaticLetterheadRibbon() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const schoolName = SCHOOL_NAME || SCHOOL_CONFIG.name;
  const tagline = SCHOOL_CONFIG.tagline?.trim() || '';
  const motto = SCHOOL_CONFIG.motto?.trim() || '';
  const address = SCHOOL_CONFIG.address?.trim() || '';
  const phone = SCHOOL_CONFIG.contact?.trim() || '';
  const email = SCHOOL_CONFIG.email?.trim() || '';

  const compactInfo = width < 380;

  const columns = useMemo(() => {
    const items: { key: string; body: string }[] = [];
    if (motto) items.push({ key: 'motto', body: motto });
    if (address) items.push({ key: 'addr', body: address });
    const contactBlock = [
      phone && `${t('schoolRibbon.tel')} ${phone}`,
      email && `${t('schoolRibbon.email')} ${email}`,
    ]
      .filter(Boolean)
      .join('\n');
    if (contactBlock) items.push({ key: 'contact', body: contactBlock });
    return items;
  }, [motto, address, phone, email, t]);

  return (
    <View style={styles.column}>
      <View style={styles.goldStripe} />
      <LinearGradient
        colors={[...ribbonTheme.ribbonGradient]}
        locations={[...ribbonTheme.ribbonGradientLocations]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.15)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.inner, compactInfo && styles.innerCompact]}>
          <View style={[styles.brandRow, compactInfo && styles.brandRowCompact]}>
            <View style={styles.logoFrame}>
              <Image
                source={SCHOOL_CONFIG.logo}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.schoolName} numberOfLines={2}>
                {schoolName}
              </Text>
              {tagline ? (
                <Text style={styles.tagline} numberOfLines={2}>
                  {tagline}
                </Text>
              ) : null}
            </View>
          </View>

          {columns.length > 0 ? (
            compactInfo ? (
              <View style={styles.infoStack}>
                {columns.map((col, i) => (
                  <React.Fragment key={col.key}>
                    {i > 0 ? <View style={styles.hDivider} /> : null}
                    <Text style={styles.infoTextStacked} numberOfLines={4}>
                      {col.body}
                    </Text>
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={[styles.infoRow, styles.infoRowWide]}>
                {columns.map((col, i) => (
                  <React.Fragment key={col.key}>
                    {i > 0 ? <View style={styles.vDivider} /> : null}
                    <View style={styles.infoCol}>
                      <Text style={styles.infoText} numberOfLines={4}>
                        {col.body}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )
          ) : null}
        </View>
      </LinearGradient>
      <View style={[styles.goldStripe, styles.goldStripeBottom]} />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: ribbonTheme.accent,
  },
  goldStripe: {
    height: STRIPE_H,
    backgroundColor: ribbonTheme.accent,
    shadowColor: ribbonTheme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
  },
  goldStripeBottom: {
    shadowOpacity: 0,
  },
  gradient: {
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  innerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    paddingVertical: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    maxWidth: '44%',
    minWidth: 132,
  },
  brandRowCompact: {
    maxWidth: '100%',
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  logoFrame: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: schoolColorWithAlpha(ribbonTheme.accent, 0.45),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  logo: {
    width: 44,
    height: 44,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  schoolName: {
    color: ribbonTheme.ribbonTitle,
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 0.35,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagline: {
    marginTop: 2,
    color: ribbonTheme.ribbonTagline,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: 0,
    gap: 0,
  },
  infoRowWide: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  infoText: {
    color: ribbonTheme.ribbonBody,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: schoolColorWithAlpha(ribbonTheme.accent, 0.35),
    marginVertical: 2,
  },
  infoStack: {
    width: '100%',
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: schoolColorWithAlpha(ribbonTheme.accent, 0.25),
  },
  hDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: schoolColorWithAlpha(ribbonTheme.accent, 0.3),
    marginVertical: 6,
  },
  infoTextStacked: {
    color: ribbonTheme.ribbonBodyMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
  },
});
