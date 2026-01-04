/**
 * 文本组件
 *
 * 支持标题、段落、标签等文本类型
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React from 'react';
import { Typography } from 'antd';
import { ReportComponent } from '../index';

const { Title, Paragraph, Text } = Typography;

/**
 * 文本组件Props
 */
export interface TextComponentProps {
  component: ReportComponent;
}

/**
 * 文本组件
 */
const TextComponent: React.FC<TextComponentProps> = ({ component }) => {
  const { content, textType = 'paragraph', style } = component;

  switch (textType) {
    case 'title':
      return <Title level={component.level || 1} style={style}>{content}</Title>;
    case 'label':
      return <Text strong style={style}>{content}</Text>;
    case 'paragraph':
    default:
      return <Paragraph style={style}>{content}</Paragraph>;
  }
};

export default TextComponent;

