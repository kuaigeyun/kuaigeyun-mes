/**
 * 来料检验页面
 *
 * 提供采购到货物料的检验功能，支持合格/不合格判定和处理
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
import {
  App,
  Button,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Modal,
  Descriptions,
  Typography,
  Dropdown,
  Spin,
  Empty,
  theme as AntdTheme,
} from 'antd';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getIncomingInspectionLifecycle } from '../../../utils/incomingInspectionLifecycle';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../../../services/api';
import { qualityApi } from '../../../services/production';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import InspectionDetailQualityActions from '../components/InspectionDetailQualityActions';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import {
  fetchPurchaseReceiptsForIqc,
  type InspectionDropdownOption,
} from '../components/inspectionCreateSourceUtils';
import { downloadFile } from '../../../services/common';
import { countWithPagedRequests } from '../../../../../utils/pagedCount';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import dayjs from 'dayjs';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasPermission } from '../../../../../utils/permission';

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

function renderIncomingRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

// 来料检验接口定义
interface IncomingInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
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
}

const DISPOSAL_METHOD_FALLBACK = [
  { label: '退货', value: 'return' },
  { label: '让步接收', value: 'accept' },
  { label: '隔离', value: 'quarantine' },
  { label: '其他', value: 'other' },
];

const IncomingInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { token } = AntdTheme.useToken();
  const incomingInspectionDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const invalidateStats = () => queryClient.invalidateQueries({ queryKey: ['incoming-inspection-statistics'] });
  const canReadNcLedger = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-nonconforming-ledger:read');
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
  const [currentInspection, setCurrentInspection] = useState<IncomingInspection | null>(null);
  const formRef = useRef<any>(null);

  // 详情Drawer状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<IncomingInspection | null>(null);

  const [iiTrackingRefreshKey, setIiTrackingRefreshKey] = useState(0);

  const incomingTracking = useDocumentTracking(
    detailVisible && inspectionDetail?.id ? 'incoming_inspection' : undefined,
    inspectionDetail?.id,
    iiTrackingRefreshKey,
  );

  // 从采购入库单创建Modal状态
  const [createFromReceiptModalVisible, setCreateFromReceiptModalVisible] = useState(false);
  const createFromReceiptFormRef = useRef<any>(null);
  const [purchaseReceiptOptions, setPurchaseReceiptOptions] = useState<InspectionDropdownOption[]>([]);
  const [purchaseReceiptOptionsLoading, setPurchaseReceiptOptionsLoading] = useState(false);

  // 批量导入状态
  // 创建不合格品记录Modal状态
  const [createDefectModalVisible, setCreateDefectModalVisible] = useState(false);
  const [currentDefectInspection, setCurrentDefectInspection] = useState<IncomingInspection | null>(null);
  const defectFormRef = useRef<any>(null);

  // 统计数据（从接口获取）
  const { data: statsData } = useQuery({
    queryKey: ['incoming-inspection-statistics'],
    queryFn: () => qualityApi.incomingInspection.statistics(),
    staleTime: 30 * 1000,
  });
  const stats = {
    pendingCount: statsData?.pending_count ?? 0,
    qualifiedCount: statsData?.qualified_count ?? 0,
    unqualifiedCount: statsData?.unqualified_count ?? 0,
    totalInspected: statsData?.total_count ?? 0,
  };

  // 处理检验
  const handleInspect = (record: IncomingInspection) => {
    setCurrentInspection(record);
    setInspectionModalVisible(true);
    // 设置表单初始值
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
        await qualityApi.incomingInspection.conduct(currentInspection.id.toString(), {
          qualified_quantity: values.qualified_quantity,
          unqualified_quantity: values.unqualified_quantity,
          notes: values.notes,
          nonconformance_reason: values.nonconformance_reason,
          ...pickInspectionConductExtras(values),
        });
      }

      messageApi.success('来料检验完成');
      setInspectionModalVisible(false);
      formRef.current?.resetFields();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('检验提交失败');
      throw error;
    }
  };

  // 处理详情查看
  const handleDetail = async (record: IncomingInspection) => {
    try {
      const detail = await qualityApi.incomingInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailVisible(true);
      setIiTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error('获取检验单详情失败');
    }
  };

  // 处理批量导入（UniTable 内置）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await qualityApi.incomingInspection.import(data) as any;
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
  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: IncomingInspection[]) => {
    try {
      if (type === 'all') {
        const blob = await qualityApi.incomingInspection.export();
        const filename = `来料检验单_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
        a.download = `来料检验单_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        messageApi.success(`已导出 ${toExport.length} 条记录`);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导出失败');
    }
  };

  // 从采购入库单创建来料检验单
  const handleCreateFromReceipt = async () => {
    setCreateFromReceiptModalVisible(true);
    createFromReceiptFormRef.current?.resetFields();
    setPurchaseReceiptOptions([]);
    setPurchaseReceiptOptionsLoading(true);
    try {
      setPurchaseReceiptOptions(await fetchPurchaseReceiptsForIqc());
    } catch {
      messageApi.error('加载采购入库单失败');
    } finally {
      setPurchaseReceiptOptionsLoading(false);
    }
  };

  const handleCreateFromReceiptSubmit = async (values: any) => {
    try {
      await qualityApi.incomingInspection.createFromPurchaseReceipt(values.purchase_receipt_id.toString());
      messageApi.success('成功创建来料检验单');
      setCreateFromReceiptModalVisible(false);
      createFromReceiptFormRef.current?.resetFields();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建来料检验单失败');
    }
  };

  // 处理创建不合格品记录
  const handleCreateDefect = (record: IncomingInspection) => {
    setCurrentDefectInspection(record);
    setCreateDefectModalVisible(true);
    defectFormRef.current?.setFieldsValue({
      defect_quantity: record.unqualified_quantity || 0,
      defect_type: 'other',
      defect_reason: '',
      disposition: 'return', // 来料检验不合格默认退货
      remarks: '',
    });
  };

  // 处理创建不合格品记录提交
  const handleCreateDefectSubmit = async (values: any) => {
    try {
      if (currentDefectInspection?.id) {
        await qualityApi.incomingInspection.createDefect(currentDefectInspection.id.toString(), {
          defect_quantity: values.defect_quantity,
          defect_type: values.defect_type,
          defect_reason: values.defect_reason,
          disposition: values.disposition,
          remarks: values.remarks,
        });
      }

      messageApi.success(
        canReadNcLedger ? {
          content: (
            <Space>
              <span>不合格品记录创建成功</span>
              <Button
                type="link"
                size="small"
                onClick={() =>
                  window.open(
                    `/apps/kuaizhizao/quality-management/nonconforming-ledger?incoming_inspection_id=${currentDefectInspection?.id || ''}`,
                    '_blank'
                  )
                }
              >
                查看台账
              </Button>
            </Space>
          ),
        } : '不合格品记录创建成功'
      );
      setCreateDefectModalVisible(false);
      defectFormRef.current?.resetFields();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建不合格品记录失败');
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<IncomingInspection>[] = useMemo(
    () => [
      {
        title: '检验单号',
        dataIndex: 'inspection_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }}>{r.inspection_code ?? '-'}</Typography.Text>
        ),
      },
      {
        title: '物料编号',
        dataIndex: 'material_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.material_code ?? '') }}>{r.material_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '物料名称', dataIndex: 'material_name' },
      {
        title: '采购入库单号',
        dataIndex: 'purchase_receipt_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.purchase_receipt_code ?? '') }}>{r.purchase_receipt_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '供应商', dataIndex: 'supplier_name' },
      { title: '检验数量', dataIndex: 'inspection_quantity', valueType: 'digit' },
      { title: '合格数量', dataIndex: 'qualified_quantity', valueType: 'digit' },
      { title: '不合格数量', dataIndex: 'unqualified_quantity', valueType: 'digit' },
      {
        title: '检验状态',
        dataIndex: 'status',
        render: (s) => {
          const statusMap: Record<string, { text: string; color: string }> = {
            草稿: { text: '草稿', color: 'default' },
            已审核: { text: '已审核', color: 'processing' },
            已完成: { text: '已完成', color: 'success' },
            已取消: { text: '已取消', color: 'error' },
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
            合格: { text: '合格', color: 'success' },
            不合格: { text: '不合格', color: 'error' },
            部分合格: { text: '部分合格', color: 'warning' },
          };
          const config = resultMap[text as string] || { text: text || '待检验', color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      { title: '检验员', dataIndex: 'inspector_name' },
      { title: '检验时间', dataIndex: 'inspection_time', valueType: 'dateTime' },
      { title: '审核人', dataIndex: 'reviewer_name', render: (t) => t || '-' },
      { title: '审核时间', dataIndex: 'review_time', valueType: 'dateTime', render: (t) => formatDateTimeBySiteSetting(t) },
      { title: '检验备注', dataIndex: 'notes', span: 2, render: (t) => t || '-' },
    ],
    []
  );

  const renderIncomingRowNodes = (record: IncomingInspection): React.ReactNode[] => {
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
        entityName="来料检验单"
        statusField="status"
        reviewStatusField="review_status"
        draftStatuses={[]}
        pendingStatuses={['待审核', '已检验']}
        approvedStatuses={['已审核']}
        rejectedStatuses={['已驳回']}
        theme="link"
        size="small"
        actions={{
          approve: (id) => apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, { method: 'POST' }),
          reject: (id, reason) =>
            apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, {
              method: 'POST',
              params: reason ? { rejection_reason: reason } : undefined,
            }),
        }}
        onSuccess={() => {
          actionRef.current?.reload();
          if (inspectionDetail?.id === record.id) {
            qualityApi.incomingInspection
              .get(record.id!.toString())
              .then((d) => {
                setInspectionDetail(d);
                setIiTrackingRefreshKey((k) => k + 1);
              })
              .catch(() => {});
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
  const columns: ProColumns<IncomingInspection>[] = [
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
      title: '物料',
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, r) => (
        <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
      ),
    },
    { title: '物料编号', dataIndex: 'material_code', hideInTable: true },
    { title: '物料名称', dataIndex: 'material_name', hideInTable: true },
    {
      title: '采购入库单号',
      dataIndex: 'purchase_receipt_code',
      width: 140,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.purchase_receipt_code ?? '') }} ellipsis>
          {r.purchase_receipt_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
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
      width: 100,
      align: 'right',
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '检验员',
      dataIndex: 'inspector_name',
      width: 100,
    },
    {
      title: '检验结果',
      dataIndex: 'inspection_result',
      width: 100,
      render: (text) => {
        const resultMap: Record<string, { text: string; color: string }> = {
          '待检验': { text: '待检验', color: 'default' },
          '合格': { text: '合格', color: 'success' },
          '不合格': { text: '不合格', color: 'error' },
          '部分合格': { text: '部分合格', color: 'warning' },
        };
        const config = resultMap[text as string] || { text: text || '待检验', color: 'default' };
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
      dataIndex: 'lifecycle_stage',
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
        renderIncomingRowActions(renderIncomingRowNodes(record), `inc-${record.id ?? 'row'}`),
    },
  ];

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
      <UniTable<IncomingInspection>
        headerTitle="来料检验"
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.incoming-inspection"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params: any) => {
          try {
            const filters = {
              status: params.status,
              quality_status: params.quality_status,
              supplier_id: params.supplier_id,
              material_id: params.material_id,
              keyword: params.keyword,
            };
            const [response, total] = await Promise.all([
              qualityApi.incomingInspection.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...filters,
              }),
              countWithPagedRequests(
                (p) => qualityApi.incomingInspection.list(p),
                filters,
                { chunkSize: 100 },
              ),
            ]);
            // 后端返回的是数组
            const data = Array.isArray(response) ? response : (response.data || []);
            return {
              data: data,
              success: true,
              total,
            };
          } catch (error) {
            messageApi.error('获取来料检验列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showCreateButton={true}
        createButtonText="从采购入库单创建"
        onCreate={handleCreateFromReceipt}
        enableRowSelection={true}
        onRowSelectionChange={setSelectedRowKeys}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={['采购入库单号', '物料编号', '检验数量', '合格数量', '不合格数量', '备注']}
        importExampleRow={['PR20250115001', 'MAT001', '100', '95', '5', '']}
        showExportButton={true}
        onExport={handleExport}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条来料检验单吗？`,
            onOk: async () => {
              try {
                const ids = keys.map(Number);
                for (const id of keys) {
                  await qualityApi.incomingInspection.delete(String(id));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                setSelectedRowKeys([]);
                if (inspectionDetail?.id != null && ids.includes(inspectionDetail.id)) {
                  setDetailVisible(false);
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
        scroll={{ x: 1800 }}
      />

      <FormModalTemplate
        title={`来料检验 - ${currentInspection?.inspection_code || ''}`}
        open={inspectionModalVisible}
        onClose={() => setInspectionModalVisible(false)}
        onFinish={handleInspectionSubmit}
        isEdit={false}
        initialValues={
          currentInspection ? {
            qualified_quantity: currentInspection.inspection_quantity || 0,
            unqualified_quantity: 0,
          } : {}
        }
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        {currentInspection && (
          <Card title="检验信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>物料编号：</strong>{currentInspection.material_code}
              </Col>
              <Col span={12}>
                <strong>物料名称：</strong>{currentInspection.material_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={24}>
                <strong>检验数量：</strong>{currentInspection.inspection_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <InspectionTemplateConductFields inspection={currentInspection as Record<string, unknown>} />
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
          name="nonconformance_reason"
          label="不合格原因"
          placeholder="存在不合格数量时请填写原因"
          fieldProps={{ rows: 2 }}
          colProps={{ span: 24 }}
        />
        <ProFormTextArea
          name="notes"
          label="检验备注"
          placeholder="请输入检验详情、发现的问题或处理意见"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`检验详情 - ${inspectionDetail?.inspection_code || ''}`}
        open={detailVisible}
        zIndex={incomingInspectionDetailDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setInspectionDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        extra={
          inspectionDetail && (
            <UniWorkflowActions
              record={inspectionDetail}
              entityName="来料检验单"
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={[]}
              pendingStatuses={['待审核', '已检验']}
              approvedStatuses={['已审核']}
              rejectedStatuses={['已驳回']}
              theme="default"
              size="small"
              actions={{
                approve: (id) => apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, { method: 'POST' }),
                reject: (id, reason) =>
                  apiRequest(`/apps/kuaizhizao/incoming-inspections/${id}/approve`, {
                    method: 'POST',
                    params: reason ? { rejection_reason: reason } : undefined,
                  }),
              }}
              onSuccess={() => {
                actionRef.current?.reload();
                if (inspectionDetail?.id) {
                  qualityApi.incomingInspection
                    .get(inspectionDetail.id.toString())
                    .then((d) => {
                      setInspectionDetail(d);
                      setIiTrackingRefreshKey((k) => k + 1);
                    })
                    .catch(() => {});
                }
              }}
            />
          )
        }
        customContent={
          inspectionDetail ? (
            <>
              <InspectionDetailQualityActions
                inspection={inspectionDetail}
                inspectionType="incoming"
                onRegisterDefect={() => handleCreateDefect(inspectionDetail)}
                canRegisterDefect={hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-incoming-inspection:update')}
              />
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
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {inspectionDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='incoming_inspection'
                      documentId={inspectionDetail.id}
                      active={detailVisible}
                      selfDocumentId={inspectionDetail.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailVisible(false);
                      setInspectionDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="来料检验无明细行表" />
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {incomingTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {incomingTracking.error && !incomingTracking.loading && (
                  <Typography.Text type="danger">{incomingTracking.error}</Typography.Text>
                )}
                {incomingTracking.data && !incomingTracking.loading && (
                  <DocumentTrackingTimelineBody data={incomingTracking.data} />
                )}
                {!incomingTracking.loading && !incomingTracking.data && !incomingTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      {/* 从采购入库单创建Modal */}
      <FormModalTemplate
        title="从采购入库单创建来料检验单"
        open={createFromReceiptModalVisible}
        onClose={() => {
          setCreateFromReceiptModalVisible(false);
          createFromReceiptFormRef.current?.resetFields();
        }}
        onFinish={handleCreateFromReceiptSubmit}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={createFromReceiptFormRef}
      >
        <ProFormItem
          name="purchase_receipt_id"
          label="选择采购入库单"
          rules={[{ required: true, message: '请选择采购入库单' }]}
        >
          <UniDropdown
            placeholder="请选择采购入库单"
            showSearch
            loading={purchaseReceiptOptionsLoading}
            options={purchaseReceiptOptions}
            advancedSearch={{
              label: '高级搜索采购入库单',
              fields: [
                { name: 'receipt_code', label: '入库单号', type: 'text' },
                { name: 'supplier_name', label: '供应商名称', type: 'text' },
              ],
              onSearch: (params) => fetchPurchaseReceiptsForIqc(params),
            }}
          />
        </ProFormItem>
      </FormModalTemplate>

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

export default IncomingInspectionPage;

