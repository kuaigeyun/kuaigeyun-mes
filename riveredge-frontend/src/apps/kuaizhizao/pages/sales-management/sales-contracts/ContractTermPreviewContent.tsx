import React, { useMemo } from 'react';
import { Typography } from 'antd';

import { splitUnresolvedPlaceholderSegments } from './contract-term-placeholders';

type ContractTermPreviewContentProps = {
  content: string;
};

/** 合同条款预览：未填占位符 `{...}` 加粗标红 */
export const ContractTermPreviewContent: React.FC<ContractTermPreviewContentProps> = ({ content }) => {
  const segments = useMemo(() => splitUnresolvedPlaceholderSegments(content), [content]);

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'placeholder' ? (
          <Typography.Text key={index} strong type="danger">
            {segment.value}
          </Typography.Text>
        ) : (
          <React.Fragment key={index}>{segment.value}</React.Fragment>
        ),
      )}
    </>
  );
};
