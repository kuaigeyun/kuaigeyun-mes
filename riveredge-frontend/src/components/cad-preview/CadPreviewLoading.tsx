/**
 * CAD 预览加载态：单层 Spin + 单行文案（避免 tip 嵌套双圈、窄容器竖排换行）
 */

import React from 'react';
import { Spin } from 'antd';

export type CadPreviewLoadingProps = {
  text: string;
  /** 深色全屏预览用浅色字 */
  tone?: 'light' | 'default';
  minHeight?: number | string;
};

export const CadPreviewLoading: React.FC<CadPreviewLoadingProps> = ({
  text,
  tone = 'default',
  minHeight = 200,
}) => (
  <div
    style={{
      flex: 1,
      width: '100%',
      minHeight,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
    }}
  >
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        maxWidth: '100%',
      }}
    >
      <Spin size="large" />
      <div
        style={{
          whiteSpace: 'nowrap',
          writingMode: 'horizontal-tb',
          textOrientation: 'mixed',
          textAlign: 'center',
          lineHeight: 1.4,
          color: tone === 'light' ? 'rgba(229, 231, 235, 0.88)' : undefined,
        }}
      >
        {text}
      </div>
    </div>
  </div>
);
