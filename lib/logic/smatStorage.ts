import { decodeCompressedJson, encodeCompressedJson } from "./compressedStorage";
import type { SmatCareerState } from "./smat";

export function parseSmatCareer(serialized: string): SmatCareerState {
  return decodeCompressedJson(serialized) as SmatCareerState;
}

export function serializeSmatCareer(career: SmatCareerState): string {
  return encodeCompressedJson(career);
}
