import { firstFailure, validatePassword, validatePasswordConfirmation } from '@preppilot/shared';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Button, Text, TextField } from '../../components/ui';
import { AuthError } from '../../features/auth/components/auth-error';
import { AuthLayout } from '../../features/auth/components/auth-layout';
import { useAuthStore } from '../../features/auth/auth-store';

/**
 * Where a password-reset link ends up.
 *
 * The link has already signed the student in; this only asks for the new
 * password. Outside a reset there is nothing to do here, so it moves on, which
 * also covers a student who reopens the app after finishing.
 */
export default function NewPasswordScreen() {
  const { setNewPassword, skipNewPassword, busy, error, clearError } = useAuthStore();
  const status = useAuthStore((state) => state.status);
  const recovering = useAuthStore((state) => state.recoveringPassword);
  const email = useAuthStore((state) => state.user?.email ?? null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (status === 'signedOut') return <Redirect href="/login" />;
  if (!recovering) return <Redirect href="/" />;

  const onSubmit = async () => {
    clearError();
    const result = firstFailure(
      validatePassword(password),
      validatePasswordConfirmation(password, confirmation),
    );
    if (!result.valid) {
      setFieldError(result.message);
      return;
    }

    setFieldError(null);
    if (await setNewPassword(password)) router.replace('/');
  };

  const skip = () => {
    skipNewPassword();
    router.replace('/');
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={
        email === null
          ? 'Choose the password you will sign in with from now on.'
          : `Choose the password you will use to sign in as ${email}.`
      }
      footer={
        <Text variant="small" tone="accent" accessibilityRole="link" onPress={skip}>
          Not now
        </Text>
      }
    >
      <AuthError message={fieldError ?? error} />

      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint="Use at least 8 characters, including a letter and a number."
      />

      <TextField
        label="Confirm new password"
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="Re-enter your new password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        onSubmitEditing={() => void onSubmit()}
      />

      <Button
        label="Save new password"
        onPress={() => void onSubmit()}
        loading={busy}
        fullWidth
        testID="save-new-password"
      />
    </AuthLayout>
  );
}
