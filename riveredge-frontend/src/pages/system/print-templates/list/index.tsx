/**
 * 打印模板管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的打印模板。
 * 支持打印模板的 CRUD 操作和模板渲染功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProForm } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Modal, Input, Form, Space, Typography, Tooltip, Card, theme } from 'antd';
import { DeleteOutlined, EyeOutlined, PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getPrintTemplateList,
  getPrintTemplateByUuid,
  createPrintTemplate,
  updatePrintTemplate,
  deletePrintTemplate,
  renderPrintTemplate,
  PrintTemplate,
  CreatePrintTemplateData,
  UpdatePrintTemplateData,
  RenderPrintTemplateData,
  PrintTemplateRenderResponse,
} from '../../../../services/printTemplate';
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_TO_CODE } from '../../../../config/printTemplateSchemas';
import { EMPTY_PDFME_TEMPLATE_JSON, DEFAULT_WORK_ORDER_PDFME_TEMPLATE } from '../../../../components/pdfme-doc/constants';

import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { useToken } = theme;

/** 获取模板类型图标和颜色，text 需在组件内用 t 传入 other 的翻译 */
const getTypeInfo = (type: string, otherText: string = '其他'): { color: string; text: string; icon: React.ReactNode } => {
  const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    pdf: { color: 'red', text: 'PDF', icon: <FileTextOutlined /> },
    html: { color: 'blue', text: 'HTML', icon: <FileTextOutlined /> },
    word: { color: 'green', text: 'Word', icon: <FileTextOutlined /> },
    excel: { color: 'purple', text: 'Excel', icon: <FileTextOutlined /> },
    other: { color: 'default', text: otherText, icon: <FileTextOutlined /> },
  };
  return typeMap[type] || { color: 'default', text: type, icon: <FileTextOutlined /> };
};

/**
 * 提取模板变量（支持 pdfme schemas 和纯文本 {{key}}）
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
    // 非 pdfme JSON，尝试 {{key}} 提取
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
 * 打印模板管理列表页面组件
 */
const PrintTemplateListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [allTemplates, setAllTemplates] = useState<PrintTemplate[]>([]); // 用于统计
  
  // Modal 相关状态（创建/编辑打印模板）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPrintTemplateUuid, setCurrentPrintTemplateUuid] = useState<string | null>(null);
  const [currentEditDetail, setCurrentEditDetail] = useState<PrintTemplate | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<ProFormInstance>(null);
  
  // Modal 相关状态（渲染模板）
  const [renderModalVisible, setRenderModalVisible] = useState(false);
  const [renderFormLoading, setRenderFormLoading] = useState(false);
  const [currentRenderTemplateUuid, setCurrentRenderTemplateUuid] = useState<string | null>(null);
  const [renderFormRef] = Form.useForm();
  const [renderResult, setRenderResult] = useState<PrintTemplateRenderResponse | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<PrintTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建打印模板
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPrintTemplateUuid(null);
    setCurrentEditDetail(null);
    setFormInitialValues({
      type: 'pdf',
      document_type: undefined,
      is_active: true,
      is_default: false,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑打印模板
   */
  const handleEdit = async (record: PrintTemplate) => {
    try {
      setIsEdit(true);
      setCurrentPrintTemplateUuid(record.uuid);
      
      // 获取打印模板详情
      const detail = await getPrintTemplateByUuid(record.uuid);
      setCurrentEditDetail(detail);
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        type: detail.type,
        document_type: detail.config?.document_type,
        description: detail.description,
        is_active: detail.is_active,
        is_default: detail.is_default,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printTemplates.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: PrintTemplate) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getPrintTemplateByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printTemplates.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理渲染模板
   */
  const handleRender = (record: PrintTemplate) => {
    setCurrentRenderTemplateUuid(record.uuid);
    setRenderModalVisible(true);
    setRenderResult(null);
    renderFormRef.resetFields();
    renderFormRef.setFieldsValue({
      output_format: 'pdf',
      async_execution: false,
    });
  };

  /**
   * 处理渲染模板表单提交
   */
  const handleRenderSubmit = async (values: any) => {
    if (!currentRenderTemplateUuid) return;
    
    try {
      setRenderFormLoading(true);
      setRenderResult(null);
      
      const data: RenderPrintTemplateData = {
        data: values.data ? JSON.parse(values.data) : {},
        output_format: values.output_format || 'pdf',
        async_execution: values.async_execution || false,
      };
      
      const result = await renderPrintTemplate(currentRenderTemplateUuid, data);
      setRenderResult(result);
      
      if (result.success) {
        messageApi.success(t('pages.system.printTemplates.renderSuccess'));
      } else {
        messageApi.error(result.error || t('pages.system.printTemplates.renderFailed'));
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printTemplates.renderFailed'));
    } finally {
      setRenderFormLoading(false);
    }
  };

  /**
   * 处理删除打印模板
   */
  const handleDelete = async (record: PrintTemplate) => {
    try {
      await deletePrintTemplate(record.uuid);
      messageApi.success(t('pages.system.printTemplates.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printTemplates.deleteFailed'));
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.printTemplates.selectToDelete'));
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deletePrintTemplate(key as string)));
      messageApi.success(t('pages.system.printTemplates.batchDeleteSuccess'));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(t('pages.system.printTemplates.batchDeleteFailed'));
    }
  };

  /**
   * 打开设计器 (新标签页)
   */
  const handleOpenDesigner = (record: PrintTemplate) => {
    // 在当前标签页打开
    navigate(`/system/print-templates/design/${record.uuid}`);
  };

  /**
   * 创建示例工单模板（pdfme 格式，含工单二维码）
   */
  const createSampleWorkOrderTemplate = async () => {
    try {
      await createPrintTemplate({
        name: t('pages.system.printTemplates.workOrderTemplateName'),
        code: DOCUMENT_TYPE_TO_CODE.work_order,
        type: 'pdf',
        description: t('pages.system.printTemplates.workOrderTemplateDescription'),
        content: JSON.stringify(DEFAULT_WORK_ORDER_PDFME_TEMPLATE),
        config: { document_type: 'work_order' },
        is_active: true,
        is_default: true,
      });

      messageApi.success(t('pages.system.printTemplates.workOrderTemplateCreated'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printTemplates.createWorkOrderFailed'));
    }
  };

  /**
   * 保存设计器内容
   */


  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPrintTemplateUuid) {
        const updateData: UpdatePrintTemplateData = {
          name: values.name,
          description: values.description,
          is_active: values.is_active,
          is_default: values.is_default,
          config: { ...(currentEditDetail?.config || {}), document_type: values.document_type },
        };
        await updatePrintTemplate(currentPrintTemplateUuid, updateData);
        messageApi.success(t('pages.system.printTemplates.updateSuccess'));
      } else {
        const data: CreatePrintTemplateData = {
          name: values.name,
          code: DOCUMENT_TYPE_TO_CODE[values.document_type] || values.code,
          type: values.type,
          description: values.description,
          content: EMPTY_PDFME_TEMPLATE_JSON,
          config: { document_type: values.document_type },
        };
        await createPrintTemplate(data);
        messageApi.success(t('pages.system.printTemplates.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.printTemplates.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 计算统计信息
   */
  const statCards = useMemo(() => {
    if (allTemplates.length === 0) return undefined;
    
    const stats = {
      total: allTemplates.length,
      active: allTemplates.filter((t) => t.is_active).length,
      inactive: allTemplates.filter((t) => !t.is_active).length,
      default: allTemplates.filter((t) => t.is_default).length,
      totalUsage: allTemplates.reduce((sum, t) => sum + (t.usage_count || 0), 0),
    };

    return [
      { title: t('pages.system.printTemplates.statTotal'), value: stats.total, valueStyle: { color: '#1890ff' } },
      { title: t('pages.system.printTemplates.statActive'), value: stats.active, valueStyle: { color: '#52c41a' } },
      { title: t('pages.system.printTemplates.statDefault'), value: stats.default, valueStyle: { color: '#faad14' } },
      { title: t('pages.system.printTemplates.statUsage'), value: stats.totalUsage, valueStyle: { color: '#722ed1' } },
    ];
  }, [allTemplates, t]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (template: PrintTemplate, index: number) => {
    const typeInfo = getTypeInfo(template.type, t('pages.system.printTemplates.typeOther'));
    const variables = extractVariables(template.content);
    
    return (
      <Card
        key={template.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title={t('pages.system.printTemplates.viewDetail')}>
            <EyeOutlined
              onClick={() => handleView(template)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Tooltip key="render" title={t('pages.system.printTemplates.renderTemplate')}>
            <PrinterOutlined
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
            
            {variables.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{t('pages.system.printTemplates.variablesLabel')}</Text>
                <Space wrap size={[4, 4]} style={{ marginTop: 4 }}>
                  {variables.slice(0, 3).map((v) => (
                    <Tag key={v} style={{ fontSize: 10, margin: 0 }}>{v}</Tag>
                  ))}
                  {variables.length > 3 && (
                    <Tag style={{ fontSize: 10, margin: 0 }}>+{variables.length - 3}</Tag>
                  )}
                </Space>
              </div>
            )}
            
            {template.last_used_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printTemplates.lastUsedLabel')}</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(template.last_used_at).fromNow()}
                </Text>
              </div>
            )}
          </Space>
        </div>
      </Card>
    );
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<PrintTemplate>[] = [
    { title: t('pages.system.printTemplates.columnName'), dataIndex: 'name', width: 200, ellipsis: true },
    { title: t('pages.system.printTemplates.columnCode'), dataIndex: 'code', width: 150, ellipsis: true },
    {
      title: t('pages.system.printTemplates.columnType'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        pdf: { text: 'PDF' },
        html: { text: 'HTML' },
        word: { text: 'Word' },
        excel: { text: 'Excel' },
        other: { text: t('pages.system.printTemplates.typeOther') },
      },
      render: (_, record) => {
        const typeInfo = getTypeInfo(record.type, t('pages.system.printTemplates.typeOther'));
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.printTemplates.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.printTemplates.enabled'), status: 'Success' },
        false: { text: t('pages.system.printTemplates.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.printTemplates.enabled') : t('pages.system.printTemplates.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printTemplates.columnDefault'),
      dataIndex: 'is_default',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_default ? 'processing' : 'default'}>
          {record.is_default ? t('pages.system.printTemplates.defaultTag') : '-'}
        </Tag>
      ),
    },
    { title: t('pages.system.printTemplates.columnUsage'), dataIndex: 'usage_count', width: 100, hideInSearch: true },
    { title: t('pages.system.printTemplates.columnLastUsed'), dataIndex: 'last_used_at', width: 180, valueType: 'dateTime', hideInSearch: true },
    { title: t('pages.system.printTemplates.columnCreatedAt'), dataIndex: 'created_at', width: 180, valueType: 'dateTime', hideInSearch: true },
    {
      title: t('pages.system.printTemplates.columnActions'),
      dataIndex: 'option',
      valueType: 'option',
      width: 200,
      render: (_, record) => (
        <Space>
          <a onClick={() => handleEdit(record)}>{t('pages.system.printTemplates.edit')}</a>
          <a onClick={() => handleOpenDesigner(record)}>{t('pages.system.printTemplates.design')}</a>
          <a onClick={() => handleView(record)}>{t('pages.system.printTemplates.detail')}</a>
          <Popconfirm
            title={t('pages.system.printTemplates.deleteConfirmTitle')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <a style={{ color: '#ff4d4f' }}>{t('pages.system.printTemplates.deleteTooltip')}</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: t('pages.system.printTemplates.columnName'), dataIndex: 'name' },
    { title: t('pages.system.printTemplates.columnCode'), dataIndex: 'code' },
    { title: t('pages.system.printTemplates.columnType'), dataIndex: 'type' },
    { title: t('pages.system.printTemplates.labelDescription'), dataIndex: 'description' },
    {
      title: t('pages.system.printTemplates.columnActive'),
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? t('pages.system.printTemplates.enabled') : t('pages.system.printTemplates.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printTemplates.columnDefault'),
      dataIndex: 'is_default',
      render: (value: boolean) => (
        <Tag color={value ? 'processing' : 'default'}>
          {value ? t('pages.system.printTemplates.defaultTag') : '-'}
        </Tag>
      ),
    },
    {
      title: t('pages.system.printTemplates.columnContent'),
      dataIndex: 'content',
      render: (value: string) => (
        <pre style={{ maxHeight: '300px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          {value}
        </pre>
      ),
    },
    {
      title: t('pages.system.printTemplates.columnConfig'),
      dataIndex: 'config',
      render: (value: Record<string, any>) => (
        value ? (
          <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            {JSON.stringify(value, null, 2)}
          </pre>
        ) : '-'
      ),
    },
    { title: t('pages.system.printTemplates.columnUsage'), dataIndex: 'usage_count' },
    { title: t('pages.system.printTemplates.columnLastUsed'), dataIndex: 'last_used_at', valueType: 'dateTime' },
    { title: t('pages.system.printTemplates.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.printTemplates.columnUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PrintTemplate>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const { current = 1, pageSize = 20 } = params;
            const skip = (current - 1) * pageSize;
            const limit = pageSize;
            
            const listParams: any = {
              skip,
              limit,
              ...searchFormValues,
            };
            
            try {
              const data = await getPrintTemplateList(listParams);
              
              // 同时获取所有数据用于统计（如果当前页是第一页）
              if (current === 1) {
                try {
                  const allData = await getPrintTemplateList({ skip: 0, limit: 1000 });
                  setAllTemplates(allData);
                } catch (e) {
                  // 忽略统计数据的错误
                }
              }
              
              return {
                data,
                success: true,
                total: data.length, // 注意：这里应该返回实际总数，如果API支持的话
              };
            } catch (error: any) {
              console.error('获取打印模板列表失败:', error);
              messageApi.error(error?.message || t('pages.system.printTemplates.loadListFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText={t('pages.system.printTemplates.createButton')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.printTemplates.batchDelete')}
          toolBarRender={() => [
            <Button key="createSample" onClick={createSampleWorkOrderTemplate}>
              {t('pages.system.printTemplates.createWorkOrderButton')}
            </Button>,
          ]}
          showImportButton
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: PrintTemplate[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getPrintTemplateByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              items = await getPrintTemplateList({ skip: 0, limit: 10000 });
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.printTemplates.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `print-templates-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.printTemplates.exportSuccess'));
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          viewTypes={['table', 'card', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.printTemplates.modalEdit') : t('pages.system.printTemplates.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
          setCurrentEditDetail(null);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        onValuesChange={(changed, all) => {
          if ('document_type' in changed && all.document_type) {
            const code = DOCUMENT_TYPE_TO_CODE[all.document_type];
            if (code) formRef.current?.setFieldValue('code', code);
          }
        }}
      >
        <ProFormText
          name="name"
          label={t('pages.system.printTemplates.labelName')}
          rules={[{ required: true, message: t('pages.system.printTemplates.nameRequired') }]}
        />
        <SafeProFormSelect
          name="document_type"
          label={t('pages.system.printTemplates.labelDocumentType')}
          rules={[{ required: true, message: t('pages.system.printTemplates.documentTypeRequired') }]}
          options={DOCUMENT_TYPE_OPTIONS}
          tooltip={t('pages.system.printTemplates.documentTypeTooltip')}
        />
        <ProFormText
          name="code"
          label={t('pages.system.printTemplates.labelCode')}
          rules={[{ required: true, message: t('pages.system.printTemplates.codeRequired') }]}
          disabled
          tooltip={t('pages.system.printTemplates.codeTooltip')}
        />
        <SafeProFormSelect
          name="type"
          label={t('pages.system.printTemplates.labelOutputFormat')}
          rules={[{ required: true, message: t('pages.system.printTemplates.outputFormatRequired') }]}
          options={[
            { label: 'PDF', value: 'pdf' },
            { label: 'HTML', value: 'html' },
            { label: 'Word', value: 'word' },
            { label: 'Excel', value: 'excel' },
            { label: t('pages.system.printTemplates.typeOther'), value: 'other' },
          ]}
          disabled={isEdit}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.printTemplates.labelDescription')}
          fieldProps={{ rows: 3 }}
        />

        {isEdit && (
          <>
            <ProFormSwitch name="is_active" label={t('pages.system.printTemplates.labelActive')} />
            <ProFormSwitch name="is_default" label={t('pages.system.printTemplates.labelDefault')} />
          </>
        )}
      </FormModalTemplate>

      {/* 渲染模板 Modal */}
      <Modal
        title={t('pages.system.printTemplates.renderModalTitle')}
        open={renderModalVisible}
        onCancel={() => setRenderModalVisible(false)}
        footer={null}
        width={700}
      >
        <ProForm
          formRef={renderFormRef}
          loading={renderFormLoading}
          onFinish={handleRenderSubmit}
          submitter={{
            searchConfig: {
              submitText: t('pages.system.printTemplates.submitRender'),
            },
          }}
        >
          <ProFormTextArea
            name="data"
            label={t('pages.system.printTemplates.labelTemplateData')}
            rules={[{ required: true, message: t('pages.system.printTemplates.templateDataRequired') }]}
            fieldProps={{
              rows: 6,
              style: { fontFamily: CODE_FONT_FAMILY },
              placeholder: t('pages.system.printTemplates.templateDataPlaceholder'),
            }}
            tooltip={t('pages.system.printTemplates.templateDataTooltip')}
          />
          <SafeProFormSelect
            name="output_format"
            label={t('pages.system.printTemplates.labelOutputFormat')}
            options={[
              { label: 'PDF', value: 'pdf' },
              { label: 'HTML', value: 'html' },
            ]}
          />
          <ProFormSwitch
            name="async_execution"
            label={t('pages.system.printTemplates.labelAsync')}
            tooltip={t('pages.system.printTemplates.asyncTooltip')}
          />
        </ProForm>
        
        {renderResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('pages.system.printTemplates.resultTitle')}</div>
            {renderResult.success ? (
              <div style={{ color: '#52c41a' }}>{t('pages.system.printTemplates.resultSuccess')}</div>
            ) : (
              <div style={{ color: '#ff4d4f' }}>{t('pages.system.printTemplates.resultFailed')}</div>
            )}
            {renderResult.error && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{t('pages.system.printTemplates.errorLabel')}</div>
                <pre style={{ background: '#fff', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', color: '#ff4d4f' }}>
                  {renderResult.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<PrintTemplate>
        title={t('pages.system.printTemplates.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData || undefined}
        columns={detailColumns as any}
      />
    </>
  );
};

export default PrintTemplateListPage;
