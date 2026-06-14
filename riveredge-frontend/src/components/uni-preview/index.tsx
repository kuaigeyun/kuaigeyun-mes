import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Spin } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { FILE_PREVIEW_OVERLAY_Z_INDEX } from '../layout-templates/constants';

export interface PreviewOverlayToolButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}

/** 全屏预览顶栏工具按钮（PDF / 3D / CAD 共用样式） */
export const PreviewOverlayToolButton: React.FC<PreviewOverlayToolButtonProps> = ({
  children,
  onClick,
  active,
  title,
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      border: `1px solid ${active ? '#5b8def' : '#3a404b'}`,
      background: active ? 'rgba(91, 141, 239, 0.18)' : 'transparent',
      color: '#e5e7eb',
      borderRadius: 6,
      padding: '4px 10px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      lineHeight: 1.4,
    }}
  >
    {children}
  </button>
);

export interface UniPreviewOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  inset?: number;
  extra?: React.ReactNode;
  children: React.ReactNode;
  /** 默认 FILE_PREVIEW_OVERLAY_Z_INDEX，挂到 document.body */
  zIndex?: number;
}

/** 全屏预览壳层（文件管理 PDF 预览同款） */
export const UniPreviewOverlay: React.FC<UniPreviewOverlayProps> = ({
  open,
  onClose,
  title = '预览',
  inset = 16,
  extra,
  children,
  zIndex = FILE_PREVIEW_OVERLAY_Z_INDEX,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const overlay = (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
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
          <span
            style={{
              fontSize: 16,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: 12,
            }}
          >
            {title}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {extra}
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

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

  const toolbar = (
    <>
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
    </>
  );

  return (
    <UniPreviewOverlay open={open} onClose={onClose} title={title} inset={inset} extra={toolbar}>
      {loading ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f1115',
          }}
        >
          <Spin />
        </div>
      ) : error ? (
        <Alert type="error" title={error} showIcon />
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
            flex: 1,
          }}
        />
      ) : (
        <Alert type="warning" showIcon title={emptyMessage} />
      )}
    </UniPreviewOverlay>
  );
};
