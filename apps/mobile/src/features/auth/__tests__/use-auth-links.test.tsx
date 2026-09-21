import { act, render } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../auth-store';
import { useAuthLinks } from '../use-auth-links';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
}));

const mockedLinking = Linking as jest.Mocked<typeof Linking>;
const completeAuthLink = jest.fn();
const remove = jest.fn();

function Listener() {
  useAuthLinks();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ completeAuthLink } as never);
  mockedLinking.getInitialURL.mockResolvedValue(null);
  mockedLinking.addEventListener.mockReturnValue({ remove } as never);
});

/**
 * Both halves matter, and for different journeys: a student who taps the link
 * with PrepPilot closed arrives through the initial URL, one who left it open
 * arrives through the listener. Handling only the second works in testing,
 * where the app is always already running, and fails for every fresh install.
 */
describe('confirmation links opening the app', () => {
  it('finishes a link that started the app', async () => {
    mockedLinking.getInitialURL.mockResolvedValue('preppilot://auth/callback?code=abc');

    render(<Listener />);
    await act(async () => {});

    expect(completeAuthLink).toHaveBeenCalledWith('preppilot://auth/callback?code=abc');
  });

  it('finishes a link that arrives while the app is already open', async () => {
    render(<Listener />);
    await act(async () => {});

    const onUrl = mockedLinking.addEventListener.mock.calls[0]![1] as (event: {
      url: string;
    }) => void;
    await act(async () => {
      onUrl({ url: 'preppilot://auth/callback?code=later' });
    });

    expect(completeAuthLink).toHaveBeenCalledWith('preppilot://auth/callback?code=later');
  });

  it('does nothing when the app was opened normally', async () => {
    render(<Listener />);
    await act(async () => {});

    expect(completeAuthLink).not.toHaveBeenCalled();
  });

  it('stops listening when it goes away', async () => {
    const tree = render(<Listener />);
    await act(async () => {});

    tree.unmount();

    expect(remove).toHaveBeenCalled();
  });
});
