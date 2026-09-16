import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EDEN_CAMERA_PRESETS, EDEN_MODEL_URLS } from '../components/club/stadiums/edenGardensAsset';

for (const preset of ['broadcast','pavilionRoad','maidan','river','construction'] as const) {
  const camera = EDEN_CAMERA_PRESETS[preset];
  assert(camera && camera.position.every(Number.isFinite) && camera.target.every(Number.isFinite));
}

for (const url of Object.values(EDEN_MODEL_URLS)) {
  const file = path.join(process.cwd(),'public',url.replace(/^\//,''));
  const header = fs.readFileSync(file).subarray(0,4).toString('ascii');
  assert.equal(header,'glTF',`${url} must be a binary glTF`);
}

console.log('Eden Gardens cameras and untouched source GLBs passed.');
