/**
 * 终端文档中心 (Document Center)
 * 
 * 功能：
 * 1. 展示 SOP、图纸、CNC 代码及产品图片
 * 2. 玻璃拟态设计，沉浸式预览
 * 
 * Author: Antigravity
 * Date: 2026-02-05
 */

import React, { useState } from 'react';
import { Tabs, Card, Empty, Typography, Image, List, Tag, Button, Space } from 'antd';
import { 
  FileImageOutlined, 
  FileProtectOutlined, 
  CodeOutlined, 
  PaperClipOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { HMI_DESIGN_TOKENS } from '../../../../../../components/layout-templates';
import { CODE_FONT_FAMILY } from '../../../../../../constants/fonts';

const { TabPane } = Tabs;
const { Title, Text, Paragraph } = Typography;

export type DocumentCenterTabKey = 'sop' | 'drawings' | 'cnc' | 'attachments';

export interface DocumentCenterProps {
  sopContent?: string;
  drawings?: Array<{ id: string; name: string; url: string }>;
  cncCode?: string;
  attachments?: Array<{ id: string; name: string; url: string; type: string }>;
  productImages?: string[];
  style?: React.CSSProperties;
  /** 仅渲染指定 Tab 的内容，不显示内部 Tab 栏（用于与外部 Tabs 同级） */
  singleTab?: DocumentCenterTabKey;
}

const DocumentCenter: React.FC<DocumentCenterProps> = ({
  sopContent,
  drawings = [],
  cncCode,
  attachments = [],
  productImages = [],
  style,
  singleTab,
}) => {
  const [activeTab, setActiveTab] = useState('sop');
  const effectiveTab = singleTab ?? activeTab;

  const renderSOP = () => (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      {sopContent ? (
        <Paragraph style={{ color: HMI_DESIGN_TOKENS.TEXT_SECONDARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, lineHeight: 1.8 }}>
          {sopContent}
        </Paragraph>
      ) : (
        <Empty description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无作业指导书</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
      )}
    </div>
  );

  const renderDrawings = () => (
    <div style={{ padding: 16, height: '100%' }}>
      {drawings.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {drawings.map(d => (
            <Card
              key={d.id}
              hoverable
              cover={<Image alt={d.name} src={d.url} fallback="data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' dy='.3em' text-anchor='middle'%3EDrawing Preview%3C/text%3E%3C/svg%3E" />}
              bodyStyle={{ padding: 12, background: HMI_DESIGN_TOKENS.BG_CARD }}
            >
              <Card.Meta title={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{d.name}</Text>} />
            </Card>
          ))}
        </div>
      ) : (
        <Empty description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无图纸</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
      )}
    </div>
  );

  const renderCNCCode = () => (
    <div style={{ padding: 16, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {cncCode ? (
        <pre style={{ 
          flex: 1,
          background: 'rgba(0, 0, 0, 0.3)', 
          padding: 16, 
          borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS, 
          color: HMI_DESIGN_TOKENS.STATUS_OK,
          fontFamily: CODE_FONT_FAMILY,
          fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
          border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
          overflowY: 'auto'
        }}>
          {cncCode}
        </pre>
      ) : (
        <Empty description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无代码</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
      )}
    </div>
  );

  const renderAttachments = () => (
    <div style={{ padding: 16, height: '100%' }}>
      {attachments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ color: HMI_DESIGN_TOKENS.TEXT_TERTIARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>暂无附件</span>}
          style={{ marginTop: 24 }}
        />
      ) : (
      <List
        dataSource={attachments}
        renderItem={item => (
          <List.Item
            actions={[
              <Button type="link" icon={<EyeOutlined />} key="view" style={{ fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE }}>预览</Button>,
              <Button type="link" icon={<DownloadOutlined />} key="download" style={{ fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE }}>下载</Button>
            ]}
            style={{ borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE }}
          >
            <List.Item.Meta
              avatar={<PaperClipOutlined style={{ color: HMI_DESIGN_TOKENS.STATUS_INFO, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }} />}
              title={<Text style={{ color: HMI_DESIGN_TOKENS.TEXT_PRIMARY, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{item.name}</Text>}
              description={<Tag color={HMI_DESIGN_TOKENS.STATUS_INFO} style={{ background: `${HMI_DESIGN_TOKENS.STATUS_INFO}1a`, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}>{item.type}</Tag>}
            />
          </List.Item>
        )}
      />
      )}
    </div>
  );

  const tabStyle = { fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN, padding: '12px 16px', minHeight: HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE, display: 'inline-flex' as const, alignItems: 'center' };

  const renderTabContent = (key: DocumentCenterTabKey) => {
    switch (key) {
      case 'sop': return renderSOP();
      case 'drawings': return renderDrawings();
      case 'cnc': return renderCNCCode();
      case 'attachments': return renderAttachments();
      default: return renderSOP();
    }
  };

  if (singleTab) {
    return (
      <div className="document-center-hmi" style={{ height: '100%', overflow: 'hidden', ...style }}>
        <div style={{ height: '100%', overflow: 'auto' }}>{renderTabContent(singleTab)}</div>
      </div>
    );
  }

  return (
    <div className="document-center-hmi" style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: HMI_DESIGN_TOKENS.PANEL_FROSTED,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS_LG,
      boxShadow: HMI_DESIGN_TOKENS.PANEL_GLOW,
      border: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
      overflow: 'hidden',
      padding: 0,
      ...style 
    }}>
      <style>{`.document-center-hmi .ant-tabs-ink-bar { background: ${HMI_DESIGN_TOKENS.STATUS_INFO} !important; }`}</style>
      <Tabs 
        activeKey={effectiveTab} 
        onChange={setActiveTab}
        centered
        tabBarStyle={{ marginBottom: 0, borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`, fontSize: HMI_DESIGN_TOKENS.FONT_BODY_MIN }}
        style={{ height: '100%' }}
      >
        <TabPane 
          tab={<Space style={tabStyle}><FileProtectOutlined />SOP 指导</Space>} 
          key="sop"
        >
          {renderSOP()}
        </TabPane>
        <TabPane 
          tab={<Space style={tabStyle}><FileImageOutlined />生产图纸</Space>} 
          key="drawings"
        >
          {renderDrawings()}
        </TabPane>
        <TabPane 
          tab={<Space style={tabStyle}><CodeOutlined />CNC 代码</Space>} 
          key="cnc"
        >
          {renderCNCCode()}
        </TabPane>
        <TabPane 
          tab={<Space style={tabStyle}><PaperClipOutlined />相关附件</Space>} 
          key="attachments"
        >
          {renderAttachments()}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default DocumentCenter;
