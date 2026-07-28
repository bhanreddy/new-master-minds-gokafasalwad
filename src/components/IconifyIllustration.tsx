import type { IconifyIcon } from '@iconify/types';
import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';

type IconifyIllustrationProps = {
  icon: IconifyIcon;
  size?: number;
};

/**
 * Renders an individually imported Iconify illustration through react-native-svg.
 * This keeps the artwork vector-based and offline without creating image assets.
 */
export default function IconifyIllustration({
  icon,
  size = 40,
}: IconifyIllustrationProps) {
  const xml = useMemo(() => {
    const width = icon.width ?? 32;
    const height = icon.height ?? 32;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
  }, [icon]);

  return <SvgXml xml={xml} width={size} height={size} />;
}
