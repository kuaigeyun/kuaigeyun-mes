/**
 * 成品检验页面
 *
 * 提供生产完工成品的最终检验功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { DescriptionsProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormTextArea,
  ProFormSelect,
  ProFormItem,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Row, Col, Modal, Descriptions, Typography, Dropdown, Spin, Empty } from 'antd';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  DocumentTrackingRelationsBody,
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { getIncomingInspectionLifecycle } from '../../../utils/incomingInspectionLifecycle';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../../../services/api';
import { qualityApi, workOrderApi } from '../../../services/production';
import { downloadFile } from '../../../services/common';
import dayjs from 'dayjs';

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
    }
    if (col.render && dataSource != null) {
      content = col.render(content, dataSource, index, {}, col);
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

const FG_ROW_ACTIONS_MAX = 4;

function renderFinishedRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  const wrapped = nodes.map((node, i) => <span key={`${keyPrefix}-${i}`}>{node}</span>);
  if (wrapped.length <= FG_ROW_ACTIONS_MAX) {
    return <Space size="small" wrap>{wrapped}</Space>;
  }
  const inline = wrapped.slice(0, FG_ROW_ACTIONS_MAX);
  const overflow = wrapped.slice(FG_ROW_ACTIONS_MAX);
  return (
    <Space size="small" wrap>
      {inline}
      <Dropdown
        menu={{
          items: overflow.map((node, i) => ({
            key: `${keyPrefix}-more-${i}`,
            label: node,
          })),
        }}
        trigger={['click']}
      >
        <Button type="link" size="small">
          更多
        </Button>
      </Dropdown>
    </Space>
  );
}

// 成品检验接口定义
interface FinishedGoodsInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  batch_number?: string;
  inspection_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  inspection_result?: string;
  quality_status?: string;
  inspector_id?: number;
  inspector_name?: string;
  inspection_time?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  lifecycle?: { main_stages?: Array<unknown> };
}


const DISPOSAL_METHOD_FALLBACK = [
  { label: '返工', value: 'rework' },
  { label: '报废', value: 'scrap' },
  { label: '让步接收', value: 'accept' },
  { label: '隔离', value: 'quarantine' },
  { label: '其他', value: 'other' },
];

const FinishedGoodsInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const invalidateStats = () => queryClient.invalidateQueries({ queryKey: ['finished-goods-inspection-statistics'] });
  const [disposalOptions, setDisposalOptions] = useState<Array<{ label: string; value: string }>>(DISPOSAL_METHOD_FALLBACK);
  const [disposalLoading, setDisposalLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setDisposalLoading(true);
      try {
        const dict = await getDataDictionaryByCode('DISPOSAL_METHOD');
        const items = await getDictionaryItemList(dict.uuid, true);
        setDisposalOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setDisposalOptions(DISPOSAL_METHOD_FALLBACK);
      } finally {
        setDisposalLoading(false);
      }
    };
    load();
  }, []);
  // 检验Modal状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<FinishedGoodsInspection | null>(null);
  const formRef = useRef<any>(null);

  // 详情Drawer状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<FinishedGoodsInspection | null>(null);

  const finishedTracking = useDocumentTracking(
    detailDrawerVisible && inspectionDetail?.id ? 'finished_goods_inspection' : undefined,
    inspectionDetail?.id
  );

  // 从工单创建Modal状态
  const [createFromWorkOrderModalVisible, setCreateFromWorkOrderModalVisible] = useState(false);
  const createFromWorkOrderFormRef = useRef<any>(null);

  // 创建不合格品记录Modal状态
  const [createDefectModalVisible, setCreateDefectModalVisible] = useState(false);
  const [currentDefectInspection, setCurrentDefectInspection] = useState<FinishedGoodsInspection | null>(null);
  const defectFormRef = useRef<any>(null);

  // 统计数据（从接口获取）
  const { data: statsData } = useQuery({
    queryKey: ['finished-goods-inspection-statistics'],
    queryFn: () => qualityApi.finishedGoodsInspection.statistics(),
    staleTime: 30 * 1000,
  });
  const stats = {
    pendingCount: statsData?.pending_count ?? 0,
    qualifiedCount: statsData?.qualified_count ?? 0,
    unqualifiedCount: statsData?.unqualified_count ?? 0,
    totalInspected: statsData?.total_count ?? 0,
  };

  // 处理详情查看
  const handleDetail = async (record: FinishedGoodsInspection) => {
    try {
      const detail = await qualityApi.finishedGoodsInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取成品检验详情失败');
    }
  };

  // 处理检验
  const handleInspect = (record: FinishedGoodsInspection) => {
    setCurrentInspection(record);
    setInspectionModalVisible(true);

    formRef.current?.setFieldsValue({
      qualified_quantity: record.inspection_quantity || 0,
      unqualified_quantity: 0,
      notes: '',
    });
  };

  // 处理检验提交
  const handleInspectionSubmit = async (values: any) => {
    try {
      if (currentInspection?.id) {
        await qualityApi.finishedGoodsInspection.conduct(currentInspection.id.toString(), {
          qualified_quantity: values.qualified_quantity,
          unqualified_quantity: values.unqualified_quantity,
          notes: values.notes,
        });
      }

      messageApi.success('成品检验完成');
      setInspectionModalVisible(false);
      formRef.current?.resetFields();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '检验提交失败');
      throw error;
    }
  };

  // 处理批量导入（UniTable 内置）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await qualityApi.finishedGoodsInspection.import(data) as any;
      const successCount = result?.success_count ?? result?.data?.success_count ?? 0;
      const failureCount = result?.failure_count ?? result?.data?.failure_count ?? 0;
      if (failureCount > 0) {
        messageApi.warning(`导入完成：成功 ${successCount} 条，失败 ${failureCount} 条`);
      } else {
        messageApi.success(`导入成功：成功 ${successCount} 条`);
      }
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败');
    }
  };

  // 处理批量导出（UniTable 内置）
  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: FinishedGoodsInspection[]) => {
    try {
      if (type === 'all') {
        const blob = await qualityApi.finishedGoodsInspection.export();
        const filename = `成品检验单_${new Date().toISOString().slice(0, 10)}.xlsx`;
        downloadFile(blob, filename);
        messageApi.success('导出成功');
      } else {
        const toExport = type === 'selected' && selectedRowKeys?.length
          ? (currentPageData || []).filter((r) => r.id != null && selectedRowKeys.includes(r.id))
          : currentPageData || [];
        if (toExport.length === 0) {
          messageApi.warning('暂无数据可导出');
          return;
        }
        const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `成品检验单_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        messageApi.success(`已导出 ${toExport.length} 条记录`);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导出失败');
    }
  };

  // 从工单创建成品检验单
  const handleCreateFromWorkOrder = () => {
    setCreateFromWorkOrderModalVisible(true);
  };

  const handleCreateFromWorkOrderSubmit = async (values: any) => {
    try {
      await qualityApi.finishedGoodsInspection.createFromWorkOrder(values.work_order_id.toString());
      messageApi.success('成功创建成品检验单');
      setCreateFromWorkOrderModalVisible(false);
      createFromWorkOrderFormRef.current?.resetFields();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建成品检验单失败');
    }
  };

  // 处理创建不合格品记录
  const handleCreateDefect = (record: FinishedGoodsInspection) => {
    setCurrentDefectInspection(record);
    setCreateDefectModalVisible(true);
    defectFormRef.current?.setFieldsValue({
      defect_quantity: record.unqualified_quantity || 0,
      defect_type: 'other',
      defect_reason: '',
      disposition: 'rework', // 成品检验不合格默认返工
      remarks: '',
    });
  };

  // 处理创建不合格品记录提交
  const handleCreateDefectSubmit = async (values: any) => {
    try {
      if (currentDefectInspection?.id) {
        await qualityApi.finishedGoodsInspection.createDefect(currentDefectInspection.id.toString(), {
          defect_quantity: values.defect_quantity,
          defect_type: values.defect_type,
          defect_reason: values.defect_reason,
          disposition: values.disposition,
          remarks: values.remarks,
        });
      }

      messageApi.success('不合格品记录创建成功');
      setCreateDefectModalVisible(false);
      defectFormRef.current?.resetFields();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建不合格品记录失败');
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<FinishedGoodsInspection>[] = useMemo(
    () => [
      {
        title: '检验单号',
        dataIndex: 'inspection_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }}>{r.inspection_code ?? '-'}</Typography.Text>
        ),
      },
      {
        title: '工单编号',
        dataIndex: 'work_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }}>{r.work_order_code ?? '-'}</Typography.Text>
        ),
      },
      {
        title: '销售订单号',
        dataIndex: 'sales_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.sales_order_code ?? '') }}>{r.sales_order_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '客户', dataIndex: 'customer_name', render: (t) => t || '-' },
      {
        title: '物料编号',
        dataIndex: 'material_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.material_code ?? '') }}>{r.material_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '物料名称', dataIndex: 'material_name' },
      { title: '规格', dataIndex: 'material_spec', render: (t) => t || '-' },
      { title: '批次号', dataIndex: 'batch_number', render: (t) => t || '-' },
      { title: '检验数量', dataIndex: 'inspection_quantity', valueType: 'digit' },
      { title: '合格数量', dataIndex: 'qualified_quantity', valueType: 'digit' },
      { title: '不合格数量', dataIndex: 'unqualified_quantity', valueType: 'digit' },
      {
        title: '状态',
        dataIndex: 'status',
        render: (s) => {
          const statusMap: Record<string, { text: string; color: string }> = {
            待检验: { text: '待检验', color: 'default' },
            已检验: { text: '已检验', color: 'success' },
            已审核: { text: '已审核', color: 'processing' },
          };
          const config = statusMap[String(s)] || { text: String(s ?? '-'), color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '质量状态',
        dataIndex: 'quality_status',
        render: (t) => <Tag color={t === '合格' ? 'success' : 'error'}>{t || '待判定'}</Tag>,
      },
      {
        title: '检验结果',
        dataIndex: 'inspection_result',
        render: (text) => {
          const resultMap: Record<string, { text: string; color: string }> = {
            待检验: { text: '待检验', color: 'default' },
            已检验: { text: '已检验', color: 'success' },
            合格: { text: '合格', color: 'success' },
            不合格: { text: '不合格', color: 'error' },
          };
          const config = resultMap[text as string] || { text: text || '待检验', color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      { title: '检验员', dataIndex: 'inspector_name' },
      { title: '检验时间', dataIndex: 'inspection_time', valueType: 'dateTime' },
      { title: '审核人', dataIndex: 'reviewer_name', render: (t) => t || '-' },
      { title: '审核时间', dataIndex: 'review_time', valueType: 'dateTime', render: (t) => t || '-' },
      { title: '检验备注', dataIndex: 'notes', span: 2, render: (t) => t || '-' },
    ],
    []
  );

  const renderFinishedRowNodes = (record: FinishedGoodsInspection): React.ReactNode[] => {
    if (record.status === '待检验' || record.inspection_result === '待检验') {
      return [
        <Button
          key="inspect"
          size="small"
          type="primary"
          onClick={(e) => {
            e.stopPropagation();
            handleInspect(record);
          }}
        >
          检验
        </Button>,
      ];
    }
    const nodes: React.ReactNode[] = [
      <Button
        key="detail"
        size="small"
        type="link"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        详情
      </Button>,
      <UniWorkflowActions
        key="wf"
        record={record}
        entityName="成品检验单"
        statusField="status"
        reviewStatusField="review_status"
        draftStatuses={[]}
        pendingStatuses={['待审核', '已检验']}
        approvedStatuses={['已审核']}
        rejectedStatuses={['已驳回']}
        theme="link"
        size="small"
        actions={{
          approve: (id) => apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, { method: 'POST' }),
          reject: (id, reason) =>
            apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, {
              method: 'POST',
              params: reason ? { rejection_reason: reason } : undefined,
            }),
        }}
        onSuccess={() => {
          actionRef.current?.reload();
          if (inspectionDetail?.id === record.id) {
            qualityApi.finishedGoodsInspection.get(record.id!.toString()).then(setInspectionDetail).catch(() => {});
          }
        }}
      />,
    ];
    if (record.quality_status === '不合格' && (record.unqualified_quantity || 0) > 0) {
      nodes.push(
        <Button
          key="defect"
          size="small"
          type="link"
          danger
          onClick={(e) => {
            e.stopPropagation();
            handleCreateDefect(record);
          }}
        >
          创建不合格品记录
        </Button>
      );
    }
    return nodes;
  };

  // 表格列定义
  const columns: ProColumns<FinishedGoodsInspection>[] = [
    {
      title: '检验单号',
      dataIndex: 'inspection_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }} ellipsis>
          {r.inspection_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '工单编号',
      dataIndex: 'work_order_code',
      width: 140,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }} ellipsis>
          {r.work_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '销售订单号',
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.sales_order_code ?? '') }} ellipsis>
          {r.sales_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '物料编号',
      dataIndex: 'material_code',
      width: 120,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.material_code ?? '') }} ellipsis>
          {r.material_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '检验数量',
      dataIndex: 'inspection_quantity',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      width: 80,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: '检验结果',
      dataIndex: 'inspection_result',
      width: 100,
      render: (text) => {
        const resultMap: Record<string, { text: string; color: string }> = {
          '待检验': { text: '待检验', color: 'default' },
          '已检验': { text: '已检验', color: 'success' },
          '合格': { text: '合格', color: 'success' },
          '不合格': { text: '不合格', color: 'error' },
        };
        const config = resultMap[text as string] || { text: text || '待检验', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '质量状态',
      dataIndex: 'quality_status',
      width: 100,
      render: (text) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待判定': { text: '待判定', color: 'default' },
          '合格': { text: '合格', color: 'success' },
          '不合格': { text: '不合格', color: 'error' },
        };
        const config = statusMap[text as string] || { text: text || '待判定', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '检验时间',
      dataIndex: 'inspection_time',
      width: 160,
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getIncomingInspectionLifecycle(record as Record<string, unknown>);
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
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderFinishedRowActions(renderFinishedRowNodes(record), `fg-${record.id ?? 'row'}`),
    },
  ];

  // 检验明细表格列定义 (当前未使用)
  // const detailColumns = [...];

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '待检验数量',
          value: stats.pendingCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#faad14' },
        },
        {
          title: '合格数量',
          value: stats.qualifiedCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '不合格数量',
          value: stats.unqualifiedCount,
          prefix: <CloseCircleOutlined />,
          valueStyle: { color: '#f5222d' },
        },
        {
          title: '总检验数量',
          value: stats.totalInspected,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#1890ff' },
        },
      ]}
    >
      <UniTable<FinishedGoodsInspection>
        headerTitle="成品检验"
        columnPersistenceId="kuaizhizao-qm-finished-goods-inspection"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params: any) => {
          try {
            const response = await qualityApi.finishedGoodsInspection.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              status: params.status,
              quality_status: params.quality_status,
              work_order_id: params.work_order_id,
              keyword: params.keyword,
            });
            // 后端返回的是数组
            const data = Array.isArray(response) ? response : (response.data || []);
            return {
              data: data,
              success: true,
              total: data.length,
            };
          } catch (error) {
            messageApi.error('获取成品检验列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showCreateButton={true}
        createButtonText="从工单创建"
        onCreate={handleCreateFromWorkOrder}
        enableRowSelection={true}
        onRowSelectionChange={setSelectedRowKeys}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={['工单编号', '检验数量', '合格数量', '不合格数量', '备注']}
        importExampleRow={['WO20250115001', '100', '98', '2', '']}
        showExportButton={true}
        onExport={handleExport}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条成品检验单吗？`,
            onOk: async () => {
              try {
                const ids = keys.map(Number);
                for (const id of keys) {
                  await qualityApi.finishedGoodsInspection.delete(String(id));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                setSelectedRowKeys([]);
                if (inspectionDetail?.id != null && ids.includes(inspectionDetail.id)) {
                  setDetailDrawerVisible(false);
                  setInspectionDetail(null);
                }
                invalidateStats();
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error.message || '删除失败');
              }
            },
          });
        }}
        scroll={{ x: 1900 }}
      />

      <FormModalTemplate
        title={`成品检验 - ${currentInspection?.inspection_code || ''}`}
        open={inspectionModalVisible}
        onClose={() => setInspectionModalVisible(false)}
        onFinish={handleInspectionSubmit}
        isEdit={false}
        initialValues={
          currentInspection ? {
            qualified_quantity: currentInspection.inspection_quantity || 0,
            unqualified_quantity: 0,
            notes: '',
          } : {}
        }
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        {currentInspection && (
          <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>工单编号：</strong>{currentInspection.work_order_code}
              </Col>
              <Col span={12}>
                <strong>物料编号：</strong>{currentInspection.material_code}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>物料名称：</strong>{currentInspection.material_name}
              </Col>
              <Col span={12}>
                <strong>检验数量：</strong>{currentInspection.inspection_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormDigit
          name="qualified_quantity"
          label="合格数量"
          placeholder="请输入合格数量"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入合格数量' },
            { type: 'number', min: 0, message: '合格数量不能小于0' },
            ({ getFieldValue }: any) => ({
              validator(_: any, value: any) {
                if (!currentInspection) return Promise.resolve();
                const unqualifiedQuantity = getFieldValue('unqualified_quantity') || 0;
                if (value + unqualifiedQuantity > (currentInspection.inspection_quantity || 0)) {
                  return Promise.reject('合格数量 + 不合格数量不能超过检验数量');
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="unqualified_quantity"
          label="不合格数量"
          placeholder="请输入不合格数量"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入不合格数量' },
            { type: 'number', min: 0, message: '不合格数量不能小于0' },
            ({ getFieldValue }: any) => ({
              validator(_: any, value: any) {
                if (!currentInspection) return Promise.resolve();
                const qualifiedQuantity = getFieldValue('qualified_quantity') || 0;
                if (qualifiedQuantity + value > (currentInspection.inspection_quantity || 0)) {
                  return Promise.reject('合格数量 + 不合格数量不能超过检验数量');
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea
          name="notes"
          label="检验备注"
          placeholder="请输入检验详情、发现的问题或处理意见"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 从工单创建Modal */}
      <FormModalTemplate
        title="从工单创建成品检验单"
        open={createFromWorkOrderModalVisible}
        onClose={() => {
          setCreateFromWorkOrderModalVisible(false);
          createFromWorkOrderFormRef.current?.resetFields();
        }}
        onFinish={handleCreateFromWorkOrderSubmit}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={createFromWorkOrderFormRef}
      >
        <ProFormItem
          name="work_order_id"
          label="选择工单"
          rules={[{ required: true, message: '请选择工单' }]}
        >
          <UniDropdown
            placeholder="请选择工单"
            showSearch
            advancedSearch={{
              label: '高级搜索工单',
              fields: [
                { name: 'code', label: '工单编号', type: 'text' },
                { name: 'name', label: '工单名称', type: 'text' },
              ],
              onSearch: async (params) => {
                const response = await workOrderApi.list({
                  ...params,
                  skip: 0,
                  limit: 100,
                  status: '进行中',
                });
                const data = Array.isArray(response) ? response : (response.data || []);
                return data.map((wo: any) => ({
                  label: `${wo.code} - ${wo.name}`,
                  value: wo.id,
                }));
              },
            }}
          />
        </ProFormItem>
      </FormModalTemplate>

      {/* 成品检验详情 Drawer */}
      <DetailDrawerTemplate
        title={`成品检验详情 - ${inspectionDetail?.inspection_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setInspectionDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        extra={
          inspectionDetail && (
            <UniWorkflowActions
              record={inspectionDetail}
              entityName="成品检验单"
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={[]}
              pendingStatuses={['待审核', '已检验']}
              approvedStatuses={['已审核']}
              rejectedStatuses={['已驳回']}
              theme="default"
              size="small"
              actions={{
                approve: (id) => apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, { method: 'POST' }),
                reject: (id, reason) =>
                  apiRequest(`/apps/kuaizhizao/finished-goods-inspections/${id}/approve`, {
                    method: 'POST',
                    params: reason ? { rejection_reason: reason } : undefined,
                  }),
              }}
              onSuccess={() => {
                actionRef.current?.reload();
                if (inspectionDetail?.id) {
                  qualityApi.finishedGoodsInspection.get(inspectionDetail.id.toString()).then(setInspectionDetail).catch(() => {});
                }
              }}
            />
          )
        }
        customContent={
          inspectionDetail ? (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(inspectionDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getIncomingInspectionLifecycle(inspectionDetail as Record<string, unknown>);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                      />
                    );
                  })()}
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: '1px solid var(--ant-color-border-secondary)',
                    }}
                  >
                    <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                      上下游单据
                    </div>
                    {finishedTracking.loading && (
                      <div style={{ padding: '8px 0' }}>
                        <Spin size="small" />
                      </div>
                    )}
                    {finishedTracking.error && (
                      <Typography.Text type="danger">{finishedTracking.error}</Typography.Text>
                    )}
                    {finishedTracking.data && (
                      <DocumentTrackingRelationsBody
                        data={finishedTracking.data}
                        onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                      />
                    )}
                  </div>
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="成品检验无明细行表" />
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {finishedTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {finishedTracking.error && !finishedTracking.loading && (
                  <Typography.Text type="danger">{finishedTracking.error}</Typography.Text>
                )}
                {finishedTracking.data && !finishedTracking.loading && (
                  <DocumentTrackingTimelineBody data={finishedTracking.data} />
                )}
                {!finishedTracking.loading && !finishedTracking.data && !finishedTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      {/* 创建不合格品记录Modal */}
      <FormModalTemplate
        title="创建不合格品记录"
        open={createDefectModalVisible}
        onClose={() => {
          setCreateDefectModalVisible(false);
          defectFormRef.current?.resetFields();
        }}
        onFinish={handleCreateDefectSubmit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={defectFormRef}
      >
        {currentDefectInspection && (
          <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>检验单号：</strong>{currentDefectInspection.inspection_code}
              </Col>
              <Col span={12}>
                <strong>物料名称：</strong>{currentDefectInspection.material_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>不合格数量：</strong>{currentDefectInspection.unqualified_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormDigit
          name="defect_quantity"
          label="不合格品数量"
          placeholder="请输入不合格品数量"
          rules={[
            { required: true, message: '请输入不合格品数量' },
            { type: 'number', min: 0, message: '不合格品数量不能小于0' },
            () => ({
              validator(_: any, value: any) {
                if (!currentDefectInspection) return Promise.resolve();
                if (value > (currentDefectInspection.unqualified_quantity || 0)) {
                  return Promise.reject('不合格品数量不能超过检验单的不合格数量');
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="defect_type"
          label="不合格品类型"
          placeholder="请选择不合格品类型"
          rules={[{ required: true, message: '请选择不合格品类型' }]}
          options={[
            { label: '尺寸偏差', value: 'dimension' },
            { label: '外观缺陷', value: 'appearance' },
            { label: '功能异常', value: 'function' },
            { label: '材质问题', value: 'material' },
            { label: '其他', value: 'other' },
          ]}
        />
        <ProFormTextArea
          name="defect_reason"
          label="不合格原因"
          placeholder="请输入不合格原因"
          rules={[{ required: true, message: '请输入不合格原因' }]}
          fieldProps={{ rows: 3 }}
        />
        <ProFormItem name="disposition" label="处理方式" rules={[{ required: true, message: '请选择处理方式' }]}>
          <UniDropdown
            placeholder="请选择处理方式"
            showSearch
            allowClear
            loading={disposalLoading}
            options={disposalOptions}
            quickCreate={{ label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') }}
          />
        </ProFormItem>
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default FinishedGoodsInspectionPage;
