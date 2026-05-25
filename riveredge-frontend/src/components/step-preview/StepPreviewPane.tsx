/**
 * STEP/STP 预览容器：拉取文件 + 解析 + 三维渲染
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Spin } from 'antd';
import { getFilePreview } from '../../services/file';
import { parseStepFileFromUrl, type OcctMesh } from '../../utils/stepFileLoader';
import { StepModelViewer } from './StepModelViewer';

export interface StepPreviewPaneProps {
  fileUuid?: string;
  fileUrl?: string;
  fileName?: string;
  fileExtension?: string;
  height?: number | string;
  showEdges?: boolean;
}

export const StepPreviewPane: React.FC<StepPreviewPaneProps> = ({
  fileUuid,
  fileUrl,
  fileName,
  fileExtension,
  height = '100%',
  showEdges = false,
}) => {
  const { t } = useTranslation();
  const [meshes, setMeshes] = useState<OcctMesh[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      try {
        let url = fileUrl;
        if (!url && fileUuid) {
          const preview = await getFilePreview(fileUuid);
          if (!preview?.preview_url) {
            throw new Error(t('app.master-data.drawings.previewUnsupported'));
          }
          url = preview.preview_url;
        }
        const result = await parseStepFileFromUrl(url!);
        if (!cancelled) setMeshes(result.meshes);
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
      <div
        style={{
          height,
          minHeight: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--ant-color-fill-quaternary, #f5f5f5)',
        }}
      >
        <Spin tip={t('app.master-data.drawings.stepPreviewLoading')} size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height, minHeight: 200, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="error" message={error} showIcon />
      </div>
    );
  }

  if (!meshes?.length) {
    return (
      <div style={{ height, minHeight: 200, padding: 16, boxSizing: 'border-box' }}>
        <Alert type="warning" showIcon message={t('app.master-data.drawings.stepPreviewEmpty')} />
      </div>
    );
  }

  return <StepModelViewer meshes={meshes} height={height} showEdges={showEdges} />;
};
