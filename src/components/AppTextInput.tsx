import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { INPUT_PLACEHOLDER_COLOR, styles as themeStyles } from '@/src/theme/styles';

/**
 * AppTextInput — Platform-normalised TextInput wrapper.
 *
 * Base styles live in `src/theme/styles.ts` (border, fill, placeholder contrast).
 * For inputs inside a search row / chrome wrapper, pass `themeStyles.inputInChrome` first in `style`.
 *
 * Drop-in replacement: every existing TextInput prop is forwarded.
 */
const AppTextInput = React.forwardRef<TextInput, TextInputProps>(
  ({ style, ...rest }, ref) => {
    return (
      <TextInput
        ref={ref}
        autoComplete="off"
        // @ts-ignore — importantForAutofill is Android-only but safe to set everywhere
        importantForAutofill="no"
        placeholderTextColor={rest.placeholderTextColor ?? INPUT_PLACEHOLDER_COLOR}
        {...rest}
        style={[themeStyles.input, style]}
      />
    );
  }
);

AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;
