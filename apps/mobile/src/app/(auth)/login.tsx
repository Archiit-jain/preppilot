import { firstFailure, normalizeEmail, validateEmail, validatePassword } from '@preppilot/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextField } from '../../components/ui';
import { AuthAlternatives } from '../../features/auth/components/auth-alternatives';
import { AuthError } from '../../features/auth/components/auth-error';
import { AuthLayout } from '../../features/auth/components/auth-layout';
import { useAuthStore } from '../../features/auth/auth-store';

export default function LoginScreen() {
  const { signInWithPassword, busy, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const onSubmit = async () => {
    clearError();
    // Validate locally first: a malformed email should not cost a round trip,
    // and the student gets the answer immediately.
    const result = firstFailure(validateEmail(email), validatePassword(password));
    if (!result.valid) {
      setFieldError(result.message);
      return;
    }

    setFieldError(null);
    await signInWithPassword(normalizeEmail(email), password);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <Link href="/register" asChild>
          <Text variant="small" tone="accent" accessibilityRole="link">
            New to PrepPilot? Create an account
          </Text>
        </Link>
      }
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
        returnKeyType="next"
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void onSubmit()}
      />

      <View style={styles.forgot}>
        {/* The email typed so far goes along, so it need not be typed twice. */}
        <Link href={{ pathname: '/forgot-password', params: { email: email.trim() } }} asChild>
          <Text variant="small" tone="accent" accessibilityRole="link">
            Forgot password?
          </Text>
        </Link>
      </View>

      <Button label="Sign in" onPress={() => void onSubmit()} loading={busy} fullWidth />

      <AuthAlternatives />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignItems: 'flex-end', marginTop: -4 },
});
