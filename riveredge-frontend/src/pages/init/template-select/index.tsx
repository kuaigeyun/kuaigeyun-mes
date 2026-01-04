/**
 * 行业模板选择页面
 *
 * 用于新组织初始化时选择行业模板
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Space, Typography, Modal, message, Spin, Descriptions, Empty, App } from 'antd';
import { FileTextOutlined, CheckCircleOutlined, EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getIndustryTemplateList, getIndustryTemplateById, applyIndustryTemplate, type IndustryTemplate } from '../../../services/industryTemplate';
import { getTenantId } from '../../../utils/auth';

const { Text, Paragraph, Title } = Typography;

/**
 * 行业模板选择页面组件
 */
const TemplateSelectPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const tenantId = getTenantId();

  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [applyVisible, setApplyVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate | null>(null);
  const [applying, setApplying] = useState(false);

  /**
   * 加载模板列表
   */
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await getIndustryTemplateList(undefined, true);
      setTemplates(response.items || []);
    } catch (error: any) {
      console.error('加载模板列表失败:', error);
      messageApi.error('加载模板列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  /**
   * 处理预览模板
   */
  const handlePreview = async (template: IndustryTemplate) => {
    try {
      // 获取模板详情（如果需要更多信息）
      const detail = await getIndustryTemplateById(template.id);
      setSelectedTemplate(detail);
      setPreviewVisible(true);
    } catch (error: any) {
      console.error('加载模板详情失败:', error);
      messageApi.error('加载模板详情失败');
    }
  };

  /**
   * 处理应用模板
   */
  const handleApply = (template: IndustryTemplate) => {
    setSelectedTemplate(template);
    setApplyVisible(true);
  };

  /**
   * 确认应用模板
   */
  const handleConfirmApply = async () => {
    if (!selectedTemplate || !tenantId) {
      messageApi.error('缺少必要参数');
      return;
    }

    setApplying(true);
    try {
      await applyIndustryTemplate(selectedTemplate.id, tenantId);
      messageApi.success('模板应用成功！');
      setApplyVisible(false);
      // 跳转到工作台
      navigate('/system/dashboard', { replace: true });
    } catch (error: any) {
      console.error('应用模板失败:', error);
      messageApi.error(error.message || '应用模板失败，请重试');
    } finally {
      setApplying(false);
    }
  };

  /**
   * 获取行业类型标签颜色
   */
  const getIndustryTagColor = (industry: string): string => {
    const colorMap: Record<string, string> = {
      manufacturing: 'blue',
      retail: 'green',
      service: 'orange',
      logistics: 'purple',
    };
    return colorMap[industry] || 'default';
  };

  /**
   * 渲染模板卡片
   */
  const renderTemplateCard = (template: IndustryTemplate) => {
    return (
      <Card
        key={template.id}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(template)}
          >
            预览
          </Button>,
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => handleApply(template)}
          >
            应用模板
          </Button>,
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                {template.name}
              </Title>
              {template.is_default && (
                <Tag color="processing" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>
                  推荐
                </Tag>
              )}
            </div>
            <Tag color={getIndustryTagColor(template.industry)}>
              {template.industry}
            </Tag>
          </div>

          {template.description && (
            <Paragraph
              ellipsis={{ rows: 2, expandable: false }}
              style={{ marginBottom: 0, fontSize: 12, color: '#666' }}
            >
              {template.description}
            </Paragraph>
          )}

          <div style={{ paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>使用次数：</Text>
                <Text strong>{template.usage_count}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>启用状态：</Text>
                <Tag color={template.is_active ? 'success' : 'default'}>
                  {template.is_active ? '启用' : '禁用'}
                </Tag>
              </div>
            </Space>
          </div>
        </Space>
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          选择行业模板
        </Title>
        <Paragraph type="secondary">
          选择一个适合您行业的模板，一键完成基础配置，包括编码规则、系统参数等。
        </Paragraph>
      </div>

      {templates.length === 0 ? (
        <Empty description="暂无可用模板" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {templates.map((template) => renderTemplateCard(template))}
        </div>
      )}

      {/* 预览Modal */}
      <Modal
        title="模板预览"
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          setSelectedTemplate(null);
        }}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          selectedTemplate && (
            <Button
              key="apply"
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                setPreviewVisible(false);
                handleApply(selectedTemplate);
              }}
            >
              应用模板
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedTemplate && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="模板名称" span={2}>
              {selectedTemplate.name}
              {selectedTemplate.is_default && (
                <Tag color="processing" style={{ marginLeft: 8 }}>
                  推荐
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="模板代码">
              {selectedTemplate.code}
            </Descriptions.Item>
            <Descriptions.Item label="行业类型">
              <Tag color={getIndustryTagColor(selectedTemplate.industry)}>
                {selectedTemplate.industry}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedTemplate.description || '无'}
            </Descriptions.Item>
            <Descriptions.Item label="使用次数">
              {selectedTemplate.usage_count}
            </Descriptions.Item>
            <Descriptions.Item label="启用状态">
              <Tag color={selectedTemplate.is_active ? 'success' : 'default'}>
                {selectedTemplate.is_active ? '启用' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="模板配置" span={2}>
              <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflow: 'auto' }}>
                {JSON.stringify(selectedTemplate.config, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 应用确认Modal */}
      <Modal
        title="应用行业模板"
        open={applyVisible}
        onCancel={() => {
          setApplyVisible(false);
          setSelectedTemplate(null);
        }}
        onOk={handleConfirmApply}
        confirmLoading={applying}
        okText="确认应用"
        cancelText="取消"
      >
        {selectedTemplate && (
          <div>
            <p>确定要应用模板 <strong>{selectedTemplate.name}</strong> 吗？</p>
            <p style={{ color: '#999', fontSize: '12px' }}>
              应用模板后，将自动配置编码规则、系统参数等基础设置。
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TemplateSelectPage;

