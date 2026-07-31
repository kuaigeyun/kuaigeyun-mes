/**
 * Altium .SchDoc 预览容器：拉取文件 + 解析 + SVG 渲染
 */

import React, { startTransition, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';
import { CadPreviewLoading } from '../cad-preview/CadPreviewLoading';
import { parseSchDocFromUuid, parseSchDocFromUrl } from '../../utils/schDocFileLoader';
import { yieldToMain } from '../../utils/yieldToMain';
import { PcbSvgViewer, type PcbSvgViewerRef } from '../pcb-preview/PcbSvgViewer';

export interface SchPreviewPaneProps {
  fileUuid?: string;
  fileUrl?: string;
  fileName?: string;
  height?: number | string;
  viewerRef?: React.Ref<PcbSvgViewerRef>;
  darkChrome?: boolean;
}

export const SchPreviewPane: React.FC<SchPreviewPaneProps> = ({
  fileUuid,
  fileUrl,
  fileName,
  height = '100%',
  viewerRef,
  darkChrome = false,
}) => {
  const { t } = useTranslation();
  const [svg, setSvg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!fileUuid && !fileUrl) {
      setSvg('');
      setError('');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setSvg('');
      await yieldToMain();
      try {
        const result = fileUuid
          ? await parseSchDocFromUuid(fileUuid, fileName)
          : await parseSchDocFromUrl(fileUrl!, fileName);
        if (cancelled) return;
        startTransition(() => {
          if (!cancelled) setSvg(result.svg);
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
  }, [fileUuid, fileUrl, fileName, t]);

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
          text={t('app.master-data.drawings.schPreviewLoading')}
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

  if (!svg) {
    return (
      <div style={{ ...paneStyle, minHeight: 280, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="warning" showIcon title={t('app.master-data.drawings.schPreviewEmpty')} />
      </div>
    );
  }

  return (
    <div style={paneStyle}>
      <PcbSvgViewer
        ref={viewerRef}
        svg={svg}
        height={height}
        svgHostClassName="sch2d-svg-host"
        background="#fffaf5"
      />
    </div>
  );
};
