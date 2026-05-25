/**
 * 图纸内嵌预览（宽屏右栏，复用 core files 预览能力）
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Empty, Image, Spin } from 'antd';
import { getFileByUuid, getFilePreview } from '../../../services/file';
import { getFileExt, isImageFile, isPdfFile, isStepFile, type FilePreviewSource } from '../../../utils/filePreviewKind';

const StepPreviewPane = lazy(() =>
  import('../../../components/step-preview/StepPreviewPane').then((m) => ({ default: m.StepPreviewPane })),
);

export interface DrawingInlinePreviewProps {
  fileUuid?: string;
  fileName?: string;
  fileExtension?: string;
  fileType?: string;
  height?: number | string;
}

export const DrawingInlinePreview: React.FC<DrawingInlinePreviewProps> = ({
  fileUuid,
  fileName,
  fileExtension,
  fileType,
  height = '100%',
}) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metaLoading, setMetaLoading] = useState(false);

  const initialSource = useMemo<FilePreviewSource>(
    () => ({ fileName, fileExtension, fileType }),
    [fileName, fileExtension, fileType],
  );
  const [fileSource, setFileSource] = useState<FilePreviewSource>(initialSource);

  useEffect(() => {
    setFileSource(initialSource);
  }, [initialSource]);

  useEffect(() => {
    if (!fileUuid || getFileExt(initialSource)) return;
    let cancelled = false;
    setMetaLoading(true);
    void getFileByUuid(fileUuid)
      .then((f) => {
        if (cancelled) return;
        setFileSource({
          fileName: f.original_name,
          fileExtension: f.file_extension,
          fileType: f.file_type,
        });
      })
      .catch(() => {
        if (!cancelled) setFileSource(initialSource);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUuid, initialSource]);

  const isImage = isImageFile(fileSource);
  const isPdf = isPdfFile(fileSource);
  const isStep = isStepFile(fileSource);

  useEffect(() => {
    if (!fileUuid || isStep) {
      setPreviewUrl('');
      setError('');
      return;
    }
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const preview = await getFilePreview(fileUuid);
        if (!preview?.preview_url || preview.supported === false) {
          throw new Error(t('app.master-data.drawings.previewUnsupported'));
        }
        if (!cancelled) setPreviewUrl(preview.preview_url);
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
  }, [fileUuid, isStep, t]);

  const boxStyle: React.CSSProperties = {
    height,
    minHeight: 280,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--ant-color-border)',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--ant-color-bg-container)',
  };

  if (!fileUuid) {
    return (
      <div style={boxStyle}>
        <Empty
          style={{ margin: 'auto' }}
          description={t('app.master-data.drawings.selectRowToPreview')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  if (metaLoading) {
    return (
      <div style={{ ...boxStyle, alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip={t('app.master-data.drawings.stepPreviewLoading')} />
      </div>
    );
  }

  if (isStep) {
    return (
      <div style={boxStyle}>
        <Suspense
          fallback={
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin size="large" tip={t('app.master-data.drawings.stepPreviewLoading')} />
            </div>
          }
        >
          <StepPreviewPane
            fileUuid={fileUuid}
            fileName={fileSource.fileName}
            fileExtension={fileSource.fileExtension}
            height="100%"
          />
        </Suspense>
      </div>
    );
  }

  if (loading && !previewUrl) {
    return (
      <div style={{ ...boxStyle, alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...boxStyle, padding: 16 }}>
        <Alert type="error" message={error} showIcon />
      </div>
    );
  }

  if (isImage && previewUrl) {
    return (
      <div style={{ ...boxStyle, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          src={previewUrl}
          alt={fileName || 'drawing'}
          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  if (isPdf && previewUrl) {
    return (
      <div style={boxStyle}>
        <iframe
          src={previewUrl}
          title={fileName || t('app.master-data.drawings.preview')}
          style={{ flex: 1, width: '100%', border: 'none' }}
        />
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      {previewUrl ? (
        <iframe
          src={previewUrl}
          title={fileName || t('app.master-data.drawings.preview')}
          style={{ flex: 1, width: '100%', border: 'none' }}
        />
      ) : (
        <Alert type="warning" showIcon message={t('app.master-data.drawings.previewUnsupported')} />
      )}
    </div>
  );
};
