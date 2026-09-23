import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { MAX_IMAGE_SIDE, pickImage } from '../attach-image';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const manipulate = ImageManipulator.manipulate as jest.Mock;

const resize = jest.fn();
const saveAsync = jest.fn();

const asset = (width: number, height: number) =>
  ({ canceled: false, assets: [{ uri: 'file:///raw.jpg', width, height }] }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  resize.mockReset();
  saveAsync.mockResolvedValue({ uri: 'file:///small.jpg', base64: 'abc', width: 1, height: 1 });
  manipulate.mockReturnValue({ resize, renderAsync: async () => ({ saveAsync }) });
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.launchImageLibraryAsync.mockResolvedValue(asset(800, 600));
  picker.launchCameraAsync.mockResolvedValue(asset(800, 600));
});

it('returns the picture as JPEG base64', async () => {
  expect(await pickImage('library')).toEqual({
    ok: true,
    image: { uri: 'file:///small.jpg', base64: 'abc', mimeType: 'image/jpeg' },
  });
  expect(saveAsync).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg', base64: true }));
});

/** The gallery goes through the system photo picker, which needs no permission. */
it('opens the gallery without asking for a permission', async () => {
  await pickImage('library');

  expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  expect(picker.launchImageLibraryAsync).toHaveBeenCalled();
});

it('asks for the camera before opening it', async () => {
  await pickImage('camera');

  expect(picker.requestCameraPermissionsAsync).toHaveBeenCalled();
  expect(picker.launchCameraAsync).toHaveBeenCalled();
});

it('reports a refused camera', async () => {
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);

  expect(await pickImage('camera')).toEqual({ ok: false, reason: 'denied' });
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
});

it('reports backing out of the picker', async () => {
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

  expect(await pickImage('library')).toEqual({ ok: false, reason: 'cancelled' });
});

it('shrinks a large photo along its longest side', async () => {
  picker.launchImageLibraryAsync.mockResolvedValue(asset(4000, 3000));
  await pickImage('library');
  expect(resize).toHaveBeenCalledWith({ width: MAX_IMAGE_SIDE });

  picker.launchImageLibraryAsync.mockResolvedValue(asset(3000, 4000));
  await pickImage('library');
  expect(resize).toHaveBeenLastCalledWith({ height: MAX_IMAGE_SIDE });
});

it('leaves a small picture at its own size', async () => {
  await pickImage('library');

  expect(resize).not.toHaveBeenCalled();
});

it('strips the data-URI prefix the web build adds', async () => {
  saveAsync.mockResolvedValue({ uri: 'blob:x', base64: 'data:image/jpeg;base64,xyz' });

  const result = await pickImage('library');

  expect(result.ok && result.image.base64).toBe('xyz');
});

it('fails cleanly when the picture cannot be processed', async () => {
  saveAsync.mockResolvedValue({ uri: 'file:///x.jpg' });
  expect(await pickImage('library')).toEqual({ ok: false, reason: 'failed' });

  saveAsync.mockRejectedValue(new Error('decode error'));
  expect(await pickImage('library')).toEqual({ ok: false, reason: 'failed' });
});
