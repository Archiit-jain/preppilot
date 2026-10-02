import { useId } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme/theme-context';
import { Text } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  /** Validation message. Its presence puts the field into the error state. */
  readonly error?: string;
  readonly hint?: string;
  readonly required?: boolean;
}

export function TextField({ label, error, hint, required = false, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const hintId = useId();
  const hasError = typeof error === 'string' && error.length > 0;

  // A downloaded theme writes on a ruled line, or in a framed box.
  const field = theme.look?.components.textField;
  const lookInput =
    field === undefined || theme.look === null
      ? null
      : {
          fontFamily: theme.look.fonts.body.regular,
          ...(field.style === 'underline'
            ? {
                borderWidth: 0,
                borderBottomWidth: field.borderWidth,
                borderRadius: 0,
                paddingHorizontal: theme.spacing.xxs,
                backgroundColor: 'transparent',
                borderBottomColor: hasError ? theme.colors.danger : theme.colors.textMuted,
              }
            : {
                borderWidth: field.borderWidth,
                borderColor: hasError
                  ? theme.colors.danger
                  : field.borderWidth >= 2
                    ? theme.colors.textPrimary
                    : theme.colors.border,
              }),
        };

  return (
    <View style={styles.container}>
      <Text variant="small" tone="secondary" style={{ marginBottom: theme.spacing.xs }}>
        {label}
        {required ? ' *' : ''}
      </Text>

      <TextInput
        accessibilityLabel={label}
        // Screen readers announce the error or hint alongside the field itself.
        accessibilityHint={error ?? hint}
        aria-describedby={hasError || hint !== undefined ? hintId : undefined}
        aria-invalid={hasError}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            minHeight: theme.minTouchTarget,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            fontSize: theme.fontSize.body,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surfaceElevated,
            borderColor: hasError ? theme.colors.danger : theme.colors.border,
          },
          lookInput,
        ]}
        {...rest}
      />

      {(hasError || hint !== undefined) && (
        <Text
          nativeID={hintId}
          variant="caption"
          tone={hasError ? 'danger' : 'muted'}
          style={{ marginTop: theme.spacing.xs }}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
  },
});
