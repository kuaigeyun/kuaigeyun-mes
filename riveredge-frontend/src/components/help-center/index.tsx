/**
 * 帮助中心组件
 *
 * 提供统一的帮助文档查看功能，支持主题分类浏览和搜索。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useState, useEffect } from 'react';
import { Drawer, Input, List, Card, Typography, Space, Empty, Spin } from 'antd';
import { QuestionCircleOutlined, SearchOutlined, BookOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { listHelpDocuments, getHelpDocument, type HelpDocument } from '../../services/helpDocument';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

/**
 * 帮助中心组件属性
 */
export interface HelpCenterProps {
  /**
   * 是否显示悬浮按钮（默认 true）
   */
  showFloatButton?: boolean;
  /**
   * 显示模式：'float' | 'sidebar' | 'inline'
   */
  mode?: 'float' | 'sidebar' | 'inline';
  /**
   * 是否默认打开（默认 false）
   */
  defaultOpen?: boolean;
  /**
   * 打开回调
   */
  onOpen?: () => void;
  /**
   * 关闭回调
   */
  onClose?: () => void;
}

/**
 * 帮助中心组件
 */
const HelpCenter: React.FC<HelpCenterProps> = ({
  showFloatButton = true,
  mode = 'float',
  defaultOpen = false,
  onOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [documents, setDocuments] = useState<HelpDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<HelpDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<HelpDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  /**
   * 加载帮助文档列表
   */
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await listHelpDocuments();
      setDocuments(docs);
      setFilteredDocuments(docs);
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
  }, [open]);

  /**
   * 处理搜索
   */
  const handleSearch = async (keyword: string) => {
    setSearchKeyword(keyword);
    if (!keyword.trim()) {
      setFilteredDocuments(documents);
      return;
    }

    setLoading(true);
    try {
      // 使用搜索API
      const results = await listHelpDocuments();
      // 前端过滤（如果后端不支持搜索，则前端过滤）
      const filtered = results.filter((doc) => {
        const keywordLower = keyword.toLowerCase();
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
    } catch (error: any) {
      console.error('搜索帮助文档失败:', error);
    } finally {
      setLoading(false);
    }
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
    setSearchKeyword('');
    onClose?.();
  };

  /**
   * 处理选择文档
   */
  const handleSelectDocument = async (documentKey: string) => {
    try {
      const doc = await getHelpDocument(documentKey);
      setSelectedDocument(doc);
    } catch (error: any) {
      console.error('加载帮助文档详情失败:', error);
    }
  };

  /**
   * 渲染帮助文档列表
   */
  const renderDocumentList = () => {
    if (loading && documents.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      );
    }

    if (filteredDocuments.length === 0) {
      return (
        <Empty
          description={searchKeyword ? '未找到匹配的帮助文档' : '暂无帮助文档'}
          style={{ marginTop: 40 }}
        />
      );
    }

    return (
      <List
        dataSource={filteredDocuments}
        renderItem={(doc) => (
          <List.Item
            style={{ cursor: 'pointer', padding: '12px 16px' }}
            onClick={() => handleSelectDocument(doc.key)}
          >
            <List.Item.Meta
              avatar={<BookOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
              title={doc.title}
              description={
                <Text type="secondary" ellipsis>
                  {doc.sections[0]?.content || '暂无描述'}
                </Text>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  /**
   * 渲染帮助文档详情
   */
  const renderDocumentDetail = () => {
    if (!selectedDocument) {
      return null;
    }

    return (
      <div>
        <Title level={4} style={{ marginBottom: 16 }}>
          {selectedDocument.title}
        </Title>
        {selectedDocument.sections.map((section, index) => (
          <Card key={index} style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginBottom: 12 }}>
              {section.title}
            </Title>
            <Paragraph style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {section.content}
            </Paragraph>
          </Card>
        ))}
      </div>
    );
  };

  /**
   * 悬浮按钮模式
   */
  if (mode === 'float' && showFloatButton) {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
          }}
        >
          <button
            onClick={handleOpen}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#1890ff',
              border: 'none',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <QuestionCircleOutlined />
          </button>
        </div>
        <Drawer
          title={
            <Space>
              <QuestionCircleOutlined />
              <span>{t('components.helpCenter.title')}</span>
            </Space>
          }
          open={open}
          onClose={handleClose}
          width={600}
          placement="right"
        >
          <div style={{ marginBottom: 16 }}>
            <Search
              placeholder={t('components.helpCenter.searchPlaceholder')}
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              onChange={(e) => {
                if (!e.target.value) {
                  handleSearch('');
                }
              }}
            />
          </div>
          {selectedDocument ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <a onClick={() => setSelectedDocument(null)}>{t('components.helpCenter.backToList')}</a>
              </div>
              {renderDocumentDetail()}
            </div>
          ) : (
            renderDocumentList()
          )}
        </Drawer>
      </>
    );
  }

  /**
   * 侧边栏模式
   */
  if (mode === 'sidebar') {
    return (
      <Drawer
        title={
          <Space>
            <QuestionCircleOutlined />
            <span>{t('components.helpCenter.title')}</span>
          </Space>
        }
        open={open}
        onClose={handleClose}
        width={600}
        placement="right"
      >
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder={t('components.helpCenter.searchPlaceholder')}
            allowClear
            enterButton={<SearchOutlined />}
            onSearch={handleSearch}
            onChange={(e) => {
              if (!e.target.value) {
                handleSearch('');
              }
            }}
          />
        </div>
        {selectedDocument ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <a onClick={() => setSelectedDocument(null)}>{t('components.helpCenter.backToList')}</a>
            </div>
            {renderDocumentDetail()}
          </div>
        ) : (
          renderDocumentList()
        )}
      </Drawer>
    );
  }

  /**
   * 内联模式
   */
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Search
          placeholder={t('components.helpCenter.searchPlaceholder')}
          allowClear
          enterButton={<SearchOutlined />}
          onSearch={handleSearch}
          onChange={(e) => {
            if (!e.target.value) {
              handleSearch('');
            }
          }}
        />
      </div>
      {selectedDocument ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <a onClick={() => setSelectedDocument(null)}>{t('components.helpCenter.backToList')}</a>
          </div>
          {renderDocumentDetail()}
        </div>
      ) : (
        renderDocumentList()
      )}
    </div>
  );
};

export default HelpCenter;

