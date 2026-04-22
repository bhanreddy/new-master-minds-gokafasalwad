import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';

type YTPlayer = {
  destroy: () => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getVideoUrl: () => string;
  isMuted: () => boolean;
  getVolume: () => number;
  getPlaybackRate: () => number;
  getAvailablePlaybackRates: () => number[];
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        id: string | HTMLElement,
        opts: {
          width?: number;
          height?: number;
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
            onError?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_STATE_TO_ENUM: Record<number, PLAYER_STATES> = {
  [-1]: PLAYER_STATES.UNSTARTED,
  0: PLAYER_STATES.ENDED,
  1: PLAYER_STATES.PLAYING,
  2: PLAYER_STATES.PAUSED,
  3: PLAYER_STATES.BUFFERING,
  5: PLAYER_STATES.VIDEO_CUED,
};

let apiLoadPromise: Promise<void> | null = null;

function ensureYouTubeIframeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();

  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const done = () => resolve();
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      done();
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const first = document.getElementsByTagName('script')[0];
    first.parentNode?.insertBefore(tag, first);

    const t = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(t);
        done();
      }
    }, 50);
    window.setTimeout(() => {
      window.clearInterval(t);
      done();
    }, 15000);
  });

  return apiLoadPromise;
}

export type LMSWebYoutubePlayerProps = {
  videoId: string;
  width: number;
  height: number;
  /** Must be stable and unique per open video (e.g. material id). */
  hostDomId: string;
  onReady: () => void;
  onChangeState: (state: PLAYER_STATES) => void;
  onError?: (err: string) => void;
};

const LMSWebYoutubePlayer = forwardRef<YoutubeIframeRef, LMSWebYoutubePlayerProps>(
  function LMSWebYoutubePlayer(
    { videoId, width, height, hostDomId, onReady, onChangeState, onError },
    ref
  ) {
    const playerRef = useRef<YTPlayer | null>(null);
    const readyCalledRef = useRef(false);
    const cbRef = useRef({ onReady, onChangeState, onError });
    cbRef.current = { onReady, onChangeState, onError };

    const safeId = `lms-yt-${hostDomId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    useImperativeHandle(
      ref,
      () => ({
        getDuration: async () => playerRef.current?.getDuration?.() ?? 0,
        getCurrentTime: async () => playerRef.current?.getCurrentTime?.() ?? 0,
        seekTo: (seconds: number, allowSeekAhead: boolean) => {
          playerRef.current?.seekTo?.(seconds, allowSeekAhead);
        },
        getVideoUrl: async () => playerRef.current?.getVideoUrl?.() ?? '',
        isMuted: async () => playerRef.current?.isMuted?.() ?? false,
        getVolume: async () => playerRef.current?.getVolume?.() ?? 0,
        getPlaybackRate: async () => playerRef.current?.getPlaybackRate?.() ?? 1,
        getAvailablePlaybackRates: async () =>
          playerRef.current?.getAvailablePlaybackRates?.() ?? [1],
      }),
      []
    );

    useEffect(() => {
      let cancelled = false;
      readyCalledRef.current = false;

      function waitForHostEl(maxAttempts: number): Promise<HTMLElement | null> {
        return new Promise((resolve) => {
          let n = 0;
          const tick = () => {
            if (cancelled) {
              resolve(null);
              return;
            }
            const el = document.getElementById(safeId);
            if (el) {
              resolve(el as HTMLElement);
              return;
            }
            if (n++ >= maxAttempts) {
              resolve(null);
              return;
            }
            requestAnimationFrame(tick);
          };
          tick();
        });
      }

      (async () => {
        await ensureYouTubeIframeAPI();
        if (cancelled || !window.YT?.Player) {
          cbRef.current.onError?.('YouTube API failed to load');
          return;
        }

        const el = await waitForHostEl(90);
        if (cancelled || !el) {
          cbRef.current.onError?.('Video player container not ready');
          return;
        }

        try {
          playerRef.current?.destroy?.();
        } catch {
          /* ignore */
        }
        playerRef.current = null;

        try {
          playerRef.current = new window.YT.Player(safeId, {
            width,
            height,
            videoId,
            playerVars: {
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              controls: 1,
            },
            events: {
              onReady: () => {
                if (cancelled || readyCalledRef.current) return;
                readyCalledRef.current = true;
                cbRef.current.onReady();
              },
              onStateChange: (e) => {
                const mapped = YT_STATE_TO_ENUM[e.data];
                if (mapped !== undefined) cbRef.current.onChangeState(mapped);
              },
              onError: (e) => {
                cbRef.current.onError?.(String(e.data));
              },
            },
          });
        } catch (e) {
          cbRef.current.onError?.(String(e));
        }
      })();

      return () => {
        cancelled = true;
        try {
          playerRef.current?.destroy?.();
        } catch {
          /* ignore */
        }
        playerRef.current = null;
      };
    }, [videoId, width, height, safeId]);

    return <View nativeID={safeId} style={{ width, height, backgroundColor: '#000' }} />;
  }
);

export default LMSWebYoutubePlayer;
