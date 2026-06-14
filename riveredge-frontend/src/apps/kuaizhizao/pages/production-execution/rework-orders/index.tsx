/**
 * 返工单管理页面
 *
 * 提供返工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持从原工单创建返工单。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormItem, ProFormDependency } from '@ant-design/pro-components';
import { App, Button, Card, Col, Modal, Row, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, FormOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { DetailDrawerActions, DetailDrawerSection, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { reworkOrderApi, workOrderApi } from '../../../services/production';
import { getReworkOrderLifecycle } from '../../../utils/reworkOrderLifecycle';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

const REWORK_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_rework_orders';

interface ReworkOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  original_work_order_id?: number;
  original_work_order_uuid?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  rework_reason?: string;
  rework_type?: string;
  status?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  workshop_id?: number;
  workshop_name?: string;
  work_center_id?: number;
  work_center_name?: string;
  completed_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  start_work_order_operation_id?: number;
  rework_operations?: Array<{
    work_order_operation_id: number;
    operation_name?: string;
    operation_code?: string;
    is_start?: boolean;
  }>;
}

const REWORK_TYPE_FALLBACK = [
  { label: '返工', value: '返工' },
  { label: '返修', value: '返修' },
  { label: '报废', value: '报废' },
];

const ReworkOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const currentUser = useGlobalStore((s) => s.currentUser);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [reworkTypeOptions, setReworkTypeOptions] = useState<Array<{ label: string; value: string }>>(REWORK_TYPE_FALLBACK);
  const [reworkTypeLoading, setReworkTypeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setReworkTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('REWORK_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        setReworkTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setReworkTypeOptions(REWORK_TYPE_FALLBACK);
      } finally {
        setReworkTypeLoading(false);
      }
    };
    load();
  }, []);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentReworkOrder, setCurrentReworkOrder] = useState<ReworkOrder | null>(null);
  const formRef = useRef<any>(null);
  /** 选择原工单后，产品仅限该工单的产品 */
  const [workOrderProduct, setWorkOrderProduct] = useState<{ id: number; code: string; name: string } | null>(null);
  const [workOrderProductLoading, setWorkOrderProductLoading] = useState(false);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [reworkOrderDetail, setReworkOrderDetail] = useState<ReworkOrder | null>(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportSubmitLoading, setReportSubmitLoading] = useState(false);
  const [currentReworkOrderForReport, setCurrentReworkOrderForReport] = useState<ReworkOrder | null>(null);
  const [reportingOptions, setReportingOptions] = useState<any>(null);
  const reportFormRef = useRef<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const {
    customFields: reworkFormCustomFields,
    customFieldValues: reworkFormCustomFieldValues,
    loadFieldValues: loadReworkFormFieldValues,
    extractFormValues: extractReworkFormValues,
    saveCustomFieldValues: saveReworkCustomFieldValues,
    resetFieldValues: resetReworkFormFieldValues,
  } = useCustomFields({ tableName: REWORK_ORDER_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: reworkListCustomFields,
    generateCustomFieldColumns: generateReworkCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichReworkRecordsWithCustomFields,
    customFieldValues: reworkDetailCustomFieldValues,
    loadFieldValuesForDetail: loadReworkFieldValuesForDetail,
    resetDetailFieldValues: resetReworkDetailFieldValues,
  } = useCustomFieldsForList<ReworkOrder>({ tableName: REWORK_ORDER_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (reworkListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [reworkListCustomFields.length]);

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<ReworkOrder>[] = [
    {
      title: '返工单编号',
      dataIndex: 'code',
    },
    {
      title: '原工单ID',
      dataIndex: 'original_work_order_id',
    },
    {
      title: '产品编号',
      dataIndex: 'product_code',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      span: 2,
    },
    {
      title: '返工数量',
      dataIndex: 'quantity',
    },
    {
      title: '返工类型',
      dataIndex: 'rework_type',
      render: (_, record) => {
        const text = String(record.rework_type ?? '');
        const typeMap: Record<string, { text: string; color: string }> = {
          '返工': { text: '返工', color: 'blue' },
          '返修': { text: '返修', color: 'orange' },
          '报废': { text: '报废', color: 'red' },
        };
        const config = typeMap[text] || { text: text || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '返工起始工序',
      dataIndex: 'rework_operations',
      span: 2,
      render: (_: any, record: any) => {
        const startOp = (record.rework_operations || []).find((o: any) => o.is_start)
          || (record.rework_operations || [])[0];
        if (!startOp) return '-';
        return `${startOp.operation_code || ''} ${startOp.operation_name || ''}`.trim() || `工序#${startOp.work_order_operation_id}`;
      },
    },
    {
      title: '车间',
      dataIndex: 'workshop_name',
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
    },
    {
      title: '实际开始时间',
      dataIndex: 'actual_start_date',
      valueType: 'dateTime',
      render: (text) => formatDateTimeBySiteSetting(text),
    },
    {
      title: '实际结束时间',
      dataIndex: 'actual_end_date',
      valueType: 'dateTime',
      render: (text) => formatDateTimeBySiteSetting(text),
    },
    {
      title: '已完成数量',
      dataIndex: 'completed_quantity',
      render: (text) => text || 0,
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReworkOrder>[] = useMemo(() => {
    const customFieldColumns = generateReworkCustomFieldColumns();
    return [
    {
      title: '返工单编号',
      dataIndex: 'code',
      width: 180,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '原工单ID',
      dataIndex: 'original_work_order_id',
      width: 120,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '返工数量',
      dataIndex: 'quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '返工类型',
      dataIndex: 'rework_type',
      width: 100,
      render: (_, record) => {
        const text = String(record.rework_type ?? '');
        const typeMap: Record<string, { text: string; color: string }> = {
          '返工': { text: '返工', color: 'blue' },
          '返修': { text: '返修', color: 'orange' },
          '报废': { text: '报废', color: 'red' },
        };
        const config = typeMap[text] || { text: text || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
      ellipsis: true,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      valueEnum: {
        draft: { text: '草稿', status: 'Default' },
        released: { text: '已下达', status: 'Processing' },
        in_progress: { text: '执行中', status: 'Processing' },
        completed: { text: '已完成', status: 'Success' },
        cancelled: { text: '已取消', status: 'Error' },
      },
      render: (_, record) => {
        const lifecycle = getReworkOrderLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        return <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{stageName}</Tag>;
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      sorter: true,
    },
    ...customFieldColumns,
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_text, record) => {
        const lifecycle = getReworkOrderLifecycle(record);
        const canEdit = lifecycle.stageName !== '已完成' && lifecycle.stageName !== '已取消';
        const canDelete = lifecycle.stageName === '草稿';
        const canReport =
          lifecycle.stageName === '已下达' || lifecycle.stageName === '执行中';
        return (
          <Space>
            <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>详情</Button>
            {canReport ? (
              <Button{...rowActionKind('delete')} key="delete"
                type="link"
                size="small"
                icon={<FormOutlined />}
                onClick={() => void handleOpenReport(record)}
              >
                报工
              </Button>
            ) : null}
            <Button key="edit" {...rowActionKind('update')}
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={!canEdit}
            >
              编辑
            </Button>
            {canDelete && (
              <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDelete(record)}>删除</Button>
            )}
          </Space>
        );
      },
    },
  ];
  }, [reworkListCustomFields, generateReworkCustomFieldColumns]);

  /**
   * 处理详情查看
   */
  const handleDetail = async (record: ReworkOrder) => {
    try {
      const detail = await reworkOrderApi.get(record.id!.toString());
      setReworkOrderDetail(detail);
      setDetailDrawerVisible(true);
      if (detail.id != null) {
        await loadReworkFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error('获取返工单详情失败');
    }
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (record: ReworkOrder) => {
    try {
      const detail = await reworkOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentReworkOrder(detail);
      setModalVisible(true);
      setTimeout(() => {
        if (detail.original_work_order_id && detail.product_id) {
          setWorkOrderProduct({
            id: detail.product_id,
            code: detail.product_code || '',
            name: detail.product_name || '',
          });
        } else {
          setWorkOrderProduct(null);
        }
        formRef.current?.setFieldsValue({
          code: detail.code,
          original_work_order_id: detail.original_work_order_id,
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          quantity: detail.quantity,
          rework_reason: detail.rework_reason,
          rework_type: detail.rework_type,
          planned_start_date: detail.planned_start_date,
          planned_end_date: detail.planned_end_date,
          completed_quantity: detail.completed_quantity,
          qualified_quantity: detail.qualified_quantity,
          unqualified_quantity: detail.unqualified_quantity,
          start_work_order_operation_id:
            detail.start_work_order_operation_id
            ?? (detail.rework_operations || []).find((o: any) => o.is_start)?.work_order_operation_id
            ?? (detail.rework_operations || [])[0]?.work_order_operation_id,
          remarks: detail.remarks,
        });
        if (detail.id != null) {
          loadReworkFormFieldValues(detail.id).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }
      }, 100);
    } catch (error) {
      messageApi.error('获取返工单详情失败');
    }
  };

  const handleOpenReport = async (record: ReworkOrder) => {
    if (!record.id) return;
    try {
      const [detail, options] = await Promise.all([
        reworkOrderApi.get(record.id.toString()),
        reworkOrderApi.getReportingOptions(record.id.toString()),
      ]);
      setCurrentReworkOrderForReport(detail);
      setReportingOptions(options);
      setReportModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '加载返工报工选项失败');
    }
  };

  const reportFormInitialValues = useMemo(() => {
    if (!reportModalVisible || !reportingOptions) return undefined;
    const defaultOp = reportingOptions.operations?.find((op: any) => op.selectable);
    const remaining = Number(reportingOptions.remaining_rework_quantity ?? 0);
    return {
      work_order_operation_id: defaultOp?.work_order_operation_id,
      reported_quantity: remaining > 0 ? remaining : undefined,
      qualified_quantity: remaining > 0 ? remaining : undefined,
      unqualified_quantity: 0,
      work_hours: 0,
      reported_at: dayjs(),
    };
  }, [reportModalVisible, reportingOptions]);

  const handleSubmitReport = async (values: any): Promise<void> => {
    if (!currentReworkOrderForReport?.id) {
      throw new Error('返工单信息不存在');
    }
    setReportSubmitLoading(true);
    try {
      const workerId = currentUser?.id;
      const workerName =
        currentUser?.full_name || currentUser?.username || values.worker_name || '操作工';
      if (!workerId) {
        throw new Error('无法获取当前用户信息');
      }
      await reworkOrderApi.report(currentReworkOrderForReport.id.toString(), {
        work_order_operation_id: values.work_order_operation_id,
        worker_id: workerId,
        worker_name: workerName,
        reported_quantity: Number(values.reported_quantity),
        qualified_quantity: Number(values.qualified_quantity),
        unqualified_quantity: Number(values.unqualified_quantity ?? 0),
        work_hours: Number(values.work_hours ?? 0),
        reported_at: values.reported_at
          ? values.reported_at.toDate().toISOString()
          : new Date().toISOString(),
        remarks: values.remarks || undefined,
      });
      messageApi.success('返工报工成功');
      setReportModalVisible(false);
      setCurrentReworkOrderForReport(null);
      setReportingOptions(null);
      reportFormRef.current?.resetFields();
      actionRef.current?.reload();
      if (reworkOrderDetail?.id === currentReworkOrderForReport.id) {
        const refreshed = await reworkOrderApi.get(currentReworkOrderForReport.id.toString());
        setReworkOrderDetail(refreshed);
      }
    } catch (error: any) {
      messageApi.error(error.message || '返工报工失败');
      throw error;
    } finally {
      setReportSubmitLoading(false);
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: ReworkOrder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除返工单 "${record.code}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await reworkOrderApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReworkOrder(null);
    setWorkOrderProduct(null);
    resetReworkFormFieldValues();
    setModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractReworkFormValues(values);
      if (isEdit && currentReworkOrder?.id) {
        await reworkOrderApi.update(currentReworkOrder.id.toString(), standardValues);
        messageApi.success('返工单更新成功');
        await saveReworkCustomFieldValues(currentReworkOrder.id, customData);
      } else {
        const created = await reworkOrderApi.create(standardValues);
        if (created?.id != null) {
          await saveReworkCustomFieldValues(created.id, customData);
        }
        messageApi.success('返工单创建成功');
      }
      setModalVisible(false);
      resetReworkFormFieldValues();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理表格请求
   */
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    try {
      const response = await reworkOrderApi.list({
        page: params.current || 1,
        page_size: params.pageSize || 20,
      });
      const list = Array.isArray(response) ? response : [];
      const enriched = await enrichReworkRecordsWithCustomFields(list);
      return {
        data: enriched,
        success: true,
        total: enriched.length,
      };
    } catch (error: any) {
      messageApi.error('获取返工单列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  /**
   * 处理编辑（从选中行）
   */
  const handleEditFromSelection = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const detail = await reworkOrderApi.get(id.toString());
        setIsEdit(true);
        setCurrentReworkOrder(detail);
        setModalVisible(true);
        setTimeout(() => {
          if (detail.original_work_order_id && detail.product_id) {
            setWorkOrderProduct({
              id: detail.product_id,
              code: detail.product_code || '',
              name: detail.product_name || '',
            });
          } else {
            setWorkOrderProduct(null);
          }
          formRef.current?.setFieldsValue({
            code: detail.code,
            original_work_order_id: detail.original_work_order_id,
            product_id: detail.product_id,
            product_code: detail.product_code,
            product_name: detail.product_name,
            quantity: detail.quantity,
            rework_reason: detail.rework_reason,
            rework_type: detail.rework_type,
            planned_start_date: detail.planned_start_date,
            planned_end_date: detail.planned_end_date,
            completed_quantity: detail.completed_quantity,
            qualified_quantity: detail.qualified_quantity,
            unqualified_quantity: detail.unqualified_quantity,
            start_work_order_operation_id:
              detail.start_work_order_operation_id
              ?? (detail.rework_operations || []).find((o: any) => o.is_start)?.work_order_operation_id
              ?? (detail.rework_operations || [])[0]?.work_order_operation_id,
            remarks: detail.remarks,
          });
        }, 100);
      } catch (error) {
        messageApi.error('获取返工单详情失败');
      }
    } else {
      messageApi.warning('请选择一条返工单进行编辑');
    }
  };

  /**
   * 处理删除（从选中行）
   */
  const handleDeleteFromSelection = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的返工单');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${keys.length} 个返工单吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          for (const key of keys) {
            await reworkOrderApi.delete(key.toString());
          }
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  return (
    <ListPageTemplate>
      <UniTable<ReworkOrder>
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.rework-orders"
        headerTitle="返工单"
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        enableRowSelection={true}
        onRowSelectionChange={setSelectedRowKeys}
        showCreateButton={true}
        createButtonText="新建返工工单"
        onCreate={handleCreate}
        showEditButton={true}
        onEdit={handleEditFromSelection}
        showDeleteButton={true}
        onDelete={handleDeleteFromSelection}
        showAdvancedSearch={true}
      />
      {/* 表单Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑返工单' : '新建返工单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          resetReworkFormFieldValues();
        }}
        onFinish={handleSubmitForm}
        formRef={formRef}
        {...MODAL_CONFIG}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-production-rework-order"
              name="code"
              label="返工单编号"
              required={true}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
              disabled={isEdit}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="original_work_order_id"
              label="原工单"
              placeholder="请选择原工单"
              rules={[{ required: false }]}
              disabled={isEdit}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  option?.label?.toLowerCase().includes(input.toLowerCase()),
                onChange: async (value: number) => {
                  if (value) {
                    setWorkOrderProductLoading(true);
                    try {
                      const wo = await workOrderApi.get(String(value));
                      setWorkOrderProduct({
                        id: wo.product_id,
                        code: wo.product_code || '',
                        name: wo.product_name || '',
                      });
                      formRef.current?.setFieldsValue({
                        product_id: wo.product_id,
                        product_code: wo.product_code,
                        product_name: wo.product_name,
                        quantity: wo.quantity ?? undefined,
                      });
                    } catch {
                      messageApi.error('获取工单详情失败');
                      setWorkOrderProduct(null);
                    } finally {
                      setWorkOrderProductLoading(false);
                    }
                  } else {
                    setWorkOrderProduct(null);
                    formRef.current?.setFieldsValue({
                      product_id: undefined,
                      product_code: undefined,
                      product_name: undefined,
                      quantity: undefined,
                    });
                  }
                },
              }}
              request={async () => {
                const res = await workOrderApi.list({ limit: 200 });
                const items = res?.items ?? res?.data ?? (Array.isArray(res) ? res : []);
                return items.map((wo: any) => ({
                  label: `${wo.code || ''} - ${wo.name || wo.product_name || ''}`,
                  value: wo.id,
                }));
              }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDependency name={['original_work_order_id']}>
              {({ original_work_order_id }) =>
                original_work_order_id ? (
                  workOrderProduct ? (
                    <ProFormSelect
                      name="product_id"
                      label="产品"
                      placeholder="请选择产品"
                      required
                      options={[
                        {
                          value: workOrderProduct.id,
                          label: `${workOrderProduct.code} - ${workOrderProduct.name}`.trim() || String(workOrderProduct.id),
                        },
                      ]}
                      fieldProps={{ disabled: true }}
                    />
                  ) : (
                    <ProFormSelect
                      name="product_id"
                      label="产品"
                      placeholder={workOrderProductLoading ? '加载中...' : '请选择产品'}
                      required
                      options={[]}
                      fieldProps={{ disabled: true, loading: workOrderProductLoading }}
                    />
                  )
                ) : (
                  <UniMaterialSelect
                    name="product_id"
                    label="产品"
                    placeholder="请选择产品"
                    required
                    fillMapping={{
                      product_code: 'mainCode',
                      product_name: 'name',
                    }}
                    showQuickCreate
                    showAdvancedSearch
                  />
                )
              }
            </ProFormDependency>
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="quantity"
              label="返工数量"
              placeholder="请输入返工数量"
              rules={[{ required: true, message: '请输入返工数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
        </Row>
        <ProFormText name="product_code" hidden />
        <ProFormText name="product_name" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="rework_type" label="返工类型" rules={[{ required: true, message: '请选择返工类型' }]}>
              <UniDropdown
                placeholder="请选择返工类型"
                showSearch
                allowClear
                loading={reworkTypeLoading}
                style={{ width: '100%' }}
                options={reworkTypeOptions}
                quickCreate={{ label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') }}
              />
            </ProFormItem>
          </Col>
          <Col span={12} />
        </Row>
        <ProFormDependency name={['original_work_order_id']}>
          {({ original_work_order_id }) =>
            original_work_order_id ? (
              <ProFormSelect
                name="start_work_order_operation_id"
                label="返工起始工序"
                placeholder="不选则取原工单首道工序"
                allowClear
                fieldProps={{
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    option?.label?.toLowerCase().includes(input.toLowerCase()),
                }}
                request={async () => {
                  const ops = await workOrderApi.getOperations(String(original_work_order_id));
                  return (ops || []).map((op: any) => ({
                    label: `工序${op.sequence || ''} - ${op.operation_name || op.operation_code || ''}`,
                    value: op.id,
                  }));
                }}
              />
            ) : null
          }
        </ProFormDependency>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_start_date"
              label="计划开始时间"
              placeholder="请选择计划开始时间"
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_end_date"
              label="计划结束时间"
              placeholder="请选择计划结束时间"
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormDigit
              name="completed_quantity"
              label="已完成数量"
              placeholder="请输入已完成数量"
              initialValue={0}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
          <Col span={8}>
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              placeholder="请输入合格数量"
              initialValue={0}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
          <Col span={8}>
            <ProFormDigit
              name="unqualified_quantity"
              label="不合格数量"
              placeholder="请输入不合格数量"
              initialValue={0}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
        </Row>
        <ProFormTextArea
          name="rework_reason"
          label="返工原因"
          placeholder="请输入返工原因"
          rules={[{ required: true, message: '请输入返工原因' }]}
          fieldProps={{ rows: 3 }}
        />
        <CustomFieldsFormSection
          customFields={reworkFormCustomFields}
          customFieldValues={reworkFormCustomFieldValues}
          gridColumns={2}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="返工单详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          resetReworkDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={reworkOrderDetail ?? undefined}
        extra={
          reworkOrderDetail && (() => {
            const lifecycle = getReworkOrderLifecycle(reworkOrderDetail);
            const canEdit = lifecycle.stageName === '草稿';
            return (
              <DetailDrawerActions
                items={[
                  {
                    key: 'report',
                    visible:
                      getReworkOrderLifecycle(reworkOrderDetail).stageName === '已下达'
                      || getReworkOrderLifecycle(reworkOrderDetail).stageName === '执行中',
                    render: () => (
                      <Button
                        type="link"
                        size="small"
                        icon={<FormOutlined />}
                        onClick={() => {
                          setDetailDrawerVisible(false);
                          void handleOpenReport(reworkOrderDetail);
                        }}
                      >
                        报工
                      </Button>
                    ),
                  },
                  {
                    key: 'edit',
                    visible: canEdit,
                    render: () => (
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setDetailDrawerVisible(false);
                          handleEdit(reworkOrderDetail);
                        }}
                      >
                        编辑
                      </Button>
                    ),
                  },
                  {
                    key: 'delete',
                    visible: canEdit,
                    render: () => (
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(reworkOrderDetail)}
                      >
                        删除
                      </Button>
                    ),
                  },
                ]}
              />
            );
          })()
        }
      >
        {hasCustomFieldsDetailContent(reworkListCustomFields, reworkDetailCustomFieldValues) ? (
          <DetailDrawerSection title="自定义字段">
            <CustomFieldsDetailSection
              customFields={reworkListCustomFields}
              customFieldValues={reworkDetailCustomFieldValues}
            />
          </DetailDrawerSection>
        ) : null}
        {reworkOrderDetail && (() => {
          const lifecycle = getReworkOrderLifecycle(reworkOrderDetail);
          const mainStages = lifecycle.mainStages ?? [];
          if (mainStages.length === 0) return null;
          return (
            <DetailDrawerSection title="生命周期">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {mainStages.length > 0 && (
                  <UniLifecycleStepper
                    steps={mainStages}
                    status={lifecycle.status}
                    showLabels
                    nextStepSuggestions={lifecycle.nextStepSuggestions}
                  />
                )}
              </div>
            </DetailDrawerSection>
          );
        })()}
        {reworkOrderDetail?.id && (
          <DetailDrawerSection title="操作历史">
            <DocumentTrackingPanel documentType="rework_order" documentId={reworkOrderDetail.id} />
          </DetailDrawerSection>
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="返工报工"
        open={reportModalVisible}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        loading={reportSubmitLoading}
        initialValues={reportFormInitialValues}
        onClose={() => {
          setReportModalVisible(false);
          setCurrentReworkOrderForReport(null);
          setReportingOptions(null);
          reportFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitReport}
        formRef={reportFormRef}
      >
        {currentReworkOrderForReport && reportingOptions ? (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>
                    <strong>返工单：</strong>
                    {currentReworkOrderForReport.code}
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <strong>返工数量：</strong>
                    {reportingOptions.rework_quantity}
                  </div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div>
                    <strong>起始工序：</strong>
                    {reportingOptions.start_operation_name || '-'}
                  </div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div>
                    <strong>剩余可报合格数：</strong>
                    {reportingOptions.remaining_rework_quantity}
                  </div>
                </Col>
              </Row>
            </Card>
            <ProFormSelect
              name="work_order_operation_id"
              label="报工工序"
              placeholder="请选择报工工序"
              rules={[{ required: true, message: '请选择报工工序' }]}
              options={(reportingOptions.operations || [])
                .filter((op: any) => op.selectable)
                .map((op: any) => ({
                  label: `${op.is_start_operation ? '【起始】' : ''}工序${op.sequence || ''} - ${op.operation_name || op.operation_code || op.work_order_operation_id}（已报 ${op.reported_quantity}）`,
                  value: op.work_order_operation_id,
                }))}
              fieldProps={{ showSearch: true }}
            />
            <ProFormDigit
              name="reported_quantity"
              label="报工数量"
              rules={[{ required: true, message: '请输入报工数量' }]}
              min={0.01}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              rules={[{ required: true, message: '请输入合格数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="unqualified_quantity"
              label="不合格数量"
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="work_hours"
              label="工时（小时）"
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDatePicker
              name="reported_at"
              label="报工时间"
              rules={[{ required: true, message: '请选择报工时间' }]}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
            <ProFormTextArea name="remarks" label="备注" fieldProps={{ rows: 2 }} />
          </>
        ) : null}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ReworkOrdersPage;

