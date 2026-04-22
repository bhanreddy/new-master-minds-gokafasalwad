import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import type { SchoolTheme } from '../theme/types';

export type { SchoolTheme };

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
