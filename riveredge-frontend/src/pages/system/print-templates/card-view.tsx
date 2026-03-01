/**
 * 打印模板管理 - 卡片视图组件
 * 
 * 提供卡片布局的打印模板展示界面，支持模板预览、设计器和变量管理
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Card, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Alert, Input, List, Divider, Form, Select, theme } from 'antd';
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
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_TO_CODE, getSamplePreviewVariables } from '../../../config/printTemplateSchemas';
import { isPdfmeTemplate } from '../../../utils/pdfmeTemplateUtils';
import PdfmePreview from '../../../components/pdfme-doc/preview';
import { EMPTY_PDFME_TEMPLATE_JSON } from '../../../components/pdfme-doc/constants';
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import { CODE_FONT_FAMILY } from '../../../constants/fonts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { useToken } = theme;
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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
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
      handleError(error, t('pages.system.printTemplates.loadListFailed'));
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
      handleError(error, t('pages.system.printTemplates.getDetailFailed'));
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
        setPreviewContent(t('pages.system.printTemplates.oldFormatMessage'));
      }
      setPreviewModalVisible(true);
    } catch (error: any) {
      handleError(error, t('pages.system.printTemplates.getDetailFailed'));
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
      handleSuccess(t('pages.system.printTemplates.createSuccess'));
      setCreateModalVisible(false);
      loadTemplates();
    } catch (error: any) {
      handleError(error, t('pages.system.printTemplates.createFailed'));
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
      handleError(error, t('pages.system.printTemplates.getDetailFailed'));
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
      handleError(error, t('pages.system.printTemplates.getDetailFailed'));
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
        handleError(new Error('JSON 格式错误'), t('pages.system.printTemplates.templateDataFormatError'));
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
        handleSuccess(t('pages.system.printTemplates.renderSuccess'));
        loadTemplates();
      } else {
        handleError(new Error(result.error || t('pages.system.printTemplates.renderFailed')), t('pages.system.printTemplates.renderFailed'));
      }
    } catch (error: any) {
      handleError(error, t('pages.system.printTemplates.renderFailed'));
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
      handleSuccess(t('pages.system.printTemplates.deleteSuccess'));
      loadTemplates();
    } catch (error: any) {
      handleError(error, t('pages.system.printTemplates.deleteFailed'));
    }
  };

  /**
   * 获取模板类型图标和颜色
   */
  const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
    const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      pdf: { color: 'red', text: 'PDF', icon: <FileOutlined /> },
      html: { color: 'blue', text: 'HTML', icon: <FileTextOutlined /> },
      word: { color: 'green', text: 'Word', icon: <FileTextOutlined /> },
      excel: { color: 'purple', text: 'Excel', icon: <FileTextOutlined /> },
      other: { color: 'default', text: t('pages.system.printTemplates.typeOther'), icon: <FileTextOutlined /> },
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
        title={t('pages.system.printTemplates.cardViewTitle')}
        extra={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {t('pages.system.printTemplates.createButtonShort')}
          </Button>,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadTemplates}
            loading={loading}
          >
            {t('pages.system.printTemplates.refreshShort')}
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printTemplates.statTotal')}
                value={stats.total}
                prefix={<FileTextOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printTemplates.statActive')}
                value={stats.active}
                prefix={<FileTextOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printTemplates.statDefault')}
                value={stats.default}
                prefix={<FileTextOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printTemplates.statUsage')}
                value={stats.totalUsage}
                prefix={<PrinterOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Col>
          </Row>
          {Object.keys(stats.byType).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorder}` }}>
              <Text type="secondary" style={{ marginRight: 8 }}>{t('pages.system.printTemplates.byTypeStats')}</Text>
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
                        <Tooltip title={t('pages.system.printTemplates.viewDetail')}>
                          <EyeOutlined
                            key="view"
                            onClick={() => handleViewDetail(template)}
                            style={{ fontSize: 16 }}
                          />
                        </Tooltip>,
                        <Tooltip title={t('pages.system.printTemplates.previewModalTitle')}>
                          <FileTextOutlined
                            key="preview"
                            onClick={() => handlePreview(template)}
                            style={{ fontSize: 16, color: '#1890ff' }}
                          />
                        </Tooltip>,
                        <Tooltip title={t('pages.system.printTemplates.design')}>
                          <CodeOutlined
                            key="designer"
                            onClick={() => handleOpenDesigner(template)}
                            style={{ fontSize: 16, color: '#52c41a' }}
                          />
                        </Tooltip>,
                        <Tooltip title={t('pages.system.printTemplates.variablesModalTitle')}>
                          <SettingOutlined
                            key="variables"
                            onClick={() => handleViewVariables(template)}
                            style={{ fontSize: 16, color: '#faad14' }}
                          />
                        </Tooltip>,
                        <Tooltip title={t('pages.system.printTemplates.renderTemplate')}>
                          <PrinterOutlined
                            key="render"
                            onClick={() => handleRender(template)}
                            disabled={!template.is_active}
                            style={{ fontSize: 16, color: template.is_active ? '#722ed1' : '#d9d9d9' }}
                          />
                        </Tooltip>,
                        <Popconfirm
                          key="delete"
                          title={t('pages.system.printTemplates.deleteConfirmTitle')}
                          onConfirm={() => handleDelete(template)}
                          okText={t('common.confirm')}
                          cancelText={t('common.cancel')}
                        >
                          <Tooltip title={t('pages.system.printTemplates.deleteTooltip')}>
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
                              {t('pages.system.printTemplates.codePrefix')}{template.code}
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
                      
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printTemplates.statusLabel')}</Text>
                            <Tag color={template.is_active ? 'success' : 'default'}>
                              {template.is_active ? t('pages.system.printTemplates.enabled') : t('pages.system.printTemplates.disabled')}
                            </Tag>
                          </div>
                          
                          {template.is_default && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printTemplates.defaultLabel')}</Text>
                              <Tag color="processing">{t('pages.system.printTemplates.isDefault')}</Tag>
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printTemplates.usageLabel')}</Text>
                            <Text style={{ fontSize: 12 }}>{template.usage_count || 0}</Text>
                          </div>
                          
                          {template.last_used_at && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printTemplates.lastUsedLabel')}</Text>
                              <Text style={{ fontSize: 12 }}>
                                {dayjs(template.last_used_at).fromNow()}
                              </Text>
                            </div>
                          )}
                          
                          {variables.length > 0 && (
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printTemplates.variablesLabel')}</Text>
                              <Tag color="blue" style={{ fontSize: 11 }}>
                                {t('pages.system.printTemplates.variablesCount', { count: variables.length })}
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
            <Empty description={t('pages.system.printTemplates.cardViewEmpty')} />
          )}
        </Card>
      </PageContainer>

      {/* 模板详情 Modal */}
      <Modal
        title={t('pages.system.printTemplates.detailModalTitle')}
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
            <Descriptions.Item label={t('pages.system.printTemplates.columnName')}>
              {currentTemplate.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.columnCode')}>
              {currentTemplate.code}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.columnType')}>
              <Tag color={getTypeInfo(currentTemplate.type).color}>
                {getTypeInfo(currentTemplate.type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.labelDescription')}>
              {currentTemplate.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.columnContent')}>
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
              <Descriptions.Item label={t('pages.system.printTemplates.columnConfig')}>
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
            <Descriptions.Item label={t('pages.system.printTemplates.labelActive')}>
              <Tag color={currentTemplate.is_active ? 'success' : 'default'}>
                {currentTemplate.is_active ? t('pages.system.printTemplates.enabled') : t('pages.system.printTemplates.disabled')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.labelDefault')}>
              <Tag color={currentTemplate.is_default ? 'processing' : 'default'}>
                {currentTemplate.is_default ? t('pages.system.printTemplates.isDefault') : t('pages.system.printTemplates.noLabel')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.usageLabel')}>
              {currentTemplate.usage_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.columnLastUsed')}>
              {currentTemplate.last_used_at
                ? dayjs(currentTemplate.last_used_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.columnCreatedAt')}>
              {dayjs(currentTemplate.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printTemplates.columnUpdatedAt')}>
              {dayjs(currentTemplate.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 模板预览 Modal */}
      <Modal
        title={t('pages.system.printTemplates.previewModalTitle')}
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
              message={t('pages.system.printTemplates.previewAlertTitle')}
              description={t('pages.system.printTemplates.previewAlertDesc')}
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
              <Text strong>{t('pages.system.printTemplates.rawContentLabel')}</Text>
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
        title={t('pages.system.printTemplates.variablesModalTitle')}
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
              message={t('pages.system.printTemplates.variablesAlertTitle')}
              description={t('pages.system.printTemplates.variablesAlertDesc')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            {(() => {
              const variables = extractVariables(currentTemplate.content);
              if (variables.length === 0) {
                return (
                  <Empty description={t('pages.system.printTemplates.noVariables')} />
                );
              }
              return (
                <List
                  dataSource={variables}
                  renderItem={(variable) => (
                    <List.Item>
                      <Space>
                        <Tag color="blue">{`{{${variable}}}`}</Tag>
                        <Text type="secondary">{t('pages.system.printTemplates.variableNameLabel')} {variable}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              );
            })()}
            <Divider />
            <div>
              <Text strong>{t('pages.system.printTemplates.templateContentLabel')}</Text>
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
        title={t('pages.system.printTemplates.renderModalTitle')}
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
            {t('common.cancel')}
          </Button>,
          <Button key="submit" type="primary" onClick={handleRenderSubmit} loading={renderLoading}>
            {t('pages.system.printTemplates.submitRender')}
          </Button>,
        ]}
        width={700}
      >
        {currentTemplate && (
          <div>
            <Alert
              message={t('pages.system.printTemplates.renderModalTitle')}
              description={t('pages.system.printTemplates.renderAlertDesc')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('pages.system.printTemplates.templateVariablesLabel')}</Text>
              {(() => {
                const variables = extractVariables(currentTemplate.content);
                if (variables.length === 0) {
                  return <Text type="secondary"> {t('pages.system.printTemplates.noVariablesShort')}</Text>;
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
              <Text strong>{t('pages.system.printTemplates.labelTemplateData')}</Text>
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
                  message={renderResult.success ? t('pages.system.printTemplates.resultSuccess') : t('pages.system.printTemplates.resultFailed')}
                  description={renderResult.success ? t('pages.system.printTemplates.templateRenderedSuccess') : renderResult.error}
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
                      {t('pages.system.printTemplates.downloadFile')}
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
        title={t('pages.system.printTemplates.modalCreate')}
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
            label={t('pages.system.printTemplates.labelName')}
            rules={[{ required: true, message: t('pages.system.printTemplates.nameRequired') }]}
          >
            <Input placeholder={t('pages.system.printTemplates.nameRequired')} />
          </Form.Item>
          <Form.Item
            name="document_type"
            label={t('pages.system.printTemplates.labelDocumentType')}
            rules={[{ required: true, message: t('pages.system.printTemplates.documentTypeRequired') }]}
          >
            <Select placeholder={t('pages.system.printTemplates.documentTypeRequired')} options={DOCUMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="code"
            label={t('pages.system.printTemplates.labelCode')}
            rules={[{ required: true, message: t('pages.system.printTemplates.codeRequired') }]}
          >
            <Input placeholder={t('pages.system.printTemplates.codeTooltip')} disabled />
          </Form.Item>
          <Form.Item
            name="type"
            label={t('pages.system.printTemplates.columnType')}
            initialValue="pdf"
            rules={[{ required: true, message: t('pages.system.printTemplates.outputFormatRequired') }]}
          >
            <Select>
              <Select.Option value="pdf">PDF</Select.Option>
              <Select.Option value="html">HTML</Select.Option>
              <Select.Option value="image">Image</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label={t('pages.system.printTemplates.labelDescription')}>
            <TextArea rows={4} placeholder={t('pages.system.printTemplates.descPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CardView;

