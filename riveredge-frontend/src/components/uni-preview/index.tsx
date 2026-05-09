import React, { useEffect, useRef } from 'react';
import { Alert, Spin } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

export interface UniPdfPreviewProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  src?: string;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  inset?: number;
  onDownload?: () => void;
  onPrint?: () => void;
}

export const UniPdfPreview: React.FC<UniPdfPreviewProps> = ({
  open,
  onClose,
  title = 'PDF 预览',
  src,
  loading = false,
  error = '',
  emptyMessage = '当前文件暂不支持在线预览',
  inset = 16,
  onDownload,
  onPrint,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.45)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset,
          background: '#0f1115',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: 44,
            padding: '0 12px 0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #2a2f38',
            color: '#e5e7eb',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 500 }}>{title}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {onDownload ? (
              <button
                type="button"
                onClick={onDownload}
                style={{
                  border: '1px solid #3a404b',
                  background: 'transparent',
                  color: '#e5e7eb',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                下载
              </button>
            ) : null}
            {onPrint ? (
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  border: '1px solid #3a404b',
                  background: 'transparent',
                  color: '#e5e7eb',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                打印
              </button>
            ) : null}
            <span
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.28)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
                cursor: 'pointer',
              }}
            >
              <CloseOutlined />
            </span>
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f1115',
              }}
            >
              <Spin />
            </div>
          ) : error ? (
            <Alert type="error" message={error} showIcon />
          ) : src ? (
            <iframe
              ref={iframeRef}
              src={src}
              title={title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#fff',
                display: 'block',
              }}
            />
          ) : (
            <Alert type="warning" showIcon message={emptyMessage} />
          )}
        </div>
      </div>
    </div>
  );
};

