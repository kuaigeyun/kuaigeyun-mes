/**
 * 预览批注 Context：加载/保存、工具状态、形状列表
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { getFilePreviewMarkup, saveFilePreviewMarkup } from '../../services/filePreviewMarkup';
import {
  createEmptyMarkupPayload,
  createMarkupShapeId,
  type PreviewMarkupPayload,
  type PreviewMarkupScope,
  type PreviewMarkupShape,
  type PreviewMarkupTool,
} from '../../utils/previewMarkupTypes';

export type PreviewMarkupContextValue = {
  enabled: boolean;
  tool: PreviewMarkupTool;
  setTool: (tool: PreviewMarkupTool) => void;
  shapes: PreviewMarkupShape[];
  addShape: (shape: PreviewMarkupShape) => void;
  undo: () => void;
  clearAll: () => void;
  saveNow: () => Promise<void>;
  saving: boolean;
  loading: boolean;
  viewBox: string | null;
  setViewBox: (viewBox: string | null) => void;
  pendingTextPoint: { x: number; y: number } | null;
  beginTextAt: (point: { x: number; y: number }) => void;
  submitText: (text: string) => void;
  cancelText: () => void;
};

const PreviewMarkupContext = createContext<PreviewMarkupContextValue | null>(null);

export function usePreviewMarkup(): PreviewMarkupContextValue | null {
  return useContext(PreviewMarkupContext);
}

export interface PreviewMarkupProviderProps {
  fileUuid?: string;
  scope?: PreviewMarkupScope;
  children: React.ReactNode;
}

const SAVE_DEBOUNCE_MS = 800;

export const PreviewMarkupProvider: React.FC<PreviewMarkupProviderProps> = ({
  fileUuid,
  scope = 'default',
  children,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const enabled = Boolean(fileUuid);
  const [tool, setTool] = useState<PreviewMarkupTool>('pan');
  const [shapes, setShapes] = useState<PreviewMarkupShape[]>([]);
  const [viewBox, setViewBoxState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingTextPoint, setPendingTextPoint] = useState<{ x: number; y: number } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const shapesRef = useRef(shapes);
  const viewBoxRef = useRef(viewBox);

  shapesRef.current = shapes;
  viewBoxRef.current = viewBox;

  const buildPayload = useCallback((): PreviewMarkupPayload => {
    return {
      ...createEmptyMarkupPayload(viewBoxRef.current),
      shapes: shapesRef.current,
    };
  }, []);

  const persist = useCallback(
    async (showSuccess = false) => {
      if (!fileUuid) return;
      setSaving(true);
      try {
        await saveFilePreviewMarkup(fileUuid, buildPayload(), scope);
        if (showSuccess) {
          messageApi.success(t('app.master-data.drawings.markupSaved'));
        }
      } catch {
        messageApi.error(t('app.master-data.drawings.markupSaveFailed'));
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, fileUuid, messageApi, scope, t],
  );

  const scheduleSave = useCallback(() => {
    if (!fileUuid) return;
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persist(false);
    }, SAVE_DEBOUNCE_MS);
  }, [fileUuid, persist]);

  useEffect(() => {
    if (!fileUuid) {
      setShapes([]);
      setViewBoxState(null);
      setTool('pan');
      setPendingTextPoint(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getFilePreviewMarkup(fileUuid, scope)
      .then((res) => {
        if (cancelled) return;
        const payload = res.payload;
        setShapes(Array.isArray(payload?.shapes) ? payload.shapes : []);
        setViewBoxState(payload?.viewBox ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setShapes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [fileUuid, scope]);

  const setViewBox = useCallback((next: string | null) => {
    setViewBoxState(next);
  }, []);

  const addShape = useCallback(
    (shape: PreviewMarkupShape) => {
      setShapes((prev) => [...prev, shape]);
      scheduleSave();
    },
    [scheduleSave],
  );

  const undo = useCallback(() => {
    setShapes((prev) => (prev.length ? prev.slice(0, -1) : prev));
    scheduleSave();
  }, [scheduleSave]);

  const clearAll = useCallback(() => {
    setShapes([]);
    scheduleSave();
  }, [scheduleSave]);

  const beginTextAt = useCallback((point: { x: number; y: number }) => {
    setPendingTextPoint(point);
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!pendingTextPoint || !trimmed) {
        setPendingTextPoint(null);
        setTool('pan');
        return;
      }
      addShape({
        id: createMarkupShapeId(),
        type: 'text',
        x: pendingTextPoint.x,
        y: pendingTextPoint.y,
        text: trimmed,
        fill: '#e53935',
        fontSize: 14,
      });
      setPendingTextPoint(null);
      setTool('pan');
    },
    [addShape, pendingTextPoint],
  );

  const cancelText = useCallback(() => {
    setPendingTextPoint(null);
    setTool('pan');
  }, []);

  const value = useMemo<PreviewMarkupContextValue>(
    () => ({
      enabled,
      tool,
      setTool,
      shapes,
      addShape,
      undo,
      clearAll,
      saveNow: () => persist(true),
      saving,
      loading,
      viewBox,
      setViewBox,
      pendingTextPoint,
      beginTextAt,
      submitText,
      cancelText,
    }),
    [
      enabled,
      tool,
      shapes,
      addShape,
      undo,
      clearAll,
      persist,
      saving,
      loading,
      viewBox,
      pendingTextPoint,
      beginTextAt,
      submitText,
      cancelText,
    ],
  );

  return <PreviewMarkupContext.Provider value={value}>{children}</PreviewMarkupContext.Provider>;
};
