import { File } from 'expo-file-system';

/**
 * Reads a photo on the phone (a file:// address from the photo picker) so it can be
 * uploaded. Uses Expo's file reader, which is reliable on both iPhone and Android.
 * Web version: file-bytes.web.ts.
 */
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  const bytes = await new File(uri).bytes();
  if (bytes.byteLength === 0) throw new Error('The photo file is empty');
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
