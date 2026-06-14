/**
 * DWG/DXF 预览容器：拉取文件 + 解析 + SVG 渲染
 */

import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Spin } from 'antd';
import { getFilePreview } from '../../services/file';
import { getFileExt, isDwgFile, isDxfFile, type FilePreviewSource } from '../../utils/filePreviewKind';
import { parseCad2dFromUrl } from '../../utils/cad2dFileLoader';
import { yieldToMain } from '../../utils/yieldToMain';
import { DwgSvgViewer, type DwgSvgViewerRef } from './DwgSvgViewer';

export interface DwgPreviewPaneProps {
  fileUuid?: string;
  fileUrl?: string;
  fileName?: string;
  fileExtension?: string;
  height?: number | string;
  viewerRef?: React.Ref<DwgSvgViewerRef>;
}

export const DwgPreviewPane: React.FC<DwgPreviewPaneProps> = ({
  fileUuid,
  fileUrl,
  fileName,
  fileExtension,
  height = '100%',
  viewerRef,
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
        let url = fileUrl;
        if (!url && fileUuid) {
          const preview = await getFilePreview(fileUuid);
          if (!preview?.preview_url) {
            throw new Error(t('app.master-data.drawings.previewUnsupported'));
          }
          url = preview.preview_url;
        }
        const result = await parseCad2dFromUrl(url!, cadExt);
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
      <div style={{ ...paneStyle, minHeight: 280, alignItems: 'center', justifyContent: 'center', background: 'var(--ant-color-fill-quaternary, #f5f5f5)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Spin size="large" />
          <div style={{ whiteSpace: 'nowrap', writingMode: 'horizontal-tb', textAlign: 'center' }}>
            {t('app.master-data.drawings.dwgPreviewLoading')}
          </div>
        </div>
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
