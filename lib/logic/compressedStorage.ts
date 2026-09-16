import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import LZString from "lz-string";

const DEFLATE_PREFIX = "df1:";
const LEGACY_LZ_PREFIX = "lz16:";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 8192)));
  }
  return btoa(binary);
}

function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function encodeCompressedJson(value: unknown): string {
  return DEFLATE_PREFIX + toBase64(deflateSync(strToU8(JSON.stringify(value)), { level: 1 }));
}

export function decodeCompressedJson(serialized: string): any {
  if (serialized.startsWith(DEFLATE_PREFIX)) {
    return JSON.parse(strFromU8(inflateSync(fromBase64(serialized.slice(DEFLATE_PREFIX.length)))));
  }
  if (serialized.startsWith(LEGACY_LZ_PREFIX)) {
    const json = LZString.decompressFromUTF16(serialized.slice(LEGACY_LZ_PREFIX.length));
    if (json === null) throw new Error("Unable to decompress the saved career.");
    return JSON.parse(json);
  }
  return JSON.parse(serialized);
}
