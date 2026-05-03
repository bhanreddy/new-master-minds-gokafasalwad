import { Platform, StyleSheet } from 'react-native';
import { Elevation } from './themes';

/** Placeholder color (~4.5:1 on white; readable on light gray surfaces). */
export const INPUT_PLACEHOLDER_COLOR = '#94A3B8';

const webInputBox = Platform.select({
  web: {
    outlineWidth: 0,
    outlineStyle: 'none' as any,
    width: '100%',
    maxWidth: 480,
    boxSizing: 'border-box',
  } as const,
  default: {},
});

/**
 * Default field chrome — visible border, white fill, readable placeholder via AppTextInput.
 */
export const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#1F2937',
    minHeight: 44,
    ...webInputBox,
  },

  /**
   * Use inside search / composed rows that already provide border, background, and depth.
   * Overrides default input chrome so the outer wrapper reads as the control.
   */
  inputInChrome: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: Platform.select({ web: 8, default: 6 }),
    minHeight: 36,
    ...Platform.select({
      web: {
        outlineWidth: 0,
        outlineStyle: 'none' as any,
        flex: 1,
        minWidth: 0,
        maxWidth: 4000,
        width: '100%',
        boxSizing: 'border-box',
      } as const,
      default: {
        flex: 1,
        minWidth: 0,
      },
    }),
  },

  /** Depth for search bars and similar composed controls (elevation 2 on native). */
  searchBarWrapper: {
    ...Elevation.level1,
  },
});
