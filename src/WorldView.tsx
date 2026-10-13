import { useEffect, useRef, useState } from 'react';
import type { WorldController, WorldSnapshot } from './world';

declare global {
  interface Window {
    readonly __lushan?: { readonly state: WorldSnapshot | null };
  }
}

interface WorldViewProps {
  view: string;
  viewRevision: number;
  paused: boolean;
  reducedMotion: boolean;
  onExplore: () => void;
  onArrive: () => void;
}

export function WorldView({ view, viewRevision, paused, reducedMotion, onExplore, onArrive }: WorldViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<WorldController | null>(null);
  const latestProps = useRef({ view, paused, reducedMotion, onExplore, onArrive });
  latestProps.current = { view, paused, reducedMotion, onExplore, onArrive };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [failure, setFailure] = useState('');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let active = true;
    let world: WorldController | null = null;
    setStatus('loading');
    Object.defineProperty(window, '__lushan', {
      configurable: true,
      get: () => ({ get state() { return controllerRef.current?.snapshot() ?? null; } }),
    });
    import('./world').then(({ createWorld }) => {
      if (!active || !hostRef.current) return;
      try {
        world = createWorld(hostRef.current, {
          initialView: latestProps.current.view,
          paused: latestProps.current.paused,
          reducedMotion: latestProps.current.reducedMotion,
          onReady: () => {
            if (active) {
              setStatus('ready');
              latestProps.current.onArrive();
            }
          },
          onFailure: (message) => {
            if (active) { setFailure(message); setStatus('error'); }
          },
          onRestored: () => { if (active) setGeneration((value) => value + 1); },
          onExplore: () => latestProps.current.onExplore(),
          onArrive: () => latestProps.current.onArrive(),
        });
        controllerRef.current = world;
      } catch {
        if (active) {
          setFailure('此浏览器暂时无法打开 3D 山水。可以尝试重新进入，或在支持 WebGL 的浏览器中打开。');
          setStatus('error');
        }
      }
    }).catch(() => {
      if (active) {
        setFailure('山水加载未完成，请检查连接后重新进入。');
        setStatus('error');
      }
    });
    return () => {
      active = false;
      world?.dispose();
      if (controllerRef.current === world) controllerRef.current = null;
      Reflect.deleteProperty(window, '__lushan');
    };
  }, [generation]);

  useEffect(() => { controllerRef.current?.selectView(view); }, [view, viewRevision]);
  useEffect(() => { controllerRef.current?.setMotion(paused, reducedMotion); }, [paused, reducedMotion]);

  return (
    <div className="world-wrapper" data-status={status}>
      <div ref={hostRef} className="world-host" />
      {status === 'loading' && (
        <div className="scene-message loading-message" role="status">
          <span className="loading-mark" aria-hidden="true"><i /><i /><i /></span>
          <p>正在走进山水</p>
          <small>让一首诗，慢慢有了形状</small>
        </div>
      )}
      {status === 'error' && (
        <div className="scene-message error-message" role="alert">
          <span className="error-symbol" aria-hidden="true">山</span>
          <p>山水暂歇，诗意仍在</p>
          <small>{failure}</small>
          <button className="restore-button" onClick={() => setGeneration((value) => value + 1)}>重新进入山水</button>
        </div>
      )}
    </div>
  );
}
