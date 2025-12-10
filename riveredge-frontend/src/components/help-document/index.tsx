/**
 * 帮助文档组件
 * 
 * 提供统一的帮助文档查看功能
 */

import React, { useState } from 'react';
import { Modal, Button, Tabs, Typography, Space, Divider } from 'antd';
import type { TabsProps } from 'antd';
import { QuestionCircleOutlined, BookOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text, Link } = Typography;

/**
 * 帮助文档章节
 */
export interface HelpSection {
  /**
   * 章节标题
   */
  title: string;
  /**
   * 章节内容
   */
  content: React.ReactNode;
  /**
   * 章节图标
   */
  icon?: React.ReactNode;
}

/**
 * 帮助文档组件属性
 */
export interface HelpDocumentProps {
  /**
   * 文档标题
   */
  title: string;
  /**
   * 文档章节列表
   */
  sections: HelpSection[];
  /**
   * 是否显示帮助按钮（默认 true）
   */
  showHelpButton?: boolean;
  /**
   * 帮助按钮文本
   */
  helpButtonText?: string;
  /**
   * 帮助按钮位置
   */
  helpButtonPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /**
   * 是否默认打开（默认 false）
   */
  defaultOpen?: boolean;
}

/**
 * 帮助文档组件
 */
const HelpDocument: React.FC<HelpDocumentProps> = ({
  title,
  sections,
  showHelpButton = true,
  helpButtonText = '帮助',
  helpButtonPosition = 'top-right',
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  // 帮助按钮样式
  const helpButtonStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
    ...(helpButtonPosition === 'top-right' && { top: 20, right: 20 }),
    ...(helpButtonPosition === 'top-left' && { top: 20, left: 20 }),
    ...(helpButtonPosition === 'bottom-right' && { bottom: 20, right: 20 }),
    ...(helpButtonPosition === 'bottom-left' && { bottom: 20, left: 20 }),
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      {showHelpButton && (
        <Button
          type="primary"
          icon={<QuestionCircleOutlined />}
          onClick={handleOpen}
          style={helpButtonStyle}
        >
          {helpButtonText}
        </Button>
      )}
      <Modal
        title={
          <Space>
            <BookOutlined />
            <span>{title}</span>
          </Space>
        }
        open={open}
        onCancel={handleClose}
        footer={[
          <Button key="close" onClick={handleClose}>
            关闭
          </Button>,
        ]}
        size={800}
        style={{ top: 20 }}
      >
        <Tabs
          defaultActiveKey={sections[0]?.title || '0'}
          items={sections.map((section, index) => ({
            key: section.title || index.toString(),
            label: (
              <Space>
                {section.icon || <FileTextOutlined />}
                <span>{section.title}</span>
              </Space>
            ),
            children: (
              <div style={{ padding: '16px 0', maxHeight: '60vh', overflowY: 'auto' }}>
                {section.content}
              </div>
            ),
          }))}
        />
      </Modal>
    </>
  );
};

/**
 * 创建帮助文档内容（便捷函数）
 */
export const createHelpContent = {
  /**
   * 创建文本内容
   */
  text: (text: string) => <Paragraph>{text}</Paragraph>,
  
  /**
   * 创建标题和文本内容
   */
  section: (title: string, content: string | React.ReactNode) => (
    <div>
      <Title level={4}>{title}</Title>
      {typeof content === 'string' ? <Paragraph>{content}</Paragraph> : content}
    </div>
  ),
  
  /**
   * 创建列表内容
   */
  list: (items: string[], ordered: boolean = false) => {
    const ListComponent = ordered ? Typography.Ol : Typography.Ul;
    return (
      <ListComponent>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ListComponent>
    );
  },
  
  /**
   * 创建链接内容
   */
  link: (text: string, href: string) => (
    <Link href={href} target="_blank">
      {text}
    </Link>
  ),
  
  /**
   * 创建代码块内容
   */
  code: (code: string, language?: string) => (
    <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>
      <code>{code}</code>
    </pre>
  ),
};

export default HelpDocument;

