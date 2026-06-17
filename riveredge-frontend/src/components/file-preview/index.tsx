import React, { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Modal, Spin, Alert, Image, Button, App } from 'antd';
import {
  BorderOutlined,
  CompressOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getFileByUuid, getFilePreview, getFileDownloadUrlWithToken, FILE_IMAGE_SIZE_MEDIUM } from '../../services/file';
import { PreviewOverlayToolButton, UniPdfPreview, UniPreviewOverlay } from '../uni-preview';
import { getFileExt, isCad2dFile, isImageFile, isInlineDocumentPreview, isPdfFile, isStepFile, type FilePreviewSource } from '../../utils/filePreviewKind';
import type { DwgSvgViewerRef } from '../dwg-preview/DwgSvgViewer';
import type { StepModelViewerRef } from '../step-preview/StepModelViewer';

const StepPreviewPane = lazy(() =>
  import('../step-preview/StepPreviewPane').then((m) => ({ default: m.StepPreviewPane })),
);
const DwgPreviewPane = lazy(() =>
  import('../dwg-preview/DwgPreviewPane').then((m) => ({ default: m.DwgPreviewPane })),
);
const DocumentPreviewPane = lazy(() =>
  import('./DocumentPreviewPane').then((m) => ({ default: m.DocumentPreviewPane })),
);

export interface FilePreviewModalProps extends FilePreviewSource {
  open: boolean;
  onClose: () => void;
  fileUuid?: string;
  url?: string;
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
  const { message: messageApi } = App.useApp();
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [displayUrl, setDisplayUrl] = useState<string>('');
  const [isOriginalPreview, setIsOriginalPreview] = useState(false);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
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
  const isDocument = isInlineDocumentPreview(fileSource);

  useEffect(() => {
    if (!open || isStep || isCad2d) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        if (url) {
          if (!cancelled) {
            setPreviewUrl(url);
            setDisplayUrl(url);
            setIsOriginalPreview(false);
          }
          return;
        }
        if (!fileUuid) {
          throw new Error(t('app.master-data.drawings.previewFailed'));
        }
        const preview = await getFilePreview(fileUuid, { size: FILE_IMAGE_SIZE_MEDIUM });
        if (!preview?.preview_url || preview.supported === false) {
          throw new Error(t('app.master-data.drawings.previewUnsupported'));
        }
        if (!cancelled) {
          setPreviewUrl(preview.preview_url);
          setDisplayUrl(preview.preview_url);
          setIsOriginalPreview(false);
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

  useEffect(() => {
    if (!open) {
      setDisplayUrl('');
      setIsOriginalPreview(false);
      setLoadingOriginal(false);
    }
  }, [open]);

  const handleViewOriginal = useCallback(async () => {
    if (!fileUuid || loadingOriginal || isOriginalPreview) return;
    setLoadingOriginal(true);
    try {
      const originalUrl = await getFileDownloadUrlWithToken(fileUuid);
      setDisplayUrl(originalUrl);
      setIsOriginalPreview(true);
      messageApi.success(t('components.secureImage.switchedToOriginal'));
    } catch {
      messageApi.error(t('common.loadFailed'));
    } finally {
      setLoadingOriginal(false);
    }
  }, [fileUuid, loadingOriginal, isOriginalPreview, messageApi, t]);

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
          src={displayUrl || previewUrl}
          alt={fileName || 'preview'}
          style={{ display: 'none' }}
          preview={{
            visible: open,
            src: displayUrl || previewUrl,
            destroyOnHidden: true,
            onVisibleChange: (visible) => {
              if (!visible) onClose();
            },
            actionsRender: fileUuid
              ? (originalNode) => (
                  <>
                    {originalNode}
                    {!isOriginalPreview && (
                      <Button
                        type="link"
                        size="small"
                        loading={loadingOriginal}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleViewOriginal();
                        }}
                        style={{ color: 'rgba(255,255,255, 0.85)' }}
                      >
                        {loadingOriginal
                          ? t('components.secureImage.loadingOriginal')
                          : t('components.secureImage.viewOriginal')}
                      </Button>
                    )}
                  </>
                )
              : undefined,
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
          ) : previewUrl && isDocument ? (
            <Suspense
              fallback={
                <div
                  style={{
                    minHeight: typeof height === 'number' ? `${height}px` : height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Spin tip={t('pages.system.files.previewLoading')}>
                    <div style={{ minHeight: 24 }} />
                  </Spin>
                </div>
              }
            >
              <DocumentPreviewPane
                fileUrl={previewUrl}
                fileSource={fileSource}
                height={height}
              />
            </Suspense>
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
