import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Spin, Alert } from 'antd';
import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer';
import '@cyntler/react-doc-viewer/dist/index.css';
import { getFilePreview } from '../../services/file';

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

const DOC_VIEWER_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'txt',
  'csv',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
]);

const getExt = (source: FilePreviewSource): string => {
  if (source.fileExtension) return String(source.fileExtension).toLowerCase();
  if (source.fileName?.includes('.')) return source.fileName.split('.').pop()!.toLowerCase();
  if (source.fileType?.includes('/')) return source.fileType.split('/').pop()!.toLowerCase();
  return '';
};

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
  const [loading, setLoading] = useState(false);
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
  const canUseDocViewer = DOC_VIEWER_EXTENSIONS.has(ext);
  const isDwgLike = ext === 'dwg' || ext === 'dxf';

  return (
    <Modal
      title={title || fileName || '文件预览'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      destroyOnHidden
      styles={{ body: { minHeight: typeof height === 'number' ? `${height}px` : height } }}
    >
      {loading ? (
        <div style={{ minHeight: typeof height === 'number' ? `${height}px` : height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert type="error" message={error} showIcon />
      ) : previewUrl ? (
        canUseDocViewer ? (
          <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
            <DocViewer
              documents={[{ uri: previewUrl, fileType: ext || undefined, fileName }]}
              pluginRenderers={DocViewerRenderers}
              config={{ header: { disableHeader: true } }}
              style={{ height: '100%' }}
            />
          </div>
        ) : (
          <iframe
            src={previewUrl}
            title={title || fileName || '文件预览'}
            style={{
              width: '100%',
              height: typeof height === 'number' ? `${height}px` : height,
              border: 'none',
            }}
          />
        )
      ) : (
        <Alert
          type="warning"
          showIcon
          message={isDwgLike ? 'DWG 预览取决于后端转换/浏览器支持' : '当前文件暂不支持在线预览'}
        />
      )}
    </Modal>
  );
};

export default FilePreviewModal;
