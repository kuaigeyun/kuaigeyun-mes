import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Spin, Alert, Image } from 'antd';
import {
  BorderOutlined,
  CompressOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getFileByUuid, getFilePreview } from '../../services/file';
import { PreviewOverlayToolButton, UniPdfPreview, UniPreviewOverlay } from '../uni-preview';
import { getFileExt, isCad2dFile, isImageFile, isPdfFile, isStepFile, type FilePreviewSource } from '../../utils/filePreviewKind';
import type { DwgSvgViewerRef } from '../dwg-preview/DwgSvgViewer';
import type { StepModelViewerRef } from '../step-preview/StepModelViewer';

const StepPreviewPane = lazy(() =>
  import('../step-preview/StepPreviewPane').then((m) => ({ default: m.StepPreviewPane })),
);
const DwgPreviewPane = lazy(() =>
  import('../dwg-preview/DwgPreviewPane').then((m) => ({ default: m.DwgPreviewPane })),
);

type FilePreviewSource = {
  fileUuid?: string;
  url?: string;
  fileName?: string;
  fileType?: string;
  fileExtension?: string;
};

export interface FilePreviewModalProps extends FilePreviewSource {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: string | number;
  height?: string | number;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  open,
  onClose,
  fileUuid,
  url,
  fileName,
  fileType,
  fileExtension,
  title,
  width = '88vw',
  height = '72vh',
}) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [stepShowEdges, setStepShowEdges] = useState(true);
  const stepViewerRef = useRef<StepModelViewerRef>(null);
  const dwgViewerRef = useRef<DwgSvgViewerRef>(null);

  const initialSource = useMemo<FilePreviewSource>(
    () => ({ fileName, fileType, fileExtension }),
    [fileName, fileType, fileExtension],
  );
  const [fileSource, setFileSource] = useState<FilePreviewSource>(initialSource);

  useEffect(() => {
    setFileSource(initialSource);
  }, [initialSource]);

  useEffect(() => {
    if (!open || !fileUuid || getFileExt(initialSource)) return;
    let cancelled = false;
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
      });
    return () => {
      cancelled = true;
    };
  }, [open, fileUuid, initialSource]);

  const isImage = isImageFile(fileSource);
  const isPdf = isPdfFile(fileSource);
  const isStep = isStepFile(fileSource);
  const isCad2d = isCad2dFile(fileSource);

  useEffect(() => {
    if (!open || isStep || isCad2d) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        if (url) {
          if (!cancelled) setPreviewUrl(url);
          return;
        }
        if (!fileUuid) {
          throw new Error(t('app.master-data.drawings.previewFailed'));
        }
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
  }, [open, fileUuid, url, isStep, isCad2d, t]);

  useEffect(() => {
    if (!open || !previewUrl || !isPdf) {
      return;
    }

    let cancelled = false;
    let objectUrl = '';

    const loadPdfBlob = async () => {
      setPdfLoading(true);
      try {
        const response = await fetch(previewUrl, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`PDF load failed: ${response.status}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setPdfBlobUrl(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setPdfBlobUrl('');
        }
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    };

    void loadPdfBlob();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setPdfBlobUrl('');
    };
  }, [open, previewUrl, isPdf]);

  const appendPdfViewerParams = (src: string) => {
    if (!src) return src;
    const hash = src.includes('#') ? src.slice(src.indexOf('#') + 1) : '';
    const params = new URLSearchParams(hash);
    params.set('toolbar', '1');
    params.set('navpanes', '0');
    return `${src.split('#')[0]}#${params.toString()}`;
  };

  const stepToolbar = (
    <>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewFitView')}
        onClick={() => stepViewerRef.current?.resetView()}
      >
        <CompressOutlined />
        {t('app.master-data.drawings.previewFitView')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewToggleEdges')}
        active={stepShowEdges}
        onClick={() => setStepShowEdges((value) => !value)}
      >
        <BorderOutlined />
        {t('app.master-data.drawings.previewToggleEdges')}
      </PreviewOverlayToolButton>
    </>
  );

  const dwgToolbar = (
    <>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewZoomOut')}
        onClick={() => dwgViewerRef.current?.zoomOut()}
      >
        <ZoomOutOutlined />
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewFitView')}
        onClick={() => dwgViewerRef.current?.fitToView()}
      >
        <CompressOutlined />
        {t('app.master-data.drawings.previewFitView')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewZoomIn')}
        onClick={() => dwgViewerRef.current?.zoomIn()}
      >
        <ZoomInOutlined />
      </PreviewOverlayToolButton>
    </>
  );

  if (open && isStep) {
    return (
      <UniPreviewOverlay
        open={open}
        onClose={onClose}
        title={title || fileName || t('app.master-data.drawings.preview')}
        inset={16}
        extra={stepToolbar}
      >
        <Suspense
          fallback={
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin tip={t('app.master-data.drawings.stepPreviewLoading')}>
                <div style={{ minHeight: 24 }} />
              </Spin>
            </div>
          }
        >
          <StepPreviewPane
            fileUuid={fileUuid}
            fileUrl={url}
            fileName={fileSource.fileName}
            fileExtension={fileSource.fileExtension}
            height="100%"
            showEdges={stepShowEdges}
            showControls
            viewerRef={stepViewerRef}
          />
        </Suspense>
      </UniPreviewOverlay>
    );
  }

  if (open && isCad2d) {
    return (
      <UniPreviewOverlay
        open={open}
        onClose={onClose}
        title={title || fileName || t('app.master-data.drawings.preview')}
        inset={16}
        extra={dwgToolbar}
      >
        <Suspense
          fallback={
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin tip={t('app.master-data.drawings.dwgPreviewLoading')}>
                <div style={{ minHeight: 24 }} />
              </Spin>
            </div>
          }
        >
          <DwgPreviewPane
            fileUuid={fileUuid}
            fileUrl={url}
            fileName={fileSource.fileName}
            fileExtension={fileSource.fileExtension}
            height="100%"
            viewerRef={dwgViewerRef}
          />
        </Suspense>
      </UniPreviewOverlay>
    );
  }

  return (
    <>
      {previewUrl && isImage ? (
        <Image
          src={previewUrl}
          alt={fileName || 'preview'}
          style={{ display: 'none' }}
          preview={{
            visible: open,
            src: previewUrl,
            destroyOnHidden: true,
            onVisibleChange: (visible) => {
              if (!visible) onClose();
            },
          }}
        />
      ) : null}

      {!isImage && isPdf ? (
        <UniPdfPreview
          open={open}
          onClose={onClose}
          title={title || fileName || t('app.master-data.drawings.preview')}
          src={appendPdfViewerParams(pdfBlobUrl || previewUrl)}
          loading={loading || pdfLoading}
          error={error}
          emptyMessage={t('app.master-data.drawings.previewUnsupported')}
          inset={16}
        />
      ) : null}

      {!isImage && !isPdf ? (
        <Modal
          title={title || fileName || t('app.master-data.drawings.preview')}
          open={open}
          onCancel={onClose}
          footer={null}
          width={width}
          style={{ top: 16 }}
          destroyOnHidden
          styles={{ body: { minHeight: typeof height === 'number' ? `${height}px` : height, padding: 0 } }}
        >
          {loading || pdfLoading ? (
            <div
              style={{
                minHeight: typeof height === 'number' ? `${height}px` : height,
                height: typeof height === 'number' ? `${height}px` : height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spin />
            </div>
          ) : error ? (
            <Alert type="error" title={error} showIcon />
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title={title || fileName || t('app.master-data.drawings.preview')}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message={t('app.master-data.drawings.previewUnsupported')}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
};

export default FilePreviewModal;
