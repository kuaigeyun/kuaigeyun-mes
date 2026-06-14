/**
 * 图纸内嵌预览（宽屏右栏，复用 core files 预览能力）
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Empty, Image, Spin, theme } from 'antd';
import { getFileByUuid, getFilePreview } from '../../../services/file';
import { getFileExt, isCad2dFile, isImageFile, isPdfFile, isStepFile, type FilePreviewSource } from '../../../utils/filePreviewKind';
import { preloadStepOcctModule } from '../../../utils/stepFileLoader';

const StepPreviewPane = lazy(() =>
  import('../../../components/step-preview/StepPreviewPane').then((m) => ({ default: m.StepPreviewPane })),
);
const DwgPreviewPane = lazy(() =>
  import('../../../components/dwg-preview/DwgPreviewPane').then((m) => ({ default: m.DwgPreviewPane })),
);

export interface DrawingInlinePreviewProps {
  fileUuid?: string;
  fileName?: string;
  fileExtension?: string;
  fileType?: string;
  height?: number | string;
  /** 由外层容器提供边框时设为 true */
  chromeless?: boolean;
}

export const DrawingInlinePreview: React.FC<DrawingInlinePreviewProps> = ({
  fileUuid,
  fileName,
  fileExtension,
  fileType,
  chromeless = false,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metaLoading, setMetaLoading] = useState(false);

  const renderLoadingState = (text: string) => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <Spin size="large" />
        <div style={{ whiteSpace: 'nowrap', writingMode: 'horizontal-tb', textAlign: 'center' }}>{text}</div>
      </div>
    </div>
  );

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
  const isCad2d = isCad2dFile(fileSource);

  useEffect(() => {
    if (fileUuid && isStep) preloadStepOcctModule();
  }, [fileUuid, isStep]);

  useEffect(() => {
    if (!fileUuid || isStep || isCad2d) {
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
  }, [fileUuid, isStep, isCad2d, t]);

  const boxStyle: React.CSSProperties = chromeless
    ? {
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        overflow: 'hidden',
        background: token.colorBgContainer,
      };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  };

  const wrapPreview = (content: React.ReactNode) => (
    <div style={boxStyle}>
      <div style={contentStyle}>{content}</div>
    </div>
  );

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
    return wrapPreview(renderLoadingState(t('app.master-data.drawings.stepPreviewLoading')));
  }

  if (isStep) {
    return wrapPreview(
      <Suspense
        fallback={
          renderLoadingState(t('app.master-data.drawings.stepPreviewLoading'))
        }
      >
        <StepPreviewPane
          fileUuid={fileUuid}
          fileName={fileSource.fileName}
          fileExtension={fileSource.fileExtension}
          height="100%"
        />
      </Suspense>,
    );
  }

  if (isCad2d) {
    return wrapPreview(
      <Suspense
        fallback={
          renderLoadingState(t('app.master-data.drawings.dwgPreviewLoading'))
        }
      >
        <DwgPreviewPane
          fileUuid={fileUuid}
          fileName={fileSource.fileName}
          fileExtension={fileSource.fileExtension}
          height="100%"
        />
      </Suspense>,
    );
  }

  if (loading && !previewUrl) {
    return wrapPreview(
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>,
    );
  }

  if (error) {
    return wrapPreview(
      <div style={{ padding: 16 }}>
        <Alert type="error" title={error} showIcon />
      </div>,
    );
  }

  if (isImage && previewUrl) {
    return wrapPreview(
      <div style={{ flex: 1, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Image
          src={previewUrl}
          alt={fileName || 'drawing'}
          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
        />
      </div>,
    );
  }

  if (isPdf && previewUrl) {
    return wrapPreview(
      <iframe
        src={previewUrl}
        title={fileName || t('app.master-data.drawings.preview')}
        style={{ flex: 1, width: '100%', border: 'none' }}
      />,
    );
  }

  return wrapPreview(
    previewUrl ? (
      <iframe
        src={previewUrl}
        title={fileName || t('app.master-data.drawings.preview')}
        style={{ flex: 1, width: '100%', border: 'none' }}
      />
    ) : (
      <div style={{ padding: 16 }}>
        <Alert type="warning" showIcon title={t('app.master-data.drawings.previewUnsupported')} />
      </div>
    ),
  );
};
