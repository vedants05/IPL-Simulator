'use client';

import { useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { attachEdenModules, edenModuleAt, edenRegionsForObject } from './edenModules';
import type { StadiumViewerProps } from './types';

interface Props extends Pick<StadiumViewerProps, 'selected' | 'activeModuleIds' | 'onToggleModule'> {
  url: string;
}

export default function ImportedEdenStadium({ url, selected, activeModuleIds, onToggleModule }: Props) {
  const gltf = useLoader(GLTFLoader, url);
  const invalidate = useThree(state => state.invalidate);
  const adapter = useRef<ReturnType<typeof attachEdenModules> | null>(null);
  // Keep the uploaded asset and shared mesh resources untouched. The only
  // local correction is the requested lift of the opposite-end sight screen.
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const screen = clone.getObjectByName('North_black_slat_screen');
    if (screen) screen.position.y += 1;
    return clone;
  }, [gltf.scene]);

  useEffect(() => {
    const attached = attachEdenModules(scene);
    adapter.current = attached;
    return () => { attached.dispose(); adapter.current = null; };
  }, [scene]);
  useEffect(() => {
    adapter.current?.setState(selected,activeModuleIds);
    invalidate();
  }, [scene,selected,activeModuleIds,invalidate]);
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 5) return;
    const id = edenModuleAt(edenRegionsForObject(event.object),event.point);
    if (id !== undefined) onToggleModule(id);
  };

  return <primitive object={scene} dispose={null} onClick={select}/>;
}
