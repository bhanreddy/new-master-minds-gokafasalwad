import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import LogoLoader from './LogoLoader';

type HtmlPreviewProps = {
  html: string;
  style?: ViewStyle;
  loaderColor?: string;
};

/**
 * Renders HTML in-app: iframe on web (react-native-webview is unsupported there),
 * WebView on native.
 */
export default function HtmlPreview({
  html,
  style,
  loaderColor = '#4F46E5',
}: HtmlPreviewProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.fill, style]}>
        {React.createElement('iframe', {
          title: 'Document preview',
          srcDoc: html,
          sandbox: 'allow-same-origin',
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#fff',
          },
        })}
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={[styles.fill, style]}
      startInLoadingState
      scalesPageToFit
      renderLoading={() => (
        <View style={styles.loading}>
          <LogoLoader size={40} color={loaderColor} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
    minHeight: 0,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
