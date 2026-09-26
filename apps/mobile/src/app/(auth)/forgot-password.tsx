import { normalizeEmail, validateEmail } from '@preppilot/shared';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Text, TextField } from '../../components/ui';
import { AuthError } from '../../features/auth/components/auth-error';
import { AuthLayout } from '../../features/auth/components/auth-layout';
import { useAuthStore } from '../../features/auth/auth-store';

/**
 * Asks for a password-reset link.
 *
 * The link signs the student in on this phone and opens "Set a new password"
 * (see `recoveringPassword` in the auth store). The email typed on the sign-in
 * screen is carried over, so most students only have to tap once.
 */
export default function ForgotPasswordScreen() {
  const { sendPasswordReset, busy, error, clearError } = useAuthStore();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    clearError();
    const result = validateEmail(email);
    if (!result.valid) {
      setFieldError(result.message);
      return;
    }

    setFieldError(null);
    if (await sendPasswordReset(normalizeEmail(email))) setSent(true);
  };

  const backToSignIn = (
    <Link href="/login" asChild>
      <Text variant="small" tone="accent" accessibilityRole="link">
        Back to sign in
      </Text>
    </Link>
  );

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`If there is a PrepPilot account for ${normalizeEmail(email)}, we sent it a link to reset the password.`}
        footer={backToSignIn}
      >
        <Text variant="small" tone="muted">
          Open the link on this phone. PrepPilot will open and ask for your new password.
        </Text>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new password."
      footer={backToSignIn}
    >
      <AuthError message={fieldError ?? error} />

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void onSubmit()}
      />

      <Button
        label="Send reset link"
        onPress={() => void onSubmit()}
        loading={busy}
        fullWidth
        testID="send-reset-link"
      />
    </AuthLayout>
  );
}
