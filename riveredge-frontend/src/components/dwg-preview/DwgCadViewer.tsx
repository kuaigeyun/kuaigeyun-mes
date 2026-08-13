/**
 * DWG/DXF 预览：MLightCAD WebGL 渲染（真实线宽 / 填充 / 图块），不是 libredwg dwg_to_svg。
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  AcApDocManager,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE,
} from '@mlightcad/cad-simple-viewer';

export type DwgSvgViewerRef = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
};

export interface DwgCadViewerProps {
  fileName: string;
  fileBytes: ArrayBuffer;
  height?: number | string;
}

const ZOOM_FACTOR = 1.2;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 80;

function cadWorkerUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}cad-workers/${fileName}`;
}

function peekDocManager(): AcApDocManager | null {
  try {
    return AcApDocManager.instance;
  } catch (e) {
    if (e instanceof Error && e.message.includes('not created')) return null;
    throw e;
  }
}

let activeOwner: symbol | null = null;

export const DwgCadViewer = forwardRef<DwgSvgViewerRef, DwgCadViewerProps>(function DwgCadViewer(
  { fileName, fileBytes, height = '100%' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<AcApDocManager | null>(null);
  const [error, setError] = useState('');

  const withView = useCallback((fn: (manager: AcApDocManager) => void) => {
    const manager = managerRef.current;
    if (!manager) return;
    fn(manager);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      withView((manager) => {
        const camera = manager.curView.internalCamera;
        if (!camera) return;
        camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
        camera.updateProjectionMatrix();
      });
    },
    [withView],
  );

  const fitToView = useCallback(() => {
    withView((manager) => {
      manager.curView.zoomToFitDrawing();
    });
  }, [withView]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomBy(ZOOM_FACTOR),
      zoomOut: () => zoomBy(1 / ZOOM_FACTOR),
      fitToView,
    }),
    [fitToView, zoomBy],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !fileBytes.byteLength) return;

    const owner = Symbol('dwg-cad-viewer');
    let cancelled = false;

    const start = async () => {
      setError('');
      const previous = peekDocManager();
      if (previous) {
        await previous.destroy();
      }
      if (cancelled) return;

      const manager = AcApDocManager.createInstance({
        container,
        autoResize: true,
        builtinOpenFileDialog: false,
        webworkerFileUrls: {
          dwgParser: cadWorkerUrl(LIBREDWG_PARSER_WORKER_FILE),
          mtextRender: cadWorkerUrl(MTEXT_RENDERER_WORKER_FILE),
        },
      });
      if (!manager) {
        throw new Error('CAD viewer failed to start');
      }
      activeOwner = owner;
      managerRef.current = manager;

      const opened = await manager.openDocument(fileName, fileBytes, { readOnly: true });
      if (cancelled) return;
      if (!opened) {
        throw new Error('CAD open failed');
      }
    };

    void start().catch((e: unknown) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'CAD preview failed');
    });

    return () => {
      cancelled = true;
      managerRef.current = null;
      if (activeOwner !== owner) return;
      activeOwner = null;
      const manager = peekDocManager();
      if (manager) {
        void manager.destroy();
      }
    };
  }, [fileBytes, fileName]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.height = typeof height === 'number' ? `${height}px` : height;
  }, [height]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height,
        minHeight: 280,
        position: 'relative',
        overflow: 'hidden',
        background: '#1a1a1a',
      }}
    >
      {error ? (
        <div style={{ padding: 16, color: '#ffccc7' }}>{error}</div>
      ) : null}
    </div>
  );
});
