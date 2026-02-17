/**
 * 打印模板管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的打印模板。
 * 支持打印模板的 CRUD 操作和模板渲染功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProForm } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Modal, Input, Form, Space, Typography, Tooltip, Card } from 'antd';
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
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_TO_CODE } from '../../../../configs/printTemplateSchemas';
import { EMPTY_UNIVER_DOC_JSON } from '../../../../components/univer-doc/constants';

import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;

/**
 * 获取模板类型图标和颜色
 */
const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
  const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    pdf: { 
      color: 'red', 
      text: 'PDF',
      icon: <FileTextOutlined />,
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
 * 提取模板变量（支持 Univer JSON 的 dataStream 和纯文本）
 */
const extractVariables = (content: string): string[] => {
  if (!content) return [];
  let text = content;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.body?.dataStream && typeof parsed.body.dataStream === 'string') {
      text = parsed.body.dataStream;
    }
  } catch {
    // 非 JSON，使用原始 content
  }
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = text.matchAll(regex);
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
  const { message: messageApi } = App.useApp();
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
      messageApi.error(error.message || '获取打印模板详情失败');
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
      messageApi.error(error.message || '获取打印模板详情失败');
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
        messageApi.success('模板渲染成功');
      } else {
        messageApi.error(result.error || '模板渲染失败');
      }
      
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '模板渲染失败');
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
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请选择要删除的打印模板');
      return;
    }
    
    try {
      await Promise.all(selectedRowKeys.map((key) => deletePrintTemplate(key as string)));
      messageApi.success('批量删除成功');
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('批量删除失败');
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
   * 创建示例工单模板
   */
  const createSampleWorkOrderTemplate = async () => {
    try {
      const sampleConfig: ReportConfig = {
        version: '1.0',
        layout: {
          width: 800,
          height: 1123, // A4 pixel height (approx)
          type: 'A4',
        },
        components: [
          // 标题
          {
            id: 'title',
            type: 'text',
            x: 0,
            y: 30,
            width: 800,
            height: 60,
            content: '生产工单',
            style: {
              fontSize: 24,
              fontWeight: 'bold',
              textAlign: 'center',
            }
          } as ReportComponent,
          // 基本信息区域
          {
            id: 'info-panel',
            type: 'text',
            x: 40,
            y: 100,
            width: 720,
            height: 150,
            content: `工单编号：{{work_order_no}}
产品名称：{{product_name}}
产品编码：{{product_code}}
计划数量：{{plan_quantity}}
单位：{{unit}}
计划开始时间：{{plan_start_time}}
计划结束时间：{{plan_end_time}}`,
            style: {
              fontSize: 14,
              lineHeight: 1.8,
              border: '1px solid #ccc',
              padding: '10px',
            }
          } as ReportComponent,
          // 物料清单标题
          {
            id: 'material-title',
            type: 'text',
            x: 40,
            y: 270,
            width: 200,
            height: 40,
            content: '物料清单',
            style: {
              fontSize: 16,
              fontWeight: 'bold',
            }
          } as ReportComponent,
          // 物料清单表格
          {
            id: 'material-table',
            type: 'table',
            x: 40,
            y: 310,
            width: 720,
            height: 300,
            columns: [
              { title: '物料编码', dataIndex: 'material_code', width: 150 },
              { title: '物料名称', dataIndex: 'material_name', width: 250 },
              { title: '规格型号', dataIndex: 'spec', width: 150 },
              { title: '需求数量', dataIndex: 'quantity', width: 100 },
              { title: '单位', dataIndex: 'unit', width: 70 },
            ],
            dataSource: 'materials', // 关联数据源 key
            style: {
              border: '1px solid #000',
            }
          } as ReportComponent,
          // 备注
          {
            id: 'remark',
            type: 'text',
            x: 40,
            y: 650,
            width: 720,
            height: 100,
            content: '备注：\n{{remark}}',
            style: {
              fontSize: 14,
              border: '1px solid #ccc',
              padding: '10px',
            }
          } as ReportComponent,
          // 底部信息
          {
            id: 'footer',
            type: 'text',
            x: 40,
            y: 1000,
            width: 720,
            height: 40,
            content: '打印时间：{{print_time}}    操作员：{{operator}}',
            style: {
              fontSize: 12,
              textAlign: 'right',
            }
          } as ReportComponent,
        ]
      };

      await createPrintTemplate({
        name: '示例生产工单模板',
        code: 'SAMPLE_WORK_ORDER_' + Date.now(),
        type: 'other',
        description: '自动生成的示例生产工单模板，包含基本信息和物料表格。',
        content: JSON.stringify(sampleConfig),
        config: sampleConfig.layout,
        is_active: true,
      });

      messageApi.success('示例模板创建成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建示例模板失败');
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
        messageApi.success('更新成功');
      } else {
        const data: CreatePrintTemplateData = {
          name: values.name,
          code: DOCUMENT_TYPE_TO_CODE[values.document_type] || values.code,
          type: values.type,
          description: values.description,
          content: EMPTY_UNIVER_DOC_JSON,
          config: { document_type: values.document_type },
        };
        await createPrintTemplate(data);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
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
      {
        title: '总模板数',
        value: stats.total,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: '已启用',
        value: stats.active,
        valueStyle: { color: '#52c41a' },
      },
      {
        title: '默认模板',
        value: stats.default,
        valueStyle: { color: '#faad14' },
      },
      {
        title: '总使用次数',
        value: stats.totalUsage,
        valueStyle: { color: '#722ed1' },
      },
    ];
  }, [allTemplates]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (template: PrintTemplate, index: number) => {
    const typeInfo = getTypeInfo(template.type);
    const variables = extractVariables(template.content);
    
    return (
      <Card
        key={template.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title="查看详情">
            <EyeOutlined
              onClick={() => handleView(template)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Tooltip key="render" title="渲染模板">
            <PrinterOutlined
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
            
            {variables.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>变量：</Text>
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
                <Text type="secondary" style={{ fontSize: 12 }}>最后使用：</Text>
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
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '模板代码',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '模板类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        pdf: { text: 'PDF' },
        html: { text: 'HTML' },
        word: { text: 'Word' },
        excel: { text: 'Excel' },
        other: { text: '其他' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          pdf: { color: 'red', text: 'PDF' },
          html: { color: 'blue', text: 'HTML' },
          word: { color: 'green', text: 'Word' },
          excel: { color: 'purple', text: 'Excel' },
          other: { color: 'default', text: '其他' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '是否默认',
      dataIndex: 'is_default',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.is_default ? 'processing' : 'default'}>
          {record.is_default ? '默认' : '-'}
        </Tag>
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '最后使用时间',
      dataIndex: 'last_used_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 200,
      render: (_, record) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <a onClick={() => handleOpenDesigner(record)}>设计</a>
          <a onClick={() => handleView(record)}>详情</a>
          <Popconfirm
            title="确定要删除这个打印模板吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    {
      title: '模板名称',
      dataIndex: 'name',
    },
    {
      title: '模板代码',
      dataIndex: 'code',
    },
    {
      title: '模板类型',
      dataIndex: 'type',
    },
    {
      title: '模板描述',
      dataIndex: 'description',
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '是否默认',
      dataIndex: 'is_default',
      render: (value: boolean) => (
        <Tag color={value ? 'processing' : 'default'}>
          {value ? '默认' : '-'}
        </Tag>
      ),
    },
    {
      title: '模板内容',
      dataIndex: 'content',
      render: (value: string) => (
        <pre style={{ maxHeight: '300px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          {value}
        </pre>
      ),
    },
    {
      title: '模板配置',
      dataIndex: 'config',
      render: (value: Record<string, any>) => (
        value ? (
          <pre style={{ maxHeight: '200px', overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            {JSON.stringify(value, null, 2)}
          </pre>
        ) : '-'
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
    },
    {
      title: '最后使用时间',
      dataIndex: 'last_used_at',
      valueType: 'dateTime',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
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
              messageApi.error(error?.message || '获取打印模板列表失败');
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
          onCreate={handleCreate}
          toolBarRender={() => [
            <Button
              key="createSample"
              onClick={createSampleWorkOrderTemplate}
            >
              一键生成工单模板
            </Button>,
            <Button
              key="batchDelete"
              danger
              onClick={handleBatchDelete}
              disabled={selectedRowKeys.length === 0}
            >
              批量删除
            </Button>,
          ]}
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
        title={isEdit ? '编辑打印模板' : '新建打印模板'}
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
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        />
        <SafeProFormSelect
          name="document_type"
          label="关联业务单据"
          rules={[{ required: true, message: '请选择关联的业务单据类型，设计时可绑定对应变量' }]}
          options={DOCUMENT_TYPE_OPTIONS}
          tooltip="选择后，模板代码将自动生成，设计器将显示该单据的可用变量"
        />
        <ProFormText
          name="code"
          label="模板代码"
          rules={[{ required: true, message: '请先选择关联业务单据' }]}
          disabled
          tooltip="根据关联业务单据自动生成，创建后不可修改"
        />
        <SafeProFormSelect
          name="type"
          label="输出格式"
          rules={[{ required: true, message: '请选择输出格式' }]}
          options={[
            { label: 'PDF', value: 'pdf' },
            { label: 'HTML', value: 'html' },
            { label: 'Word', value: 'word' },
            { label: 'Excel', value: 'excel' },
            { label: '其他', value: 'other' },
          ]}
          disabled={isEdit}
        />
        <ProFormTextArea
          name="description"
          label="模板描述"
          fieldProps={{
            rows: 3,
          }}
        />

        {isEdit && (
          <>
            <ProFormSwitch
              name="is_active"
              label="是否启用"
            />
            <ProFormSwitch
              name="is_default"
              label="是否默认模板"
            />
          </>
        )}
      </FormModalTemplate>

      {/* 渲染模板 Modal */}
      <Modal
        title="渲染打印模板"
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
              submitText: '渲染',
            },
          }}
        >
          <ProFormTextArea
            name="data"
            label="模板数据（JSON）"
            rules={[{ required: true, message: '请输入模板数据' }]}
            fieldProps={{
              rows: 6,
              style: { fontFamily: CODE_FONT_FAMILY },
              placeholder: '{"title": "标题", "content": "内容"}',
            }}
            tooltip="模板数据，JSON 格式，用于替换模板中的变量"
          />
          <SafeProFormSelect
            name="output_format"
            label="输出格式"
            options={[
              { label: 'PDF', value: 'pdf' },
              { label: 'HTML', value: 'html' },
            ]}
          />
          <ProFormSwitch
            name="async_execution"
            label="异步执行（通过 Inngest）"
            tooltip="如果启用，模板渲染将通过 Inngest 异步执行"
          />
        </ProForm>
        
        {renderResult && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>渲染结果：</div>
            {renderResult.success ? (
              <div style={{ color: '#52c41a' }}>✓ 渲染成功</div>
            ) : (
              <div style={{ color: '#ff4d4f' }}>✗ 渲染失败</div>
            )}
            {renderResult.error && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>错误：</div>
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
        title="打印模板详情"
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
