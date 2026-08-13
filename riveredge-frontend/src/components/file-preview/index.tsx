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
import { getFileExt, isCad2dFile, isImageFile, isInlineDocumentPreview, isAltiumEdaFile, isPcbDocFile, isSchDocFile, isPdfFile, isStepFile, type FilePreviewSource } from '../../utils/filePreviewKind';
import { FilePreviewHeaderTitle } from './FilePreviewHeaderTitle';
import type { DwgSvgViewerRef } from '../dwg-preview/DwgCadViewer';
import type { PcbSvgViewerRef } from '../pcb-preview/PcbSvgViewer';
import type { StepModelViewerRef } from '../step-preview/StepModelViewer';
import { PreviewMarkupProvider } from '../preview-markup/PreviewMarkupContext';
import { PreviewMarkupTextDialog } from '../preview-markup/PreviewMarkupTextDialog';
import { PreviewMarkupToolbar } from '../preview-markup/PreviewMarkupToolbar';
import { CadPreviewLoading } from '../cad-preview/CadPreviewLoading';

const StepPreviewPane = lazy(() =>
  import('../step-preview/StepPreviewPane').then((m) => ({ default: m.StepPreviewPane })),
);
const DwgPreviewPane = lazy(() =>
  import('../dwg-preview/DwgPreviewPane').then((m) => ({ default: m.DwgPreviewPane })),
);
const PcbPreviewPane = lazy(() =>
  import('../pcb-preview/PcbPreviewPane').then((m) => ({ default: m.PcbPreviewPane })),
);
const SchPreviewPane = lazy(() =>
  import('../sch-preview/SchPreviewPane').then((m) => ({ default: m.SchPreviewPane })),
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
  /** 预览浮层 z-index（工位端需高于侧滑面板等） */
  overlayZIndex?: number;
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
  overlayZIndex,
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
  const [pcbSide, setPcbSide] = useState<'top' | 'bottom'>('top');
  const stepViewerRef = useRef<StepModelViewerRef>(null);
  const dwgViewerRef = useRef<DwgSvgViewerRef>(null);
  const pcbViewerRef = useRef<PcbSvgViewerRef>(null);
  const schViewerRef = useRef<PcbSvgViewerRef>(null);

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
  const isPcbDoc = isPcbDocFile(fileSource);
  const isSchDoc = isSchDocFile(fileSource);
  const isAltiumEda = isAltiumEdaFile(fileSource);
  const isDocument = isInlineDocumentPreview(fileSource);

  const previewFallbackTitle = title || t('pages.system.files.previewModalTitle');
  const previewHeaderTitle = useMemo(
    () => (
      <FilePreviewHeaderTitle
        fileSource={fileSource}
        fallbackTitle={previewFallbackTitle}
        variant="dark"
      />
    ),
    [fileSource, previewFallbackTitle],
  );
  const previewHeaderTitleLight = useMemo(
    () => (
      <FilePreviewHeaderTitle
        fileSource={fileSource}
        fallbackTitle={previewFallbackTitle}
        variant="light"
      />
    ),
    [fileSource, previewFallbackTitle],
  );
  const previewAccessibleName =
    (fileSource.fileName ?? '').trim() || previewFallbackTitle;

  useEffect(() => {
    if (!open || isStep || isCad2d || isAltiumEda) return;
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
        const preview = await getFilePreview(
          fileUuid,
          isImage ? { size: FILE_IMAGE_SIZE_MEDIUM } : undefined,
        );
        // 文档类（txt/xlsx 等）由前端按扩展名渲染，不依赖后端 supported；
        // 缩略图 size 仅图片有效，表格/文本必须拉原文件。
        if (!preview?.preview_url) {
          throw new Error(t('app.master-data.drawings.previewUnsupported'));
        }
        if (!isDocument && preview.supported === false) {
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
  }, [open, fileUuid, url, isStep, isCad2d, isAltiumEda, isImage, isDocument, t]);

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

  const schToolbar = (
    <>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewZoomOut')}
        onClick={() => schViewerRef.current?.zoomOut()}
      >
        <ZoomOutOutlined />
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewFitView')}
        onClick={() => schViewerRef.current?.fitToView()}
      >
        <CompressOutlined />
        {t('app.master-data.drawings.previewFitView')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewZoomIn')}
        onClick={() => schViewerRef.current?.zoomIn()}
      >
        <ZoomInOutlined />
      </PreviewOverlayToolButton>
    </>
  );

  const pcbToolbar = (
    <>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.pcbSideTop')}
        active={pcbSide === 'top'}
        onClick={() => setPcbSide('top')}
      >
        {t('app.master-data.drawings.pcbSideTop')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.pcbSideBottom')}
        active={pcbSide === 'bottom'}
        onClick={() => setPcbSide('bottom')}
      >
        {t('app.master-data.drawings.pcbSideBottom')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewZoomOut')}
        onClick={() => pcbViewerRef.current?.zoomOut()}
      >
        <ZoomOutOutlined />
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewFitView')}
        onClick={() => pcbViewerRef.current?.fitToView()}
      >
        <CompressOutlined />
        {t('app.master-data.drawings.previewFitView')}
      </PreviewOverlayToolButton>
      <PreviewOverlayToolButton
        title={t('app.master-data.drawings.previewZoomIn')}
        onClick={() => pcbViewerRef.current?.zoomIn()}
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
        title={previewHeaderTitle}
        inset={16}
        zIndex={overlayZIndex}
        extra={stepToolbar}
      >
        <Suspense
          fallback={
            <CadPreviewLoading
              text={t('app.master-data.drawings.stepPreviewLoading')}
              tone="light"
              minHeight="100%"
            />
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
      <PreviewMarkupProvider fileUuid={fileUuid} scope="default">
        <PreviewMarkupTextDialog />
        <UniPreviewOverlay
          open={open}
          onClose={onClose}
          title={previewHeaderTitle}
          inset={16}
          zIndex={overlayZIndex}
          extra={
            <>
              {fileUuid ? <PreviewMarkupToolbar /> : null}
              {dwgToolbar}
            </>
          }
        >
        <Suspense
          fallback={
            <CadPreviewLoading
              text={t('app.master-data.drawings.dwgPreviewLoading')}
              tone="light"
              minHeight="100%"
            />
          }
        >
          <DwgPreviewPane
            fileUuid={fileUuid}
            fileUrl={url}
            fileName={fileSource.fileName}
            fileExtension={fileSource.fileExtension}
            height="100%"
            viewerRef={dwgViewerRef}
            darkChrome
          />
        </Suspense>
      </UniPreviewOverlay>
      </PreviewMarkupProvider>
    );
  }

  if (open && isSchDoc) {
    return (
      <PreviewMarkupProvider fileUuid={fileUuid} scope="default">
        <PreviewMarkupTextDialog />
        <UniPreviewOverlay
          open={open}
          onClose={onClose}
          title={previewHeaderTitle}
          inset={16}
          zIndex={overlayZIndex}
          extra={
            <>
              {fileUuid ? <PreviewMarkupToolbar /> : null}
              {schToolbar}
            </>
          }
        >
          <Suspense
            fallback={
              <CadPreviewLoading
                text={t('app.master-data.drawings.schPreviewLoading')}
                tone="light"
                minHeight="100%"
              />
            }
          >
            <SchPreviewPane
              fileUuid={fileUuid}
              fileUrl={url}
              fileName={fileSource.fileName}
              height="100%"
              viewerRef={schViewerRef}
              darkChrome
            />
          </Suspense>
        </UniPreviewOverlay>
      </PreviewMarkupProvider>
    );
  }

  if (open && isPcbDoc) {
    return (
      <PreviewMarkupProvider fileUuid={fileUuid} scope={pcbSide}>
        <PreviewMarkupTextDialog />
        <UniPreviewOverlay
          open={open}
          onClose={onClose}
          title={previewHeaderTitle}
          inset={16}
          zIndex={overlayZIndex}
          extra={
            <>
              {fileUuid ? <PreviewMarkupToolbar /> : null}
              {pcbToolbar}
            </>
          }
        >
        <Suspense
          fallback={
            <CadPreviewLoading
              text={t('app.master-data.drawings.pcbPreviewLoading')}
              tone="light"
              minHeight="100%"
            />
          }
        >
          <PcbPreviewPane
            fileUuid={fileUuid}
            fileUrl={url}
            fileName={fileSource.fileName}
            side={pcbSide}
            height="100%"
            viewerRef={pcbViewerRef}
            darkChrome
            showSideToggle={false}
          />
        </Suspense>
      </UniPreviewOverlay>
      </PreviewMarkupProvider>
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
            ...(overlayZIndex != null ? { zIndex: overlayZIndex } : {}),
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
          title={previewHeaderTitle}
          a11yTitle={previewAccessibleName}
          src={appendPdfViewerParams(pdfBlobUrl || previewUrl)}
          loading={loading || pdfLoading}
          error={error}
          emptyMessage={t('app.master-data.drawings.previewUnsupported')}
          inset={16}
          zIndex={overlayZIndex}
        />
      ) : null}

      {!isImage && !isPdf ? (
        <Modal
          open={open}
          title={previewHeaderTitleLight}
          onCancel={onClose}
          footer={null}
          width={width}
          style={{ top: 16 }}
          destroyOnHidden
          zIndex={overlayZIndex}
          mask={{ closable: true }}
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
                  <Spin description={t('pages.system.files.previewLoading')}>
                    <div style={{ minHeight: 24 }} />
                  </Spin>
                </div>
              }
            >
              <DocumentPreviewPane
                fileUrl={previewUrl}
                fileUuid={fileUuid}
                fileSource={fileSource}
                height={height}
              />
            </Suspense>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title={previewAccessibleName}
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              title={t('app.master-data.drawings.previewUnsupported')}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
};

export default FilePreviewModal;
