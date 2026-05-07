import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Spin, Alert, Image } from 'antd';
import { getFilePreview } from '../../services/file';
import { UniPdfPreview } from '../uni-preview';

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

const getExt = (source: FilePreviewSource): string => {
  if (source.fileExtension) return String(source.fileExtension).toLowerCase();
  if (source.fileName?.includes('.')) return source.fileName.split('.').pop()!.toLowerCase();
  if (source.fileType?.includes('/')) return source.fileType.split('/').pop()!.toLowerCase();
  return '';
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']);

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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
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
          throw new Error('缺少文件标识');
        }
        const preview = await getFilePreview(fileUuid);
        if (!preview?.preview_url || preview.supported === false) {
          throw new Error('当前文件暂不支持在线预览');
        }
        if (!cancelled) setPreviewUrl(preview.preview_url);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '文件预览失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, fileUuid, url]);

  const ext = useMemo(
    () => getExt({ fileName, fileType, fileExtension }),
    [fileName, fileType, fileExtension]
  );
  const isImage = IMAGE_EXTENSIONS.has(ext) || (fileType || '').toLowerCase().startsWith('image/');
  const isPdf = ext === 'pdf' || (fileType || '').toLowerCase() === 'application/pdf';
  const isDwgLike = ext === 'dwg' || ext === 'dxf';

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
          throw new Error(`PDF 预览加载失败: ${response.status}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setPdfBlobUrl(objectUrl);
        }
      } catch {
        // 回退到原始 URL，让浏览器自行处理
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
          title={title || fileName || '文件预览'}
          src={pdfBlobUrl || previewUrl}
          loading={loading || pdfLoading}
          error={error}
          emptyMessage={isDwgLike ? 'DWG 预览取决于后端转换/浏览器支持' : '当前文件暂不支持在线预览'}
          inset={16}
        />
      ) : null}

      {!isImage && !isPdf ? (
        <Modal
          title={title || fileName || '文件预览'}
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
              title={title || fileName || '文件预览'}
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
              message={isDwgLike ? 'DWG 预览取决于后端转换/浏览器支持' : '当前文件暂不支持在线预览'}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
};

export default FilePreviewModal;
