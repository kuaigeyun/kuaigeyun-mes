/**
 * DWG/DXF 预览：拉取文件 + MLightCAD WebGL 渲染
 */

import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';
import { CadPreviewLoading } from '../cad-preview/CadPreviewLoading';
import { getFileExt, isDwgFile, isDxfFile, type FilePreviewSource } from '../../utils/filePreviewKind';
import { fetchCoreFileBytes } from '../../utils/fetchCoreFileBytes';
import { yieldToMain } from '../../utils/yieldToMain';
import { DwgCadViewer, type DwgSvgViewerRef } from './DwgCadViewer';

export type { DwgSvgViewerRef };

export interface DwgPreviewPaneProps {
  fileUuid?: string;
  fileUrl?: string;
  fileName?: string;
  fileExtension?: string;
  height?: number | string;
  viewerRef?: React.Ref<DwgSvgViewerRef>;
  /** 全屏深色预览时加载文案用浅色 */
  darkChrome?: boolean;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export const DwgPreviewPane: React.FC<DwgPreviewPaneProps> = ({
  fileUuid,
  fileUrl,
  fileName,
  fileExtension,
  height = '100%',
  viewerRef,
  darkChrome = false,
}) => {
  const { t } = useTranslation();
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cadExt = useMemo<'dwg' | 'dxf' | null>(() => {
    const source: FilePreviewSource = { fileName, fileExtension };
    if (isDwgFile(source)) return 'dwg';
    if (isDxfFile(source)) return 'dxf';
    const ext = getFileExt(source);
    if (ext === 'dwg' || ext === 'dxf') return ext;
    return null;
  }, [fileName, fileExtension]);

  useEffect(() => {
    if ((!fileUuid && !fileUrl) || !cadExt) {
      setFileBytes(null);
      setError('');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setFileBytes(null);
      await yieldToMain();
      try {
        const bytes = await fetchCoreFileBytes({
          fileUrl,
          fileUuid,
          errorLabel: 'CAD load failed',
        });
        if (cancelled) return;
        startTransition(() => {
          if (cancelled) return;
          setFileBytes(toArrayBuffer(bytes));
        });
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : t('app.master-data.drawings.previewFailed');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fileUuid, fileUrl, cadExt, t]);

  const openName = useMemo(() => {
    const fallbackExt = cadExt ?? 'dwg';
    const raw = fileName?.trim() || `drawing.${fallbackExt}`;
    if (/\.(dwg|dxf)$/i.test(raw)) return raw;
    return `${raw}.${fallbackExt}`;
  }, [cadExt, fileName]);

  const paneStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  };

  if (loading) {
    return (
      <div style={paneStyle}>
        <CadPreviewLoading
          text={t('app.master-data.drawings.dwgPreviewLoading')}
          tone={darkChrome ? 'light' : 'default'}
          minHeight={280}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...paneStyle, minHeight: 280, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="error" title={error} showIcon />
      </div>
    );
  }

  if (!fileBytes) {
    return (
      <div style={{ ...paneStyle, minHeight: 280, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="warning" showIcon title={t('app.master-data.drawings.dwgPreviewEmpty')} />
      </div>
    );
  }

  return (
    <div style={paneStyle}>
      <DwgCadViewer ref={viewerRef} fileName={openName} fileBytes={fileBytes} height={height} />
    </div>
  );
};
