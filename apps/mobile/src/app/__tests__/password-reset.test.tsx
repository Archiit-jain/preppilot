import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { renderWithTheme } from '../../test-utils/render';
import { resetAuthStore, useAuthStore } from '../../features/auth/auth-store';
import ForgotPasswordScreen from '../(auth)/forgot-password';
import NewPasswordScreen from '../auth/new-password';

jest.mock('../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));
jest.mock('../../features/auth/google', () => ({
  signInWithGoogle: jest.fn(),
  forgetGoogleAccount: jest.fn(),
}));

const mockedParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const sendPasswordReset = jest.fn();
const setNewPassword = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  resetAuthStore();
  mockedParams.mockReturnValue({});
  sendPasswordReset.mockResolvedValue(true);
  setNewPassword.mockResolvedValue(true);
  useAuthStore.setState({ sendPasswordReset, setNewPassword });
});

describe('asking for a reset link', () => {
  it('carries over the email typed on the sign-in screen', () => {
    mockedParams.mockReturnValue({ email: 'ada@example.com' });

    renderWithTheme(<ForgotPasswordScreen />);

    expect(screen.getByDisplayValue('ada@example.com')).toBeOnTheScreen();
  });

  it('checks the address before asking the server', async () => {
    renderWithTheme(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await act(async () => {
      fireEvent.press(screen.getByTestId('send-reset-link'));
    });

    expect(sendPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });

  it('sends the link and says where to open it', async () => {
    renderWithTheme(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByLabelText('Email'), '  Ada@Example.com ');
    await act(async () => {
      fireEvent.press(screen.getByTestId('send-reset-link'));
    });

    expect(sendPasswordReset).toHaveBeenCalledWith('ada@example.com');
    expect(screen.getByText('Check your email')).toBeOnTheScreen();
    expect(screen.getByText(/Open the link on this phone/)).toBeOnTheScreen();
  });

  it('stays on the form when sending fails', async () => {
    sendPasswordReset.mockResolvedValue(false);
    renderWithTheme(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByLabelText('Email'), 'ada@example.com');
    await act(async () => {
      fireEvent.press(screen.getByTestId('send-reset-link'));
    });

    expect(screen.queryByText('Check your email')).toBeNull();
  });
});

describe('choosing the new password', () => {
  const recovering = () =>
    useAuthStore.setState({
      status: 'signedIn',
      recoveringPassword: true,
      user: { id: 'u1', email: 'ada@example.com' } as never,
    });

  it('names the account being reset', () => {
    recovering();

    renderWithTheme(<NewPasswordScreen />);

    expect(screen.getByText(/sign in as ada@example.com/)).toBeOnTheScreen();
  });

  it('shows nothing outside a reset', () => {
    useAuthStore.setState({ status: 'signedIn', recoveringPassword: false });

    renderWithTheme(<NewPasswordScreen />);

    expect(screen.queryByText('Set a new password')).toBeNull();
  });

  it('shows nothing to a signed-out student', () => {
    useAuthStore.setState({ status: 'signedOut', recoveringPassword: true });

    renderWithTheme(<NewPasswordScreen />);

    expect(screen.queryByText('Set a new password')).toBeNull();
  });

  it('refuses two passwords that differ', async () => {
    recovering();
    renderWithTheme(<NewPasswordScreen />);

    fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123');
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'newpass124');
    await act(async () => {
      fireEvent.press(screen.getByTestId('save-new-password'));
    });

    expect(setNewPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });

  it('saves it and opens the app', async () => {
    recovering();
    renderWithTheme(<NewPasswordScreen />);

    fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123');
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'newpass123');
    await act(async () => {
      fireEvent.press(screen.getByTestId('save-new-password'));
    });

    expect(setNewPassword).toHaveBeenCalledWith('newpass123');
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('stays put when saving fails', async () => {
    setNewPassword.mockResolvedValue(false);
    recovering();
    renderWithTheme(<NewPasswordScreen />);

    fireEvent.changeText(screen.getByLabelText('New password'), 'newpass123');
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'newpass123');
    await act(async () => {
      fireEvent.press(screen.getByTestId('save-new-password'));
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('can be put off', () => {
    recovering();
    renderWithTheme(<NewPasswordScreen />);

    fireEvent.press(screen.getByText('Not now'));

    expect(useAuthStore.getState().recoveringPassword).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
