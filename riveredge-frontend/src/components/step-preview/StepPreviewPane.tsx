/**
 * STEP/STP 预览容器：拉取文件 + 解析 + 三维渲染
 */

import React, { startTransition, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';
import { CadPreviewLoading } from '../cad-preview/CadPreviewLoading';
import {
  parseStepFileFromUuid,
  parseStepFileFromUrl,
  preloadStepOcctModule,
  STEP_PREVIEW_TESSELLATION,
  type OcctMesh,
} from '../../utils/stepFileLoader';
import { yieldToMain } from '../../utils/yieldToMain';
import { StepModelViewer, type StepModelViewerRef } from './StepModelViewer';

export interface StepPreviewPaneProps {
  fileUuid?: string;
  fileUrl?: string;
  fileName?: string;
  fileExtension?: string;
  height?: number | string;
  showEdges?: boolean;
  /** 大图预览：显示 drei 视角方块等原生控件 */
  showControls?: boolean;
  viewerRef?: React.Ref<StepModelViewerRef>;
}

export const StepPreviewPane: React.FC<StepPreviewPaneProps> = ({
  fileUuid,
  fileUrl,
  fileName,
  fileExtension,
  height = '100%',
  showEdges = false,
  showControls = false,
  viewerRef,
}) => {
  const { t } = useTranslation();
  const [meshes, setMeshes] = useState<OcctMesh[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    preloadStepOcctModule();
  }, []);

  useEffect(() => {
    if (!fileUuid && !fileUrl) {
      setMeshes(null);
      setError('');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setMeshes(null);
      await yieldToMain();
      try {
        const parseOptions = {
          includeAssembly: false as const,
          tessellation: STEP_PREVIEW_TESSELLATION,
        };
        // UUID 鉴权直下优先，避免 preview_url 绝对地址指错主机导致 404
        const result = fileUuid
          ? await parseStepFileFromUuid(fileUuid, parseOptions)
          : await parseStepFileFromUrl(fileUrl!, parseOptions);
        if (!cancelled) {
          startTransition(() => {
            if (!cancelled) setMeshes(result.meshes);
          });
        }
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
  }, [fileUuid, fileUrl, t]);

  if (loading) {
    return (
      <div style={{ height, minHeight: 200, display: 'flex', flexDirection: 'column' }}>
        <CadPreviewLoading
          text={t('app.master-data.drawings.stepPreviewLoading')}
          tone={showControls ? 'light' : 'default'}
          minHeight={height}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height, minHeight: 200, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="error" title={error} showIcon />
      </div>
    );
  }

  if (!meshes?.length) {
    return (
      <div style={{ height, minHeight: 200, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="warning" showIcon title={t('app.master-data.drawings.stepPreviewEmpty')} />
      </div>
    );
  }

  return (
    <StepModelViewer
      ref={viewerRef}
      meshes={meshes}
      height={height}
      showEdges={showEdges}
      showGizmo={showControls}
    />
  );
};
