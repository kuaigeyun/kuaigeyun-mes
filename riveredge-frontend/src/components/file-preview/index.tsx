import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Modal, Spin, Alert, Image } from 'antd';
import { useTranslation } from 'react-i18next';
import { getFileByUuid, getFilePreview } from '../../services/file';
import { UniPdfPreview } from '../uni-preview';
import { getFileExt, isImageFile, isPdfFile, isStepFile, type FilePreviewSource } from '../../utils/filePreviewKind';

const StepPreviewPane = lazy(() =>
  import('../step-preview/StepPreviewPane').then((m) => ({ default: m.StepPreviewPane })),
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
  const isDwgLike = getFileExt(fileSource) === 'dwg' || getFileExt(fileSource) === 'dxf';

  useEffect(() => {
    if (!open || isStep) return;
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
  }, [open, fileUuid, url, isStep, t]);

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

  if (open && isStep) {
    return (
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
              <Spin tip={t('app.master-data.drawings.stepPreviewLoading')} />
            </div>
          }
        >
          <StepPreviewPane
            fileUuid={fileUuid}
            fileUrl={url}
            fileName={fileSource.fileName}
            fileExtension={fileSource.fileExtension}
            height={typeof height === 'number' ? `${height}px` : height}
            showEdges
          />
        </Suspense>
      </Modal>
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
          src={pdfBlobUrl || previewUrl}
          loading={loading || pdfLoading}
          error={error}
          emptyMessage={isDwgLike ? t('app.master-data.drawings.previewDwgHint') : t('app.master-data.drawings.previewUnsupported')}
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
            <Alert type="error" message={error} showIcon />
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
              message={isDwgLike ? t('app.master-data.drawings.previewDwgHint') : t('app.master-data.drawings.previewUnsupported')}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
};

export default FilePreviewModal;
