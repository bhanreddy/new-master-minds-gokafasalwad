import { forwardRef } from 'react';
import { View } from 'react-native';
import type { YoutubeIframeRef } from 'react-native-youtube-iframe';
import type { LMSWebYoutubePlayerProps } from './LMSWebYoutubePlayer.web';

/**
 * Native/iOS/Android: modal uses `react-native-youtube-iframe` instead; this
 * file is unused at runtime. It mirrors the .web variant's signature so tsc
 * (which resolves this non-.web file) checks callers against the real props.
 */
const LMSWebYoutubePlayer = forwardRef<YoutubeIframeRef, LMSWebYoutubePlayerProps>(
  function LMSWebYoutubePlayer() {
    return <View />;
  }
);

export default LMSWebYoutubePlayer;
