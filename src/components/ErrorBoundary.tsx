import React, { Component, ErrorInfo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import BrokenErrorDoodle from './doodles/BrokenErrorDoodle';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to service (e.g. Sentry) here
    this.setState({
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    router.replace('/welcome');
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.75, y: 0.55 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <Text style={styles.title}>Oops! Something went wrong</Text>

            <View style={styles.art}>
              <BrokenErrorDoodle size={160} motionEnabled />
            </View>

            <Text style={styles.subtitle}>
              We are working hard to fix this, please check back later!
            </Text>

            {__DEV__ ? (
              <ScrollView style={styles.debugBox} nestedScrollEnabled>
                <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
                {this.state.errorInfo?.componentStack ? (
                  <Text style={styles.stackText}>{this.state.errorInfo.componentStack}</Text>
                ) : null}
              </ScrollView>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                pressed && styles.buttonPressed,
              ]}
              onPress={this.handleReset}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={styles.buttonText}>Okay</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 10, 18, 0.92)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 26,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(76,90,120,0.10)',
    ...Platform.select({
      ios: {
        shadowColor: '#0B0F19',
        shadowOffset: { width: 0, height: 22 },
        shadowOpacity: 0.32,
        shadowRadius: 40,
      },
      android: { elevation: 12 },
      web: {
        boxShadow: '0 34px 80px -20px rgba(8,10,18,0.55)',
      } as any,
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  art: {
    marginVertical: 6,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#4B5563',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  debugBox: {
    maxHeight: 160,
    width: '100%',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 13,
  },
  stackText: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 16,
  },
  button: {
    marginTop: 16,
    alignSelf: 'stretch',
    backgroundColor: '#F5C542',
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderBottomWidth: 3,
    borderBottomColor: '#D4A017',
    ...Platform.select({
      ios: {
        shadowColor: '#D4A017',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: {
        boxShadow: '0 10px 22px -8px rgba(212,160,23,0.45)',
      } as any,
    }),
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  buttonText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
});
