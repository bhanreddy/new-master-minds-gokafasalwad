import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

const ScreenLayout = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => {
  const { theme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor: theme.colors.background,
    },
  }), [theme]);

  return (
    <SafeAreaProvider>
      <View style={[styles.container, style]}>
        {children}
      </View>
    </SafeAreaProvider>
  );
};

export default ScreenLayout;
