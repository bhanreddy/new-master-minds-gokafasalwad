import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export type MagicOrigin = { x: number; y: number };

const COLORS = [
  '#FBBF24', '#FDE68A', '#34D399', '#6EE7B7', '#A7F3D0',
  '#A78BFA', '#C4B5FD', '#60A5FA', '#F57964', '#FFFFFF',
];
const GLYPHS = ['✦', '✧', '★', '✵', '✶'];

type WebParticle = {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  spin: number;
  spinSpeed: number;
  life: number;
  maxLife: number;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clampOrigin(origin: MagicOrigin, width: number, height: number): MagicOrigin {
  return {
    x: Math.max(20, Math.min(width - 20, origin.x || width * 0.5)),
    y: Math.max(20, Math.min(height - 20, origin.y || height * 0.45)),
  };
}

/** Web uses one short, origin-anchored burst to avoid Reanimated portal issues. */
function runWebSparkles(origin: MagicOrigin, count: number) {
  const root = document.createElement('div');
  root.setAttribute('data-magic-sparkles', '1');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483646',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(root);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const { x: originX, y: originY } = clampOrigin(origin, width, height);
  const particles: WebParticle[] = [];

  for (let index = 0; index < count; index += 1) {
    const el = document.createElement('div');
    const isDot = index % 4 === 0;
    const size = isDot ? rand(5, 9) : rand(10, 20);
    const color = COLORS[index % COLORS.length];
    const isRadial = index % 5 === 0;
    const angle = isRadial
      ? rand(0, Math.PI * 2)
      : rand(-Math.PI * 0.92, -Math.PI * 0.08);
    const speed = isRadial ? rand(150, 330) : rand(260, 520);

    Object.assign(el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: isDot ? `${size}px` : 'auto',
      height: isDot ? `${size}px` : 'auto',
      borderRadius: isDot ? '999px' : '0',
      background: isDot ? color : 'transparent',
      fontSize: isDot ? '0' : `${size}px`,
      fontWeight: '900',
      lineHeight: '1',
      color,
      textShadow: isDot ? 'none' : `0 0 7px ${color}`,
      willChange: 'transform, opacity',
      transform: `translate3d(${originX - size / 2}px, ${originY - size / 2}px, 0) scale(0.25)`,
      opacity: '0',
    });
    if (!isDot) el.textContent = GLYPHS[index % GLYPHS.length];
    root.appendChild(el);

    particles.push({
      el,
      x: originX - size / 2 + rand(-7, 7),
      y: originY - size / 2 + rand(-5, 5),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (isRadial ? 30 : rand(20, 100)),
      gravity: rand(560, 920),
      spin: rand(0, 360),
      spinSpeed: rand(-360, 360),
      life: -rand(0, 0.16),
      maxLife: rand(0.95, 1.65),
    });
  }

  let animationFrame = 0;
  let lastTime = performance.now();
  let active = true;

  const cleanup = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(animationFrame);
    root.remove();
  };

  const tick = (now: number) => {
    if (!active) return;
    const delta = Math.min(0.032, (now - lastTime) / 1000);
    lastTime = now;
    let hasLiveParticle = false;

    for (const particle of particles) {
      particle.life += delta;
      if (particle.life <= 0) {
        hasLiveParticle = true;
        continue;
      }
      if (particle.life >= particle.maxLife) {
        particle.el.style.opacity = '0';
        continue;
      }

      hasLiveParticle = true;
      particle.vy += particle.gravity * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.spin += particle.spinSpeed * delta;

      const progress = particle.life / particle.maxLife;
      const opacity = progress < 0.1
        ? progress / 0.1
        : progress > 0.68
          ? (1 - progress) / 0.32
          : 1;
      const scale = progress < 0.12
        ? 0.25 + (progress / 0.12) * 0.85
        : 1.1 - progress * 0.35;

      particle.el.style.opacity = String(Math.max(0, opacity));
      particle.el.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.spin}deg) scale(${scale})`;
    }

    if (hasLiveParticle) animationFrame = requestAnimationFrame(tick);
    else cleanup();
  };

  animationFrame = requestAnimationFrame(tick);
  window.setTimeout(cleanup, 2300);
  return cleanup;
}

type NativeSpec = {
  id: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  color: string;
  glyph: string;
  spin: number;
  delay: number;
  duration: number;
};

function buildNative(count: number, origin: MagicOrigin, seed: number): NativeSpec[] {
  const { width, height } = Dimensions.get('window');
  const { x: originX, y: originY } = clampOrigin(origin, width, height);

  return Array.from({ length: count }, (_, index) => {
    const isRadial = index % 5 === 0;
    const angle = isRadial
      ? rand(0, Math.PI * 2)
      : rand(-Math.PI * 0.92, -Math.PI * 0.08);
    const speed = isRadial ? rand(150, 310) : rand(250, 480);
    return {
      id: index,
      x0: originX + rand(-7, 7),
      y0: originY + rand(-5, 5),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (isRadial ? 30 : rand(20, 90)),
      gravity: rand(560, 880),
      size: rand(10, 20),
      color: COLORS[(index + Math.abs(seed)) % COLORS.length],
      glyph: GLYPHS[(index + Math.abs(seed)) % GLYPHS.length],
      spin: rand(-420, 420),
      delay: rand(0, 150),
      duration: rand(950, 1600),
    };
  });
}

function NativeSparkle({ spec }: { spec: NativeSpec }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      spec.delay,
      withTiming(1, { duration: spec.duration, easing: Easing.linear }),
    );
  }, [progress, spec.delay, spec.duration]);

  const style = useAnimatedStyle(() => {
    const progressSeconds = progress.value * (spec.duration / 1000);
    return {
      opacity: interpolate(progress.value, [0, 0.08, 0.68, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: spec.x0 + spec.vx * progressSeconds },
        { translateY: spec.y0 + spec.vy * progressSeconds + 0.5 * spec.gravity * progressSeconds * progressSeconds },
        { rotate: `${spec.spin * progress.value}deg` },
        { scale: interpolate(progress.value, [0, 0.12, 1], [0.25, 1.1, 0.65]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.nativeParticle, style]}>
      <Text style={[styles.nativeGlyph, { color: spec.color, fontSize: spec.size }]}>{spec.glyph}</Text>
    </Animated.View>
  );
}

type Props = {
  trigger: number;
  origin?: MagicOrigin | null;
  particleCount?: number;
};

export default function MagicSparkleCelebration({
  trigger,
  origin = null,
  particleCount = 52,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [nativeVisible, setNativeVisible] = useState(false);
  const [nativeSeed, setNativeSeed] = useState(0);
  const [nativeOrigin, setNativeOrigin] = useState<MagicOrigin>({ x: 0, y: 0 });
  const cleanupRef = useRef<(() => void) | null>(null);
  const originRef = useRef(origin);
  originRef.current = origin;

  useEffect(() => {
    if (trigger <= 0 || reduceMotion) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setNativeVisible(false);
      return undefined;
    }

    const dims = Dimensions.get('window');
    const resolved = originRef.current ?? {
      x: (Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : dims.width) * 0.5,
      y: (Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerHeight : dims.height) * 0.4,
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      cleanupRef.current?.();
      cleanupRef.current = runWebSparkles(resolved, particleCount);
      return () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
      };
    }

    setNativeOrigin(resolved);
    setNativeSeed(trigger);
    setNativeVisible(true);
    const hideTimer = setTimeout(() => setNativeVisible(false), 1900);
    return () => clearTimeout(hideTimer);
  }, [particleCount, reduceMotion, trigger]);

  const nativeSpecs = useMemo(
    () => buildNative(Math.min(particleCount, 44), nativeOrigin, nativeSeed),
    [nativeOrigin, nativeSeed, particleCount],
  );

  if (Platform.OS === 'web' || !nativeVisible || reduceMotion) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent presentationStyle="overFullScreen">
      <View pointerEvents="none" style={styles.stage}>
        {nativeSpecs.map((spec) => (
          <NativeSparkle key={`${nativeSeed}-${spec.id}`} spec={spec} />
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  nativeParticle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  nativeGlyph: {
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
});
