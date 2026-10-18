/** Web version of readFileBytes: the browser gives the photo as a blob: or data: address. */
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  const buffer = await (await fetch(uri)).arrayBuffer();
  if (buffer.byteLength === 0) throw new Error('The photo file is empty');
  return buffer;
}
