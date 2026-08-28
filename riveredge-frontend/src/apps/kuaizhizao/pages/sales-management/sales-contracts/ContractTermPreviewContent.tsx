import React, { useMemo } from 'react';
import { Typography } from 'antd';

import { buildTermPreviewSegments } from './contract-term-placeholders';

type ContractTermPreviewContentProps = {
  /** 已解析展示文案 */
  content: string;
  /** 原始模板；有则已填/未填占位均粗体+下划线 */
  template?: string;
  /** 已知占位取值（可与模板/正文推断合并） */
  values?: Record<string, string>;
};

/** 合同条款预览：占位部分粗体+下划线；未填另标红 */
export const ContractTermPreviewContent: React.FC<ContractTermPreviewContentProps> = ({
  content,
  template,
  values,
}) => {
  const segments = useMemo(
    () => buildTermPreviewSegments(content, template, values),
    [content, template, values],
  );

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'placeholder' ? (
          <Typography.Text
            key={index}
            strong
            underline
            type={segment.filled ? undefined : 'danger'}
          >
            {segment.value}
          </Typography.Text>
        ) : (
          <React.Fragment key={index}>{segment.value}</React.Fragment>
        ),
      )}
    </>
  );
};
