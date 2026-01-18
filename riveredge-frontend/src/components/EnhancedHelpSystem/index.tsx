/**
 * 增强帮助系统组件
 *
 * 提供更完善的帮助功能，包括上下文帮助、操作引导、错误帮助等。
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { Drawer, Button, Space, Typography, List, Card, Tag, Input, Empty } from 'antd';
import {
  QuestionCircleOutlined,
  BookOutlined,
  SearchOutlined,
  CloseOutlined,
  BulbOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { listHelpDocuments, getHelpDocument, type HelpDocument } from '@/services/helpDocument';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

/**
 * 帮助类型
 */
export enum HelpType {
  /** 上下文帮助 */
  CONTEXT = 'context',
  /** 操作引导 */
  GUIDE = 'guide',
  /** 错误帮助 */
  ERROR = 'error',
  /** 功能说明 */
  FEATURE = 'feature',
}

/**
 * 增强帮助系统组件属性
 */
export interface EnhancedHelpSystemProps {
  /** 帮助类型 */
  helpType?: HelpType;
  /** 帮助文档键 */
  helpKey?: string;
  /** 是否显示悬浮按钮 */
  showFloatButton?: boolean;
  /** 显示模式 */
  mode?: 'float' | 'sidebar' | 'inline';
  /** 是否默认打开 */
  defaultOpen?: boolean;
  /** 打开回调 */
  onOpen?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 增强帮助系统组件
 */
const EnhancedHelpSystem: React.FC<EnhancedHelpSystemProps> = ({
  helpType = HelpType.CONTEXT,
  helpKey,
  showFloatButton = true,
  mode = 'float',
  defaultOpen = false,
  onOpen,
  onClose,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [documents, setDocuments] = useState<HelpDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<HelpDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<HelpDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  /**
   * 加载帮助文档
   */
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await listHelpDocuments();
      // 根据帮助类型过滤
      const filtered = helpType
        ? docs.filter((doc) => doc.category === helpType)
        : docs;
      setDocuments(filtered);
      setFilteredDocuments(filtered);

      // 如果指定了帮助键，自动加载对应文档
      if (helpKey) {
        const doc = filtered.find((d) => d.key === helpKey);
        if (doc) {
          setSelectedDocument(doc);
        }
      }
    } catch (error: any) {
      console.error('加载帮助文档失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDocuments();
    }
  }, [open, helpType, helpKey]);

  /**
   * 处理搜索
   */
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    if (!keyword.trim()) {
      setFilteredDocuments(documents);
      return;
    }

    const keywordLower = keyword.toLowerCase();
    const filtered = documents.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(keywordLower) ||
        doc.sections.some(
          (section) =>
            section.title.toLowerCase().includes(keywordLower) ||
            section.content.toLowerCase().includes(keywordLower)
        )
      );
    });
    setFilteredDocuments(filtered);
  };

  /**
   * 处理打开
   */
  const handleOpen = () => {
    setOpen(true);
    onOpen?.();
  };

  /**
   * 处理关闭
   */
  const handleClose = () => {
    setOpen(false);
    setSelectedDocument(null);
    onClose?.();
  };

  /**
   * 处理选择文档
   */
  const handleSelectDocument = async (doc: HelpDocument) => {
    setLoading(true);
    try {
      const fullDoc = await getHelpDocument(doc.key);
      setSelectedDocument(fullDoc);
    } catch (error: any) {
      console.error('加载帮助文档详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 渲染帮助内容
   */
  const renderHelpContent = () => {
    if (selectedDocument) {
      return (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<CloseOutlined />} onClick={() => setSelectedDocument(null)}>
              返回列表
            </Button>
          </Space>
          <Title level={4}>{selectedDocument.title}</Title>
          {selectedDocument.sections.map((section, index) => (
            <Card key={index} style={{ marginBottom: 16 }} title={section.title}>
              <Paragraph>{section.content}</Paragraph>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <div>
        <Search
          placeholder="搜索帮助文档"
          allowClear
          onSearch={handleSearch}
          style={{ marginBottom: 16 }}
        />
        {filteredDocuments.length === 0 ? (
          <Empty description="暂无帮助文档" />
        ) : (
          <List
            dataSource={filteredDocuments}
            loading={loading}
            renderItem={(doc) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => handleSelectDocument(doc)}
              >
                <List.Item.Meta
                  avatar={<BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                  title={
                    <Space>
                      {doc.title}
                      {doc.category && <Tag>{doc.category}</Tag>}
                    </Space>
                  }
                  description={doc.description}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    );
  };

  // 悬浮按钮模式
  if (mode === 'float' && showFloatButton) {
    return (
      <>
        <Button
          type="primary"
          shape="circle"
          icon={<QuestionCircleOutlined />}
          size="large"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
          onClick={handleOpen}
        />
        <Drawer
          title={
            <Space>
              <QuestionCircleOutlined />
              <span>帮助中心</span>
            </Space>
          }
          placement="right"
          width={600}
          open={open}
          onClose={handleClose}
        >
          {renderHelpContent()}
        </Drawer>
      </>
    );
  }

  // 侧边栏模式
  if (mode === 'sidebar') {
    return (
      <Drawer
        title={
          <Space>
            <QuestionCircleOutlined />
            <span>帮助中心</span>
          </Space>
        }
        placement="right"
        width={600}
        open={open}
        onClose={handleClose}
      >
        {renderHelpContent()}
      </Drawer>
    );
  }

  // 内联模式
  return (
    <Card
      title={
        <Space>
          <QuestionCircleOutlined />
          <span>帮助中心</span>
        </Space>
      }
      extra={
        <Button icon={<CloseOutlined />} onClick={handleClose} type="text" />
      }
    >
      {renderHelpContent()}
    </Card>
  );
};

export default EnhancedHelpSystem;
