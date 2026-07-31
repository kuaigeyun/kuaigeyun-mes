import React from 'react';
import { Tag } from 'antd';
import { getFileExt, getFileTypeBadgeLabel, type FilePreviewSource } from '../../utils/filePreviewKind';

export interface FilePreviewHeaderTitleProps {
  fileSource: FilePreviewSource;
  /** 无文件名时的兜底标题 */
  fallbackTitle: string;
  /** 深色全屏预览顶栏 / 浅色 Modal 标题 */
  variant?: 'dark' | 'light';
}

export const FilePreviewHeaderTitle: React.FC<FilePreviewHeaderTitleProps> = ({
  fileSource,
  fallbackTitle,
  variant = 'dark',
}) => {
  const displayName = (fileSource.fileName ?? '').trim() || fallbackTitle;
  const typeLabel = getFileTypeBadgeLabel(fileSource) || getFileExt(fileSource).toUpperCase();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <span
        title={displayName}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: variant === 'dark' ? 16 : undefined,
          fontWeight: variant === 'dark' ? 500 : undefined,
        }}
      >
        {displayName}
      </span>
      {typeLabel ? (
        variant === 'dark' ? (
          <span
            style={{
              flexShrink: 0,
              padding: '0 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              lineHeight: '20px',
              letterSpacing: '0.04em',
              color: '#dbeafe',
              background: 'rgba(91, 141, 239, 0.22)',
              border: '1px solid rgba(91, 141, 239, 0.45)',
            }}
          >
            {typeLabel}
          </span>
        ) : (
          <Tag color="processing" style={{ margin: 0, flexShrink: 0 }}>
            {typeLabel}
          </Tag>
        )
      ) : null}
    </span>
  );
};
