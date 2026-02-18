/**
 * 打印模板管理 - 卡片视图组件
 * 
 * 提供卡片布局的打印模板展示界面，支持模板预览、设计器和变量管理
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Card, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Alert, Input, List, Divider, Form, Select } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, ReloadOutlined, FileTextOutlined, CodeOutlined, SettingOutlined, FileOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getPrintTemplateList,
  getPrintTemplateByUuid,
  updatePrintTemplate,
  createPrintTemplate,
  deletePrintTemplate,
  renderPrintTemplate,
  PrintTemplate,
  RenderPrintTemplateData,
  PrintTemplateRenderResponse,
} from '../../../services/printTemplate';
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_TO_CODE, getSamplePreviewVariables } from '../../../configs/printTemplateSchemas';
import { isPdfmeTemplate } from '../../../utils/pdfmeTemplateUtils';
import PdfmePreview from '../../../components/pdfme-doc/preview';
import { EMPTY_PDFME_TEMPLATE_JSON } from '../../../components/pdfme-doc/constants';
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import { CODE_FONT_FAMILY } from '../../../constants/fonts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 从模板内容中提取变量（支持 pdfme schemas 和纯文本 {{key}}）
 */
const extractVariables = (content: string): string[] => {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (parsed?.schemas && Array.isArray(parsed.schemas)) {
      const names = new Set<string>();
      for (const page of parsed.schemas) {
        if (Array.isArray(page)) {
          for (const s of page) {
            if (s?.name) names.add(s.name);
          }
        }
      }
      return Array.from(names).sort();
    }
  } catch {
    // 非 pdfme JSON
  }
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = content.matchAll(regex);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1].trim());
  }
  return Array.from(variables).sort();
};

/**
 * 卡片视图组件
 */
const CardView: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<PrintTemplate | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [variablesModalVisible, setVariablesModalVisible] = useState(false);
  const [renderModalVisible, setRenderModalVisible] = useState(false);
  const [renderFormData, setRenderFormData] = useState<string>('{}');
  const [renderResult, setRenderResult] = useState<PrintTemplateRenderResponse | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);

  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewPdfme, setPreviewPdfme] = useState<{ template: any; variables: Record<string, unknown> } | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载打印模板列表
   */
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getPrintTemplateList();
      setTemplates(data);
    } catch (error: any) {
      handleError(error, '加载打印模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadTemplates();
  }, []);

  /**
   * 设置自动刷新（每60秒刷新一次）
   */
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      loadTemplates();
    }, 60000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  /**
   * 查看模板详情
   */
  const handleViewDetail = async (template: PrintTemplate) => {
    try {
      const detail = await getPrintTemplateByUuid(template.uuid);
      setCurrentTemplate(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      handleError(error, '获取模板详情失败');
    }
  };

  /**
   * 预览模板
   */
  const handlePreview = async (template: PrintTemplate) => {
    try {
      const detail = await getPrintTemplateByUuid(template.uuid);
      setCurrentTemplate(detail);
      if (isPdfmeTemplate(detail.content)) {
        const templateObj = JSON.parse(detail.content);
        const docType = detail.config?.document_type || detail.type || 'work_order';
        setPreviewPdfme({
          template: templateObj,
          variables: getSamplePreviewVariables(docType),
        });
        setPreviewContent('');
      } else {
        setPreviewPdfme(null);
        setPreviewContent('该模板为旧格式，请在设计器中查看或重新设计');
      }
      setPreviewModalVisible(true);
    } catch (error: any) {
      handleError(error, '获取模板详情失败');
    }
  };

  /**
   * 新建模板
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
    createForm.resetFields();
  };

  /**
   * 提交新建模板
   */
  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      setLoading(true);
      await createPrintTemplate({
        ...values,
        code: DOCUMENT_TYPE_TO_CODE[values.document_type] || values.code,
        content: EMPTY_PDFME_TEMPLATE_JSON,
        config: { document_type: values.document_type },
      });
      handleSuccess('模板创建成功');
      setCreateModalVisible(false);
      loadTemplates();
    } catch (error: any) {
      handleError(error, '创建模板失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开设计器
   */
  const handleOpenDesigner = (template: PrintTemplate) => {
    navigate(`/system/print-templates/design/${template.uuid}`);
  };

  /**
   * 保存设计器内容
   */


  /**
   * 查看变量管理
   */
  const handleViewVariables = async (template: PrintTemplate) => {
    try {
      const detail = await getPrintTemplateByUuid(template.uuid);
      setCurrentTemplate(detail);
      setVariablesModalVisible(true);
    } catch (error: any) {
      handleError(error, '获取模板详情失败');
    }
  };

  /**
   * 渲染模板
   */
  const handleRender = async (template: PrintTemplate) => {
    try {
      const detail = await getPrintTemplateByUuid(template.uuid);
      setCurrentTemplate(detail);
      setRenderFormData('{}');
      setRenderResult(null);
      setRenderModalVisible(true);
    } catch (error: any) {
      handleError(error, '获取模板详情失败');
    }
  };

  /**
   * 提交渲染
   */
  const handleRenderSubmit = async () => {
    if (!currentTemplate) return;
    
    try {
      setRenderLoading(true);
      let data: Record<string, any> = {};
      try {
        data = JSON.parse(renderFormData);
      } catch (e) {
        handleError(new Error('JSON 格式错误'), '模板数据格式错误');
        return;
      }
      
      const renderData: RenderPrintTemplateData = {
        data,
        output_format: 'pdf',
        async_execution: false,
      };
      
      const result = await renderPrintTemplate(currentTemplate.uuid, renderData);
      setRenderResult(result);
      
      if (result.success) {
        handleSuccess('模板渲染成功');
        loadTemplates();
      } else {
        handleError(new Error(result.error || '模板渲染失败'), '模板渲染失败');
      }
    } catch (error: any) {
      handleError(error, '模板渲染失败');
    } finally {
      setRenderLoading(false);
    }
  };

  /**
   * 删除模板
   */
  const handleDelete = async (template: PrintTemplate) => {
    try {
      await deletePrintTemplate(template.uuid);
      handleSuccess('删除成功');
      loadTemplates();
    } catch (error: any) {
      handleError(error, '删除失败');
    }
  };

  /**
   * 获取模板类型图标和颜色
   */
  const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
    const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      pdf: { 
        color: 'red', 
        text: 'PDF',
        icon: <FileOutlined />,
      },
      html: { 
        color: 'blue', 
        text: 'HTML',
        icon: <FileTextOutlined />,
      },
      word: { 
        color: 'green', 
        text: 'Word',
        icon: <FileTextOutlined />,
      },
      excel: { 
        color: 'purple', 
        text: 'Excel',
        icon: <FileTextOutlined />,
      },
      other: { 
        color: 'default', 
        text: '其他',
        icon: <FileTextOutlined />,
      },
    };
    return typeMap[type] || { color: 'default', text: type, icon: <FileTextOutlined /> };
  };

  /**
   * 计算统计信息
   */
  const stats = {
    total: templates.length,
    active: templates.filter((t) => t.is_active).length,
    inactive: templates.filter((t) => !t.is_active).length,
    default: templates.filter((t) => t.is_default).length,
    byType: templates.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    totalUsage: templates.reduce((sum, t) => sum + (t.usage_count || 0), 0),
  };

  return (
    <>
      <PageContainer
        title="打印模板管理"
        extra={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建模板
          </Button>,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadTemplates}
            loading={loading}
          >
            刷新
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总模板数"
                value={stats.total}
                prefix={<FileTextOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="已启用"
                value={stats.active}
                prefix={<FileTextOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="默认模板"
                value={stats.default}
                prefix={<FileTextOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总使用次数"
                value={stats.totalUsage}
                prefix={<PrinterOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Col>
          </Row>
          {Object.keys(stats.byType).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ marginRight: 8 }}>按类型统计：</Text>
              <Space wrap>
                {Object.entries(stats.byType).map(([type, count]) => {
                  const typeInfo = getTypeInfo(type);
                  return (
                    <Tag key={type} color={typeInfo.color} icon={typeInfo.icon}>
                      {typeInfo.text}: {count}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          )}
        </Card>

        {/* 模板卡片列表 */}
        <Card loading={loading}>
          {templates.length > 0 ? (
            <Row gutter={[16, 16]}>
              {templates.map((template) => {
                const typeInfo = getTypeInfo(template.type);
                const variables = extractVariables(template.content);
                
                return (
                  <Col key={template.uuid} xs={24} sm={12} md={8} lg={6} xl={6}>
                    <Card
                      hoverable
                      style={{ height: '100%' }}
                      actions={[
                        <Tooltip title="查看详情">
                          <EyeOutlined
                            key="view"
                            onClick={() => handleViewDetail(template)}
                            style={{ fontSize: 16 }}
                          />
                        </Tooltip>,
                        <Tooltip title="预览模板">
                          <FileTextOutlined
                            key="preview"
                            onClick={() => handlePreview(template)}
                            style={{ fontSize: 16, color: '#1890ff' }}
                          />
                        </Tooltip>,
                        <Tooltip title="模板设计器">
                          <CodeOutlined
                            key="designer"
                            onClick={() => handleOpenDesigner(template)}
                            style={{ fontSize: 16, color: '#52c41a' }}
                          />
                        </Tooltip>,
                        <Tooltip title="变量管理">
                          <SettingOutlined
                            key="variables"
                            onClick={() => handleViewVariables(template)}
                            style={{ fontSize: 16, color: '#faad14' }}
                          />
                        </Tooltip>,
                        <Tooltip title="渲染模板">
                          <PrinterOutlined
                            key="render"
                            onClick={() => handleRender(template)}
                            disabled={!template.is_active}
                            style={{ fontSize: 16, color: template.is_active ? '#722ed1' : '#d9d9d9' }}
                          />
                        </Tooltip>,
                        <Popconfirm
                          key="delete"
                          title="确定要删除这个打印模板吗？"
                          onConfirm={() => handleDelete(template)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Tooltip title="删除">
                            <DeleteOutlined
                              style={{ fontSize: 16, color: '#ff4d4f' }}
                            />
                          </Tooltip>
                        </Popconfirm>,
                      ]}
                    >
                      <div style={{ marginBottom: 16 }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 16 }}>
                              {template.name}
                            </Text>
                            <Tag color={typeInfo.color} icon={typeInfo.icon}>
                              {typeInfo.text}
                            </Tag>
                          </div>
                          
                          {template.code && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              代码: {template.code}
                            </Text>
                          )}
                          
                          {template.description && (
                            <Paragraph
                              ellipsis={{ rows: 2, expandable: false }}
                              style={{ marginBottom: 0, fontSize: 12 }}
                            >
                              {template.description}
                            </Paragraph>
                          )}
                        </Space>
                      </div>
                      
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>启用状态：</Text>
                            <Tag color={template.is_active ? 'success' : 'default'}>
                              {template.is_active ? '启用' : '禁用'}
                            </Tag>
                          </div>
                          
                          {template.is_default && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>默认模板：</Text>
                              <Tag color="processing">是</Tag>
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>使用次数：</Text>
                            <Text style={{ fontSize: 12 }}>{template.usage_count || 0}</Text>
                          </div>
                          
                          {template.last_used_at && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>最后使用：</Text>
                              <Text style={{ fontSize: 12 }}>
                                {dayjs(template.last_used_at).fromNow()}
                              </Text>
                            </div>
                          )}
                          
                          {variables.length > 0 && (
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>变量数量：</Text>
                              <Tag color="blue" style={{ fontSize: 11 }}>
                                {variables.length} 个
                              </Tag>
                            </div>
                          )}
                        </Space>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Empty description="暂无打印模板" />
          )}
        </Card>
      </PageContainer>

      {/* 模板详情 Modal */}
      <Modal
        title="模板详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentTemplate(null);
        }}
        footer={null}
        width={800}
      >
        {currentTemplate && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="模板名称">
              {currentTemplate.name}
            </Descriptions.Item>
            <Descriptions.Item label="模板代码">
              {currentTemplate.code}
            </Descriptions.Item>
            <Descriptions.Item label="模板类型">
              <Tag color={getTypeInfo(currentTemplate.type).color}>
                {getTypeInfo(currentTemplate.type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="模板描述">
              {currentTemplate.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="模板内容">
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '300px',
                fontSize: 12,
              }}>
                {currentTemplate.content}
              </pre>
            </Descriptions.Item>
            {currentTemplate.config && (
              <Descriptions.Item label="模板配置">
                <pre style={{
                  margin: 0,
                  padding: '8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  fontSize: 12,
                }}>
                  {JSON.stringify(currentTemplate.config, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="启用状态">
              <Tag color={currentTemplate.is_active ? 'success' : 'default'}>
                {currentTemplate.is_active ? '启用' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="默认模板">
              <Tag color={currentTemplate.is_default ? 'processing' : 'default'}>
                {currentTemplate.is_default ? '是' : '否'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="使用次数">
              {currentTemplate.usage_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label="最后使用时间">
              {currentTemplate.last_used_at
                ? dayjs(currentTemplate.last_used_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(currentTemplate.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(currentTemplate.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 模板预览 Modal */}
      <Modal
        title="模板预览"
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          setCurrentTemplate(null);
          setPreviewContent('');
          setPreviewPdfme(null);
        }}
        footer={null}
        width={900}
      >
        {currentTemplate && (
          <div>
            <Alert
              message="预览说明"
              description="以下内容是将模板中的变量替换为示例值后的预览效果。实际变量值需要在使用时提供。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            {previewPdfme ? (
              <div style={{ height: 500, minHeight: 400 }}>
                <PdfmePreview
                  template={previewPdfme.template}
                  variables={previewPdfme.variables}
                />
              </div>
            ) : (
              <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', padding: '16px', backgroundColor: '#fff' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: 14, lineHeight: 1.6 }}>
                  {previewContent}
                </pre>
              </div>
            )}
            <Divider />
            <div>
              <Text strong>原始模板内容：</Text>
              <pre style={{
                marginTop: 8,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: 12,
              }}>
                {currentTemplate.content}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* 变量管理 Modal */}
      <Modal
        title="变量管理"
        open={variablesModalVisible}
        onCancel={() => {
          setVariablesModalVisible(false);
          setCurrentTemplate(null);
        }}
        footer={null}
        width={700}
      >
        {currentTemplate && (
          <div>
            <Alert
              message="模板变量"
              description="以下是从模板内容中自动提取的变量列表。变量使用 {{variable_name}} 格式定义。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            {(() => {
              const variables = extractVariables(currentTemplate.content);
              if (variables.length === 0) {
                return (
                  <Empty description="模板中没有变量" />
                );
              }
              return (
                <List
                  dataSource={variables}
                  renderItem={(variable) => (
                    <List.Item>
                      <Space>
                        <Tag color="blue">{`{{${variable}}}`}</Tag>
                        <Text type="secondary">变量名: {variable}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              );
            })()}
            <Divider />
            <div>
              <Text strong>模板内容：</Text>
              <pre style={{
                marginTop: 8,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                fontSize: 12,
              }}>
                {currentTemplate.content}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* 渲染模板 Modal */}
      <Modal
        title="渲染模板"
        open={renderModalVisible}
        onCancel={() => {
          setRenderModalVisible(false);
          setCurrentTemplate(null);
          setRenderFormData('{}');
          setRenderResult(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setRenderModalVisible(false);
            setCurrentTemplate(null);
            setRenderFormData('{}');
            setRenderResult(null);
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleRenderSubmit} loading={renderLoading}>
            渲染
          </Button>,
        ]}
        width={700}
      >
        {currentTemplate && (
          <div>
            <Alert
              message="渲染模板"
              description="提供模板数据（JSON 格式），系统将使用这些数据替换模板中的变量并生成输出文件。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16 }}>
              <Text strong>模板变量：</Text>
              {(() => {
                const variables = extractVariables(currentTemplate.content);
                if (variables.length === 0) {
                  return <Text type="secondary"> 无变量</Text>;
                }
                return (
                  <div style={{ marginTop: 8 }}>
                    {variables.map((variable) => (
                      <Tag key={variable} color="blue" style={{ marginBottom: 4 }}>
                        {variable}
                      </Tag>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>模板数据（JSON）：</Text>
              <TextArea
                rows={8}
                value={renderFormData}
                onChange={(e) => setRenderFormData(e.target.value)}
                placeholder='{"variable_name": "value"}'
                style={{ marginTop: 8, fontFamily: CODE_FONT_FAMILY }}
              />
            </div>
            {renderResult && (
              <div style={{ marginTop: 16 }}>
                <Divider />
                <Alert
                  message={renderResult.success ? '渲染成功' : '渲染失败'}
                  description={renderResult.success ? '模板已成功渲染' : renderResult.error}
                  type={renderResult.success ? 'success' : 'error'}
                  showIcon
                />
                {renderResult.success && renderResult.file_url && (
                  <div style={{ marginTop: 16 }}>
                    <Button
                      type="link"
                      href={renderResult.file_url}
                      target="_blank"
                    >
                      下载文件
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 新建模板 Modal */}
      <Modal
        title="新建打印模板"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateSubmit}
        confirmLoading={loading}
      >
        <Form form={createForm} layout="vertical" onValuesChange={(changed, all) => {
          if ('document_type' in changed && all.document_type) {
            const code = DOCUMENT_TYPE_TO_CODE[all.document_type];
            if (code) createForm.setFieldValue('code', code);
          }
        }}>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item
            name="document_type"
            label="关联业务单据"
            rules={[{ required: true, message: '请选择关联业务单据' }]}
          >
            <Select placeholder="请选择关联业务单据" options={DOCUMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="code"
            label="模板代码"
            rules={[{ required: true, message: '请先选择关联业务单据' }]}
          >
            <Input placeholder="根据关联业务单据自动生成" disabled />
          </Form.Item>
          <Form.Item
            name="type"
            label="模板类型"
            initialValue="pdf"
            rules={[{ required: true, message: '请选择模板类型' }]}
          >
            <Select>
              <Select.Option value="pdf">PDF</Select.Option>
              <Select.Option value="html">HTML</Select.Option>
              <Select.Option value="image">Image</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="请输入模板描述" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CardView;

