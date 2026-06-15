/**
 * 工序委外管理页面
 *
 * 提供工序委外的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持从工单工序创建工序委外单。
 *
 * Author: Luigi Lu
 * Date: 2025-01-04
 * Updated: 2026-01-20（重命名为工序委外）
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import type { DescriptionsProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormItem,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Space,
  Modal,
  Descriptions,
  Typography,
  Dropdown,
  Empty,
  Spin,
  theme as AntdTheme,
} from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import CodeField from '../../../../../components/code-field';
import { outsourceOrderApi } from '../../../services/production';
import { getOutsourceOrderLifecycle } from '../../../utils/outsourceOrderLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { supplierApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { useTranslation } from 'react-i18next';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

const OUTSOURCE_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_outsource_orders';

interface OutsourceOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  work_order_id?: number;
  work_order_code?: string;
  work_order_operation_id?: number;
  operation_id?: number;
  operation_code?: string;
  operation_name?: string;
  supplier_id?: number;
  supplier_code?: string;
  supplier_name?: string;
  outsource_quantity?: number;
  received_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
}

interface Supplier {
  id: number;
  uuid: string;
  code: string;
  name: string;
  isActive: boolean;
}

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderOoRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}

const OO_STAT_SPARK_1 = [2, 3, 4, 3, 5, 4, 6];
const OO_STAT_SPARK_2 = [1, 2, 1, 0, 2, 1, 1];
const OO_STAT_SPARK_3 = [3, 4, 5, 6, 5, 7, 8];

export const OutsourceOrdersTable: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const outsourceOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, draft: 0, inProgress: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);


  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOutsourceOrder, setCurrentOutsourceOrder] = useState<OutsourceOrder | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: outsourceFormCustomFields,
    customFieldValues: outsourceFormCustomFieldValues,
    loadFieldValues: loadOutsourceFormFieldValues,
    extractFormValues: extractOutsourceFormValues,
    saveCustomFieldValues: saveOutsourceCustomFieldValues,
    resetFieldValues: resetOutsourceFormFieldValues,
  } = useCustomFields({ tableName: OUTSOURCE_ORDER_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: outsourceListCustomFields,
    generateCustomFieldColumns: generateOutsourceCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichOutsourceRecordsWithCustomFields,
    customFieldValues: outsourceDetailCustomFieldValues,
    loadFieldValuesForDetail: loadOutsourceFieldValuesForDetail,
    resetDetailFieldValues: resetOutsourceDetailFieldValues,
  } = useCustomFieldsForList<OutsourceOrder>({ tableName: OUTSOURCE_ORDER_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (outsourceListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [outsourceListCustomFields.length]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [outsourceOrderDetail, setOutsourceOrderDetail] = useState<OutsourceOrder | null>(null);

  const [ooTrackingRefreshKey, setOoTrackingRefreshKey] = useState(0);

  const outsourceOrderTracking = useDocumentTracking(
    detailDrawerVisible && outsourceOrderDetail?.id ? 'outsource_order' : undefined,
    outsourceOrderDetail?.id,
    ooTrackingRefreshKey,
  );

  // 供应商列表
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);

  const refreshLocalStats = useCallback(async () => {
    try {
      const response = await outsourceOrderApi.list({ skip: 0, limit: 1000 });
      const arr = Array.isArray(response) ? response : [];
      setLocalStats({
        total: arr.length,
        draft: arr.filter((x: OutsourceOrder) => (x.status || '').trim() === 'draft').length,
        inProgress: arr.filter((x: OutsourceOrder) => (x.status || '').trim() === 'in_progress').length,
      });
    } catch {
      setLocalStats({ total: 0, draft: 0, inProgress: 0 });
    }
  }, []);

  useEffect(() => {
    refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);

  /**
   * 加载供应商列表
   */
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const suppliers = unwrapSupplyPagedList(await supplierApi.list({ isActive: true }));
        setSupplierList(suppliers || []);
      } catch (error) {
        window.console.error('获取数据失败:', error);
        messageApi.error('获取数据失败');
      }
    };
    loadSuppliers();
  }, [messageApi]);

  const detailBaseColumns: ProDescriptionsItemProps<OutsourceOrder>[] = useMemo(
    () => [
      {
        title: '工序委外单编号',
        dataIndex: 'code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
        ),
      },
      {
        title: '工单编号',
        dataIndex: 'work_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }}>{r.work_order_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '工序名称', dataIndex: 'operation_name' },
      { title: '供应商名称', dataIndex: 'supplier_name' },
      {
        title: '状态',
        dataIndex: 'status',
        render: (s) => {
          const m: Record<string, { text: string; color: string }> = {
            draft: { text: '草稿', color: 'default' },
            released: { text: '已下达', color: 'processing' },
            in_progress: { text: '执行中', color: 'processing' },
            completed: { text: '已完成', color: 'success' },
            cancelled: { text: '已取消', color: 'error' },
          };
          const x = m[String(s)] || { text: String(s ?? '-'), color: 'default' };
          return <Tag color={x.color}>{x.text}</Tag>;
        },
      },
      { title: '委外数量', dataIndex: 'outsource_quantity', valueType: 'digit' },
      { title: '已接收数量', dataIndex: 'received_quantity', valueType: 'digit' },
      { title: '合格数量', dataIndex: 'qualified_quantity', valueType: 'digit' },
      { title: '不合格数量', dataIndex: 'unqualified_quantity', valueType: 'digit' },
      { title: '单价', dataIndex: 'unit_price', valueType: 'money' },
      { title: '总金额', dataIndex: 'total_amount', valueType: 'money' },
      { title: '计划开始时间', dataIndex: 'planned_start_date', valueType: 'dateTime' },
      { title: '计划结束时间', dataIndex: 'planned_end_date', valueType: 'dateTime' },
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
        title: '采购入库单编号',
        dataIndex: 'purchase_receipt_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.purchase_receipt_code ?? '') }}>
            {r.purchase_receipt_code || '-'}
          </Typography.Text>
        ),
      },
    ],
    []
  );

  const detailRemarksColumn: ProDescriptionsItemProps<OutsourceOrder> = {
    title: '备注',
    dataIndex: 'remarks',
    span: 3,
    render: (text) => text || '-',
  };

  const handleDetail = async (record: OutsourceOrder) => {
    try {
      const detail = await outsourceOrderApi.get(record.id!.toString());
      setOutsourceOrderDetail(detail);
      setDetailDrawerVisible(true);
      setOoTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadOutsourceFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error('获取工序委外单详情失败');
    }
  };

  /**
   * 处理删除（从选中行）
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的工序委外');
      return;
    }

    const ids = keys.map((k) => Number(k));
    try {
      await Promise.all(ids.map((id) => outsourceOrderApi.delete(id.toString())));
      messageApi.success('删除成功');
      setSelectedRowKeys([]);
      if (outsourceOrderDetail?.id != null && ids.includes(outsourceOrderDetail.id)) {
        setDetailDrawerVisible(false);
        setOutsourceOrderDetail(null);
      }
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理编辑（从记录）
   */
  const handleEditFromRecord = async (record: OutsourceOrder) => {
    try {
      const detail = await outsourceOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentOutsourceOrder(detail);
      setModalVisible(true);
      window.setTimeout(() => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          supplier_id: detail.supplier_id,
          outsource_quantity: detail.outsource_quantity,
          unit_price: detail.unit_price,
          status: detail.status,
          planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : undefined,
          planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : undefined,
          received_quantity: detail.received_quantity,
          qualified_quantity: detail.qualified_quantity,
          unqualified_quantity: detail.unqualified_quantity,
          remarks: detail.remarks,
          attachments: mapAttachmentsToUploadList(detail.attachments),
        });
        if (detail.id != null) {
          loadOutsourceFormFieldValues(detail.id).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }
      }, 100);
    } catch (error) {
      messageApi.error('获取工序委外单详情失败');
    }
  };

  /**
   * 处理删除（从记录）
   */
  const handleDeleteFromRecord = async (record: OutsourceOrder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除工序委外单 "${record.code}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await outsourceOrderApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          if (outsourceOrderDetail?.id === record.id) {
            setDetailDrawerVisible(false);
            setOutsourceOrderDetail(null);
          }
          setStatsVersion((v) => v + 1);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /** 工序委外单需从工单工序下推创建，本页不提供直建 */
  const handleCreate = () => {
    Modal.confirm({
      title: '创建方式说明',
      content: '工序委外单请从「工单详情 > 工序 > 创建委外」发起，以保证工单工序与可委外数量一致。',
      okText: '前往工单页',
      cancelText: '取消',
      onOk: () => {
        navigate('/apps/kuaizhizao/production-execution/work-orders');
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractOutsourceFormValues(values);
      const submitData = {
        ...standardValues,
        attachments: normalizeDocumentAttachments(standardValues.attachments),
        planned_start_date: standardValues.planned_start_date
          ? standardValues.planned_start_date.format('YYYY-MM-DD HH:mm:ss')
          : undefined,
        planned_end_date: standardValues.planned_end_date
          ? standardValues.planned_end_date.format('YYYY-MM-DD HH:mm:ss')
          : undefined,
      };

      const oid = currentOutsourceOrder?.id;

      if (isEdit && oid) {
        await outsourceOrderApi.update(oid.toString(), submitData);
        await saveOutsourceCustomFieldValues(oid, customData);
        messageApi.success('工序委外单更新成功');
      } else {
        // 新建委外单需要更多字段，这里需要从工单创建，所以这里暂时不支持直接创建
        messageApi.warning('请从工单详情页创建工序委外单');
        throw new Error('请从工单详情页创建工序委外单');
      }
      setModalVisible(false);
      resetOutsourceFormFieldValues();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      setStatsVersion((v) => v + 1);
      if (oid && outsourceOrderDetail?.id === oid) {
        try {
          const fresh = await outsourceOrderApi.get(String(oid));
          setOutsourceOrderDetail(fresh);
          setOoTrackingRefreshKey((k) => k + 1);
          await loadOutsourceFieldValuesForDetail(oid);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  const renderOoRowActionNodes = (record: OutsourceOrder): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    nodes.push(
      <Button {...rowActionKind('read')}
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        详情
      </Button>
    );
    nodes.push(
      <Button {...rowActionKind('update')}
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        disabled={record.status === 'completed' || record.status === 'cancelled'}
        onClick={(e) => {
          e.stopPropagation();
          void handleEditFromRecord(record);
        }}
      >
        编辑
      </Button>
    );
    nodes.push(
      <Button {...rowActionKind('delete')}
        key="delete"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        disabled={record.status === 'completed' || record.status === 'in_progress'}
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteFromRecord(record);
        }}
      >
        删除
      </Button>
    );
    return nodes;
  };

  const outsourceCustomFieldColumns = generateOutsourceCustomFieldColumns();
  const columns: ProColumns<OutsourceOrder>[] = [
    {
      title: '工序委外单编号',
      dataIndex: 'code',
      width: 168,
      fixed: 'left',
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '工单编号',
      dataIndex: 'work_order_code',
      width: 148,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }} ellipsis>
          {r.work_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '工序名称',
      dataIndex: 'operation_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '供应商名称',
      dataIndex: 'supplier_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工序委外数量',
      dataIndex: 'outsource_quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '已接收数量',
      dataIndex: 'received_quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      width: 100,
      valueType: 'money',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 120,
      valueType: 'money',
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
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getOutsourceOrderLifecycle(record as any);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    ...outsourceCustomFieldColumns,
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderOoRowActions(renderOoRowActionNodes(record), `oo-${record.id ?? 'row'}`),
    },
  ];

  /**
   * 处理请求
   */
  const handleRequest = async (params: any, _sorter: any, _filter: any) => {
    try {
      const response = await outsourceOrderApi.list({
        skip: (params.current! - 1) * params.pageSize!,
        limit: Math.min(params.pageSize ?? 100, 1000),
        ...params,
        keyword: params.keyword,
      });
      const list = response || [];
      const enriched = await enrichOutsourceRecordsWithCustomFields(list);
      return {
        data: enriched,
        success: true,
        total: enriched.length,
      };
    } catch (error) {
      messageApi.error('获取工序委外单列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const statCards: StatCard[] = [
    {
      title: '工序委外单总数',
      value: localStats.total,
      valueStyle: { color: token.colorPrimary },
      backgroundChart: <SimpleSparkline data={OO_STAT_SPARK_1} color={token.colorPrimary} />,
    },
    {
      title: '草稿',
      value: localStats.draft,
      valueStyle: { color: token.colorWarning },
      backgroundChart: <SimpleSparkline data={OO_STAT_SPARK_2} color={token.colorWarning} />,
    },
    {
      title: '执行中',
      value: localStats.inProgress,
      valueStyle: { color: token.colorSuccess },
      backgroundChart: <SimpleSparkline data={OO_STAT_SPARK_3} color={token.colorSuccess} />,
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
      <UniTable<OutsourceOrder>
        headerTitle="工序委外"
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.outsource-orders"
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showCreateButton={true}
        createButtonText="新建工序委外单"
        onCreate={handleCreate}
        showDeleteButton={true}
        onDelete={handleDelete}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条工序委外吗？`}
        showAdvancedSearch={true}
        scroll={{ x: 1800 }}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
      />
      </ListPageTemplate>
      {/* 表单Modal（主要用于编辑） */}
      {isEdit && (
        <FormModalTemplate
          title="编辑工序委外"
          open={modalVisible}
          onClose={() => {
            setModalVisible(false);
            resetOutsourceFormFieldValues();
          }}
          onFinish={handleSubmitForm}
          formRef={formRef}
          {...MODAL_CONFIG}
        >
          <CodeField
            pageCode="kuaizhizao-production-outsource-order"
            name="code"
            label="工序委外单编号"
            required={!isEdit}
            autoGenerateOnCreate={!isEdit}
            context={{}}
            disabled={isEdit}
          />
          <ProFormItem
            name="supplier_id"
            label="供应商"
            rules={[{ required: true, message: '请选择供应商' }]}
          >
            <UniDropdown
              placeholder="请选择供应商"
              showSearch
              allowClear
              style={{ width: '100%' }}
              options={supplierList.map((s: Supplier) => ({
                label: `${s.code} - ${s.name}`,
                value: s.id,
              }))}
              quickCreate={{ label: '供应商管理', onClick: () => navigate('/apps/master-data/supply-chain/suppliers') }}
            />
          </ProFormItem>
          <ProFormDigit
            name="outsource_quantity"
            label="工序委外数量"
            placeholder="请输入工序委外数量"
            rules={[{ required: true, message: '请输入工序委外数量' }]}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormDigit
            name="unit_price"
            label="单价"
            placeholder="请输入单价"
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormSelect
            name="status"
            label="状态"
            placeholder="请选择状态"
            options={[
              { label: '草稿', value: 'draft' },
              { label: '已下达', value: 'released' },
              { label: '执行中', value: 'in_progress' },
              { label: '已完成', value: 'completed' },
              { label: '已取消', value: 'cancelled' },
            ]}
          />
          <ProFormDatePicker
            name="planned_start_date"
            label="计划开始时间"
            placeholder="请选择计划开始时间"
            fieldProps={{ showTime: true }}
          />
          <ProFormDatePicker
            name="planned_end_date"
            label="计划结束时间"
            placeholder="请选择计划结束时间"
            fieldProps={{ showTime: true }}
          />
          <ProFormDigit
            name="received_quantity"
            label="已接收数量"
            placeholder="请输入已接收数量"
            initialValue={0}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormDigit
            name="qualified_quantity"
            label="合格数量"
            placeholder="请输入合格数量"
            initialValue={0}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormDigit
            name="unqualified_quantity"
            label="不合格数量"
            placeholder="请输入不合格数量"
            initialValue={0}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <CustomFieldsFormSection
            customFields={outsourceFormCustomFields}
            customFieldValues={outsourceFormCustomFieldValues}
            gridColumns={1}
          />
          <DocumentAttachmentsField category="outsource_order_attachments" />
          <ProFormTextArea
            name="remarks"
            label="备注"
            placeholder="请输入备注"
            fieldProps={{ rows: 3 }}
          />
        </FormModalTemplate>
      )}

      <DetailDrawerTemplate
        title={`工序委外详情${outsourceOrderDetail?.code ? ` - ${outsourceOrderDetail.code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={outsourceOrderDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setOutsourceOrderDetail(null);
          resetOutsourceDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={outsourceOrderDetail || undefined}
        customContent={
          outsourceOrderDetail && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(outsourceOrderDetail, detailBaseColumns)}
                />
                {hasCustomFieldsDetailContent(outsourceListCustomFields, outsourceDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={outsourceListCustomFields}
                      customFieldValues={outsourceDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                <Descriptions
                  column={3}
                  size="small"
                  style={{ marginTop: 16 }}
                  items={buildDescriptionItemsFromColumns(outsourceOrderDetail, [detailRemarksColumn])}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getOutsourceOrderLifecycle(outsourceOrderDetail as any);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {outsourceOrderDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='outsource_order'
                      documentId={outsourceOrderDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={outsourceOrderDetail.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setOutsourceOrderDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="工序委外无明细行表" />
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {outsourceOrderTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {outsourceOrderTracking.error && !outsourceOrderTracking.loading && (
                  <Typography.Text type="danger">{outsourceOrderTracking.error}</Typography.Text>
                )}
                {outsourceOrderTracking.data && !outsourceOrderTracking.loading && (
                  <DocumentTrackingTimelineBody data={outsourceOrderTracking.data} />
                )}
                {!outsourceOrderTracking.loading && !outsourceOrderTracking.data && !outsourceOrderTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />
    </>
  );
};

const OutsourceOrdersPage: React.FC = () => {
  return <OutsourceOrdersTable />;
};

export default OutsourceOrdersPage;

