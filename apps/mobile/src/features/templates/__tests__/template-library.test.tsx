import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { templatesBaseUrl } from '../../../config/env';
import { renderWithTheme } from '../../../test-utils/render';
import { useAuthStore } from '../../auth/auth-store';
import {
  LIBRARY_TIMEOUT_MS,
  resetTemplateLibraryStore,
  useTemplateLibraryStore,
} from '../template-library-store';
import { TemplatesScreen } from '../templates-screen';

jest.mock('../../../db/client', () => ({ getRepositories: jest.fn(() => ({})) }));
jest.mock('../../../lib/supabase', () => ({
  getSupabase: jest.fn(),
  startAutoRefresh: jest.fn(() => jest.fn()),
}));
jest.mock('../../../config/env', () => ({
  ...jest.requireActual('../../../config/env'),
  templatesBaseUrl: jest.fn(),
}));

const BASE = 'https://example.supabase.co/storage/v1/object/public/templates/';
const entry = {
  id: 'gate-civil',
  name: 'GATE Civil Engineering',
  description: 'General Aptitude and the full Civil Engineering paper syllabus.',
  category: 'exam',
  source: 'GATE 2026 official syllabus (CE)',
  verified: false,
  counts: { subjects: 2, chapters: 3, topics: 4 },
  subjects: ['General Aptitude', 'Geotechnical Engineering'],
  version: 1,
  path: 'templates/gate-civil.json',
};
const template = {
  format: 1,
  id: 'gate-civil',
  name: 'GATE Civil Engineering',
  description: entry.description,
  category: 'exam',
  source: entry.source,
  verified: false,
  subjects: [
    {
      name: 'Geotechnical Engineering',
      chapters: [{ name: 'Soil Mechanics', topics: ['Phase relationships'] }],
    },
  ],
};

const fetchMock = jest.fn();
const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) });
const store = () => useTemplateLibraryStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  resetTemplateLibraryStore();
  global.fetch = fetchMock as never;
  jest.mocked(templatesBaseUrl).mockReturnValue(BASE);
  useAuthStore.setState({ user: { id: 'u1' } as never, status: 'signedIn' });
});

describe('the library store', () => {
  it('lists the online templates', async () => {
    fetchMock.mockReturnValue(respond({ format: 1, templates: [entry] }));

    await store().load();

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}catalog.json`, expect.anything());
    expect(store().status).toBe('ready');
    expect(store().entries.map((e) => e.id)).toEqual(['gate-civil']);
  });

  it('is unavailable without a server, and says when the list fails', async () => {
    jest.mocked(templatesBaseUrl).mockReturnValueOnce(null);
    await store().load();
    expect(store().status).toBe('unavailable');

    fetchMock.mockReturnValue(respond({}, false));
    await store().load();
    expect(store().status).toBe('failed');
  });

  it('downloads a template once, then reuses it', async () => {
    fetchMock.mockReturnValue(respond(template));
    const parsed = (await store().load(), store().entries);
    void parsed;

    const first = await store().open(entry as never);
    const second = await store().open(entry as never);

    expect(first?.subjects[0]?.chapters[0]?.topics).toEqual([{ name: 'Phase relationships' }]);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}templates/gate-civil.json`, expect.anything());
  });

  it('explains a failed download, and refuses a mismatched or second one', async () => {
    fetchMock.mockReturnValue(respond({ ...template, id: 'other-id' }));
    expect(await store().open(entry as never)).toBeNull();
    expect(store().error).toBe(
      "Couldn't download GATE Civil Engineering. Check your connection and try again.",
    );
    store().clearError();
    expect(store().error).toBeNull();

    useTemplateLibraryStore.setState({ opening: 'something' });
    expect(await store().open(entry as never)).toBeNull();
    useTemplateLibraryStore.setState({ opening: null });
    jest.mocked(templatesBaseUrl).mockReturnValueOnce(null);
    expect(await store().open(entry as never)).toBeNull();
  });

  it('gives up on a server that never answers', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );

    const pending = store().load();
    jest.advanceTimersByTime(LIBRARY_TIMEOUT_MS);
    await pending;
    jest.useRealTimers();

    expect(store().status).toBe('failed');
  });
});

describe('online templates on the Templates screen', () => {
  it('lists them after the built-in ones, finds them by subject, and opens a preview', async () => {
    fetchMock.mockImplementation((url: string) =>
      respond(url.endsWith('catalog.json') ? { format: 1, templates: [entry] } : template),
    );
    renderWithTheme(<TemplatesScreen />);
    await waitFor(() => expect(store().status).toBe('ready'));
    fireEvent.press(screen.getByTestId('category-engineering'));

    expect(screen.getByTestId('template-gate-civil')).toBeOnTheScreen();
    expect(screen.getByText(/· online/)).toBeOnTheScreen();

    fireEvent.changeText(screen.getByTestId('template-search'), 'geotechnical');
    expect(screen.getByTestId('template-gate-civil')).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('template-gate-civil'));
    });
    await waitFor(() =>
      expect(screen.getAllByText('Soil Mechanics · 1 topics').length).toBeGreaterThan(0),
    );
  });

  it('hides them under a filter they do not belong to', async () => {
    fetchMock.mockReturnValue(respond({ format: 1, templates: [entry] }));
    renderWithTheme(<TemplatesScreen />);
    await waitFor(() => expect(store().status).toBe('ready'));
    fireEvent.press(screen.getByTestId('category-engineering'));
    expect(screen.getByTestId('template-gate-civil')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('library-all-categories'));
    fireEvent.press(screen.getByTestId('category-school'));

    expect(screen.queryByTestId('template-gate-civil')).toBeNull();
  });

  it('shows progress, failure and retry', async () => {
    useTemplateLibraryStore.setState({ status: 'loading' });
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = renderWithTheme(<TemplatesScreen />);
    expect(screen.getByTestId('library-loading')).toBeOnTheScreen();

    act(() => {
      useTemplateLibraryStore.setState({
        status: 'failed',
        error: 'Could not download.',
        entries: [entry as never],
        opening: 'gate-civil',
      });
    });
    rerender(<TemplatesScreen />);
    fireEvent.changeText(screen.getByTestId('template-search'), 'gate civil');
    expect(screen.getByTestId('library-failed')).toBeOnTheScreen();
    expect(screen.getByTestId('library-error')).toBeOnTheScreen();
    expect(screen.getByText('Downloading…')).toBeOnTheScreen();

    fetchMock.mockReturnValue(respond({ format: 1, templates: [] }));
    await act(async () => {
      fireEvent.press(screen.getByTestId('library-retry'));
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('stays on the list when a download fails', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('catalog.json')
        ? respond({ format: 1, templates: [entry] })
        : respond({}, false),
    );
    renderWithTheme(<TemplatesScreen />);
    await waitFor(() => expect(store().status).toBe('ready'));
    fireEvent.changeText(screen.getByTestId('template-search'), 'gate civil');

    await act(async () => {
      fireEvent.press(screen.getByTestId('template-gate-civil'));
    });

    expect(screen.getByTestId('library-error')).toBeOnTheScreen();
    expect(screen.queryByText('Soil Mechanics · 1 topics')).toBeNull();
  });
});
