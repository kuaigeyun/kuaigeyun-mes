import React, { useMemo } from 'react';
import { Typography } from 'antd';
import { looksLikeHtml, sanitizeHtml } from '../../utils/sanitizeHtml';

const { Text } = Typography;

export interface LoginDescriptionContentProps {
  content?: string;
  className?: string;
}

/** 登录页左栏简介：兼容纯文本与富文本 HTML */
const LoginDescriptionContent: React.FC<LoginDescriptionContentProps> = ({
  content,
  className = 'description-text',
}) => {
  const safeHtml = useMemo(() => {
    const raw = (content || '').trim();
    if (!raw) return '';
    if (looksLikeHtml(raw)) {
      return sanitizeHtml(raw);
    }
    return '';
  }, [content]);

  if (!content?.trim()) {
    return null;
  }

  if (safeHtml) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return <Text className={className}>{content}</Text>;
};

export default LoginDescriptionContent;
