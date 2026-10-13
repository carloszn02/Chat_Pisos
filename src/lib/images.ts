/** Shrinking photos on the phone before uploading them. */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

export type PreparedImage = { uri: string; mimeType: string };

/**
 * Resizes a photo so its longest side is at most `maxSide` pixels and saves it as a JPEG.
 * A phone photo of 3–8 MB typically becomes ~200–400 KB with no visible difference.
 * If anything goes wrong, the original photo is used instead.
 */
export async function shrinkImage(
  asset: ImagePickerAsset,
  maxSide: number
): Promise<PreparedImage> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > maxSide) {
      context.resize(asset.width >= asset.height ? { width: maxSide } : { height: maxSide });
    }
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    return { uri: result.uri, mimeType: 'image/jpeg' };
  } catch (error) {
    console.warn('Could not shrink photo, uploading the original', error);
    return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
  }
}
