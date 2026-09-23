import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * A picture a student attaches to a question: a textbook page, a worked
 * example, a diagram from the board.
 */
export interface ImageAttachment {
  /** For showing the picture in the conversation. */
  readonly uri: string;
  /** What the assistant reads. JPEG, without a data-URI prefix. */
  readonly base64: string;
  readonly mimeType: 'image/jpeg';
}

export type ImageSource = 'camera' | 'library';

export type PickImageResult =
  | { readonly ok: true; readonly image: ImageAttachment }
  | { readonly ok: false; readonly reason: 'cancelled' | 'denied' | 'failed' };

/**
 * The longest side a picture is sent at.
 *
 * A phone photo is 4000 pixels or more across and several megabytes, which is a
 * slow upload on mobile data and far more than the model needs to read a page
 * of text. At this size printed text stays legible and the request stays well
 * under a megabyte.
 */
export const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.7;

export async function pickImage(source: ImageSource): Promise<PickImageResult> {
  try {
    // The gallery goes through the system photo picker, which needs no
    // permission. Only the camera has to ask.
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { ok: false, reason: 'denied' };
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    const asset = picked.canceled ? undefined : picked.assets[0];
    if (asset === undefined) return { ok: false, reason: 'cancelled' };

    const context = ImageManipulator.manipulate(asset.uri);
    const longest = Math.max(asset.width, asset.height);
    if (longest > MAX_IMAGE_SIDE) {
      context.resize(
        asset.width >= asset.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE },
      );
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: JPEG_QUALITY,
      base64: true,
    });

    if (saved.base64 === undefined || saved.base64.length === 0) {
      return { ok: false, reason: 'failed' };
    }
    return {
      ok: true,
      image: { uri: saved.uri, base64: stripDataPrefix(saved.base64), mimeType: 'image/jpeg' },
    };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** The web build hands back a data URI where native gives bare base64. */
function stripDataPrefix(base64: string): string {
  const comma = base64.indexOf(',');
  return base64.startsWith('data:') && comma !== -1 ? base64.slice(comma + 1) : base64;
}

export const PICK_FAILURE_COPY: Record<'denied' | 'failed', string> = {
  denied:
    'PrepPilot needs camera access to take a photo. You can allow it in your phone’s settings.',
  failed: 'That picture could not be opened. Try another one.',
};
