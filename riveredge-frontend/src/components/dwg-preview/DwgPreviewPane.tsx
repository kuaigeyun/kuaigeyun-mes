/**
 * DWG/DXF 预览容器：拉取文件 + 解析 + SVG 渲染
 */

import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';
import { CadPreviewLoading } from '../cad-preview/CadPreviewLoading';
import { getFileExt, isDwgFile, isDxfFile, type FilePreviewSource } from '../../utils/filePreviewKind';
import { parseCad2dFromUuid, parseCad2dFromUrl } from '../../utils/cad2dFileLoader';
import { yieldToMain } from '../../utils/yieldToMain';
import { DwgSvgViewer, type DwgSvgViewerRef } from './DwgSvgViewer';

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
  const [svg, setSvg] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
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
      setSvg('');
      setImageDataUrl('');
      setError('');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setSvg('');
      setImageDataUrl('');
      await yieldToMain();
      try {
        const result = fileUuid
          ? await parseCad2dFromUuid(fileUuid, cadExt)
          : await parseCad2dFromUrl(fileUrl!, cadExt);
        if (cancelled) return;
        startTransition(() => {
          if (cancelled) return;
          setSvg(result.svg ?? '');
          setImageDataUrl(result.imageDataUrl ?? '');
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

  if (!svg && !imageDataUrl) {
    return (
      <div style={{ ...paneStyle, minHeight: 280, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="warning" showIcon title={t('app.master-data.drawings.dwgPreviewEmpty')} />
      </div>
    );
  }

  return (
    <div style={paneStyle}>
      <DwgSvgViewer ref={viewerRef} svg={svg} imageDataUrl={imageDataUrl} height={height} />
    </div>
  );
};
