import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

const ScreenLayout = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  }), [theme]);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {children}
      </View>
    </SafeAreaProvider>
  );
};

export default ScreenLayout;
