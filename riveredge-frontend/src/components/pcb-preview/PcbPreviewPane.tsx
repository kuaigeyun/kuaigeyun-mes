/**
 * Altium .PcbDoc 预览容器：拉取文件 + 解析 + SVG 渲染
 */

import React, { startTransition, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Segmented } from 'antd';
import { CadPreviewLoading } from '../cad-preview/CadPreviewLoading';
import {
  parsePcbDocFromUuid,
  parsePcbDocFromUrl,
  type PcbDocSide,
} from '../../utils/pcbDocFileLoader';
import { yieldToMain } from '../../utils/yieldToMain';
import { PcbSvgViewer, type PcbSvgViewerRef } from './PcbSvgViewer';

export interface PcbPreviewPaneProps {
  fileUuid?: string;
  fileUrl?: string;
  fileName?: string;
  side?: PcbDocSide;
  height?: number | string;
  viewerRef?: React.Ref<PcbSvgViewerRef>;
  darkChrome?: boolean;
  /** 外层工具栏已提供面切换时设为 false */
  showSideToggle?: boolean;
}

export const PcbPreviewPane: React.FC<PcbPreviewPaneProps> = ({
  fileUuid,
  fileUrl,
  fileName,
  side: sideProp = 'top',
  height = '100%',
  viewerRef,
  darkChrome = false,
  showSideToggle = true,
}) => {
  const { t } = useTranslation();
  const [svg, setSvg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [side, setSide] = useState<PcbDocSide>(sideProp);

  useEffect(() => {
    setSide(sideProp);
  }, [sideProp]);

  useEffect(() => {
    if ((!fileUuid && !fileUrl)) {
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
          ? await parsePcbDocFromUuid(fileUuid, fileName, side)
          : await parsePcbDocFromUrl(fileUrl!, fileName, undefined, side);
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
  }, [fileUuid, fileUrl, fileName, side, t]);

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
          text={t('app.master-data.drawings.pcbPreviewLoading')}
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
        <Alert type="warning" showIcon title={t('app.master-data.drawings.pcbPreviewEmpty')} />
      </div>
    );
  }

  return (
    <div style={paneStyle}>
      {showSideToggle ? (
        <div
          style={{
            flexShrink: 0,
            padding: darkChrome ? '8px 12px 0' : '8px 12px 0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Segmented
            size="small"
            value={side}
            options={[
              { label: t('app.master-data.drawings.pcbSideTop'), value: 'top' },
              { label: t('app.master-data.drawings.pcbSideBottom'), value: 'bottom' },
            ]}
            onChange={(value) => setSide(value as PcbDocSide)}
          />
        </div>
      ) : null}
      <PcbSvgViewer ref={viewerRef} svg={svg} height={height} />
    </div>
  );
};
