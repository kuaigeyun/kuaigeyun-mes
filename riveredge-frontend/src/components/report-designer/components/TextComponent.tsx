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
  data?: Record<string, any>;
}

/**
 * 文本组件
 */
const TextComponent: React.FC<TextComponentProps> = ({ component, data = {} }) => {
  const { content, textType = 'paragraph', style } = component;

  // 变量替换
  const resolvedContent = React.useMemo(() => {
    if (!content) return '';
    return content.replace(/\{\{([\w.]+)\}\}/g, (_: string, key: string) => {
      // 支持点号访问嵌套属性，如 user.name
      const keys = key.split('.');
      let value = data;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }, [content, data]);

  switch (textType) {
    case 'title':
      return <Title level={component.level || 1} style={style}>{resolvedContent}</Title>;
    case 'label':
      return <Text strong style={style}>{resolvedContent}</Text>;
    case 'paragraph':
    default:
      return <Paragraph style={style}>{resolvedContent}</Paragraph>;
  }
};

export default TextComponent;

