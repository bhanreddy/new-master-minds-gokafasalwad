import { withLayoutContext } from 'expo-router';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const { Navigator } = createBottomTabNavigator();

// On the web, we fallback to Bottom Tabs because Material Top Tabs relies on 
// react-native-pager-view, which relies on native Android/iOS ViewPagers and crashes the web bundler.
export const MaterialTopTabs = withLayoutContext(Navigator);
