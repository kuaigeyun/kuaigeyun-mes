import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Alert, 
  Divider, 
  Breadcrumb, 
  Tooltip, 
  message, 
  Row, 
  Col, 
  Button, 
  Space, 
  theme 
} from 'antd';
import {
  ShareAltOutlined,
  PrinterOutlined,
  LikeOutlined,
  DislikeOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import './index.less';

const { Title, Paragraph, Text } = Typography;

export interface WikiItem {
  key: string;
  label: string;
  breadcrumbs: string[];
  content: React.ReactNode;
}

export interface WikiTreeData {
  key: string;
  title: string;
  children?: WikiTreeData[];
}

export interface UniWikiProps {
  items: WikiItem[];
  treeData: WikiTreeData[];
  defaultSelectedKey?: string;
  defaultExpandedKeys?: string[];
  directoryTitle?: React.ReactNode;
  feedbackQuestion?: React.ReactNode;
}

const UniWiki: React.FC<UniWikiProps> = ({ 
  items, 
  treeData, 
  defaultSelectedKey = '1',
  defaultExpandedKeys = [],
  directoryTitle = '帮助目录',
  feedbackQuestion = '这篇文章对您有帮助吗？'
}) => {
  const [selectedKey, setSelectedKey] = useState(defaultSelectedKey);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(defaultExpandedKeys);
  const { token } = theme.useToken();
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  useEffect(() => {
    setFeedback(null);
  }, [selectedKey]);

  const currentIndex = items.findIndex(item => item.key === selectedKey);
  const currentItem = items[currentIndex];
  const prevItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  const renderCustomMenuItem = (item: WikiTreeData, level: number = 0) => {
    const isSelected = selectedKey === item.key;
    const isExpanded = expandedKeys.includes(item.key);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.key}>
        <div
          onClick={() => {
            if (hasChildren) {
              setExpandedKeys(prev => prev.includes(item.key) ? prev.filter(k => k !== item.key) : [...prev, item.key]);
            } else {
              setSelectedKey(item.key);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            paddingLeft: 16 + level * 20,
            cursor: 'pointer',
            borderRadius: 6,
            marginBottom: 4,
            backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
            color: isSelected ? token.colorPrimary : token.colorText,
            fontWeight: isSelected ? 500 : 400,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {hasChildren && (
            <div 
              style={{ 
                marginRight: 8, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: 16, 
                height: 16, 
                color: '#999', 
                transition: 'transform 0.2s', 
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0
              }}
            >
              <RightOutlined style={{ fontSize: 12 }} />
            </div>
          )}
          {!hasChildren && (
             <div style={{ width: 16, marginRight: 8, display: 'inline-block', flexShrink: 0 }} />
          )}
          <div style={{ fontSize: 15, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.title}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div style={{ paddingBottom: 4 }}>
            {item.children!.map((child: WikiTreeData) => renderCustomMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', backgroundColor: token.colorBgContainer, overflow: 'hidden' }}>
      {/* 左侧目录栏 (WIKI 侧边栏风格) */}
      <div 
        style={{ 
          width: 280, 
          flexShrink: 0, 
          backgroundColor: '#fafafa', 
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 20px 12px', fontWeight: 600, fontSize: 16, color: token.colorTextHeading }}>
          {directoryTitle}
        </div>
        <div className="scrollbar-like-modal" style={{ flex: 1, overflowY: 'auto', padding: '0 12px 24px' }}>
          {treeData.map(item => renderCustomMenuItem(item, 0))}
        </div>
      </div>

      {/* 右侧主内容区 (WIKI 正文风格) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflow: 'hidden' }}>
        {/* 顶部工具栏 */}
        <div 
          style={{ 
            height: 56, 
            padding: '0 32px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            backgroundColor: '#fff',
            flexShrink: 0
          }}
        >
          <Breadcrumb items={currentItem?.breadcrumbs.map(title => ({ title })) || []} />
          <Space>
            <Tooltip title="复制分享链接">
              <Button type="text" icon={<ShareAltOutlined />} onClick={() => message.success('章节链接已复制到剪贴板')} />
            </Tooltip>
            <Tooltip title="打印当前页面">
              <Button type="text" icon={<PrinterOutlined />} onClick={() => window.print()} />
            </Tooltip>
          </Space>
        </div>

        {/* 滚动内容区 */}
        <div className="wiki-help-container" style={{ flex: 1, overflowY: 'auto', padding: '48px 40px', scrollBehavior: 'smooth' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

            <Typography style={{ flex: 1 }}>
              {currentItem?.content}
            </Typography>

            <Divider style={{ marginTop: 64, marginBottom: 40 }} />

            {/* 反馈组件 */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 64, gap: 24 }}>
              <Text type="secondary" style={{ fontSize: 15 }}>{feedbackQuestion}</Text>
              <Space size="middle">
                <Button 
                  type={feedback === 'like' ? 'primary' : 'default'} 
                  shape="round" 
                  size="large"
                  icon={<LikeOutlined />} 
                  onClick={() => { setFeedback('like'); message.success('感谢您的反馈！'); }}
                  style={{ padding: '0 32px' }}
                >
                  有帮助
                </Button>
                <Button 
                  type={feedback === 'dislike' ? 'primary' : 'default'} 
                  danger={feedback === 'dislike'}
                  shape="round" 
                  size="large"
                  icon={<DislikeOutlined />} 
                  onClick={() => { setFeedback('dislike'); message.info('感谢反馈，我们将努力改进文档质量。'); }}
                  style={{ padding: '0 32px' }}
                >
                  没帮助
                </Button>
              </Space>
            </div>

            {/* 底部前后篇导航 */}
            <Row gutter={24}>
              <Col span={12}>
                {prevItem && (
                  <div 
                    onClick={() => setSelectedKey(prevItem.key)}
                    style={{ 
                      padding: '24px', 
                      backgroundColor: '#fafafa',
                      border: `1px solid transparent`, 
                      borderRadius: 8, 
                      cursor: 'pointer', 
                      transition: 'all 0.3s ease' 
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = token.colorPrimary; e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = '#fafafa'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 14 }}><LeftOutlined /> 上一篇</Text>
                    <Text strong style={{ fontSize: 16, color: token.colorPrimary }}>{prevItem.label}</Text>
                  </div>
                )}
              </Col>
              <Col span={12}>
                {nextItem && (
                  <div 
                    onClick={() => setSelectedKey(nextItem.key)}
                    style={{ 
                      padding: '24px', 
                      backgroundColor: '#fafafa',
                      border: `1px solid transparent`, 
                      borderRadius: 8, 
                      cursor: 'pointer', 
                      transition: 'all 0.3s ease', 
                      textAlign: 'right' 
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = token.colorPrimary; e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = '#fafafa'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>下一篇 <RightOutlined /></Text>
                    <Text strong style={{ fontSize: 16, color: token.colorPrimary }}>{nextItem.label}</Text>
                  </div>
                )}
              </Col>
            </Row>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniWiki;
