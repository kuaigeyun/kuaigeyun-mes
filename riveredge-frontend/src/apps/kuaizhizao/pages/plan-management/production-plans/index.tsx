/**
 * 生产计划页面
 *
 * 提供生产计划的管理、查看和执行功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ModalForm, ProFormText, ProFormDateRangePicker, ProFormList, ProFormGroup, ProFormDigit, ProFormDatePicker, ProFormItem, ProFormInstance } from '@ant-design/pro-components';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Table, theme } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DetailDrawerActions,
  DRAWER_CONFIG,
  MODAL_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { usePageMetrics } from '../../../../../hooks/usePageMetrics';
import { planningApi } from '../../../services/production';
import { getProductionPlanLifecycle } from '../../../utils/productionPlanLifecycle';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { apiRequest } from '../../../../../services/api';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { materialApi } from '../../../../master-data/services/material';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import type { Material } from '../../../../master-data/types/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import ProductionControlTower from './ProductionControlTower';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { batchImport } from '../../../../../utils/batchOperations';

// 生产计划接口定义
interface ProductionPlan {
  id?: number;
  tenant_id?: number;
  plan_code?: string;
  plan_name?: string;
  plan_type?: string; // 统一为 MRP；MTS/MTO 见来源需求计算或销售订单
  status?: string;
  execution_status?: string;
  plan_start_date?: string;
  plan_end_date?: string;
  total_work_orders?: number;
  total_purchase_orders?: number;
  reviewer_name?: string;
  review_time?: string;
  created_by_name?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: ProductionPlanItem[];
}

interface ProductionPlanItem {
  id?: number;
  tenant_id?: number;
  plan_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  planned_quantity?: number;
  unit?: string;
  planned_date?: string;
  suggested_action?: string; // 生产/采购
  available_inventory?: number;
  gross_requirement?: number;
  net_requirement?: number;
  work_order_quantity?: number;
  purchase_order_quantity?: number;
  lead_time?: number;
  execution_status?: string;
  work_order_id?: number;
  work_order_code?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  notes?: string;
}

const { useToken } = theme;

const PLAN_TYPE_FALLBACK = [
  { label: 'MRP计划', value: 'MRP' },
  { label: '历史LRP类型', value: 'LRP' },
  { label: '手动计划', value: 'MANUAL' },
];

const ProductionPlansPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [planTypeOptions, setPlanTypeOptions] = useState<Array<{ label: string; value: string }>>(PLAN_TYPE_FALLBACK);
  const [planTypeLoading, setPlanTypeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setPlanTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('PRODUCTION_PLAN_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPlanTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setPlanTypeOptions(PLAN_TYPE_FALLBACK);
      } finally {
        setPlanTypeLoading(false);
      }
    };
    load();
  }, []);

  const { statCards: pageMetricCards, hasConfig: hasPageMetricConfig } = usePageMetrics(location.pathname);

  const invalidatePlanStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['productionPlanStatistics'] });
    queryClient.invalidateQueries({ queryKey: ['pageMetrics', location.pathname] });
  };

  const { data: planStatistics } = useQuery({
    queryKey: ['productionPlanStatistics'],
    queryFn: () =>
      planningApi.productionPlan.getStatistics() as Promise<{
        total_count?: number;
        pending_execution_count?: number;
        executed_count?: number;
        overdue_plans_count?: number;
        pending_review_count?: number;
      }>,
  });

  const statCards: StatCard[] = useMemo(() => {
    if (hasPageMetricConfig && pageMetricCards.length > 0) {
      return pageMetricCards;
    }
    const s = planStatistics;
    return [
      {
        title: '计划总数',
        value: s?.total_count ?? 0,
        prefix: <AppstoreOutlined />,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: '待执行',
        value: s?.pending_execution_count ?? 0,
        prefix: <ClockCircleOutlined />,
        valueStyle: { color: '#faad14' },
      },
      {
        title: '已执行',
        value: s?.executed_count ?? 0,
        prefix: <CheckCircleOutlined />,
        valueStyle: { color: '#52c41a' },
      },
      {
        title: '逾期未执行',
        value: s?.overdue_plans_count ?? 0,
        prefix: <ExclamationCircleOutlined />,
        valueStyle: { color: '#ff4d4f' },
      },
    ];
  }, [hasPageMetricConfig, pageMetricCards, planStatistics]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<ProductionPlan | null>(null);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const createPlanFormRef = useRef<ProFormInstance>(null);

  const appendProductionPlanItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = createPlanFormRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        planned_quantity: 1,
        planned_date: dayjs(),
      }));
      createPlanFormRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  // 表格列定义
  const columns: ProColumns<ProductionPlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'plan_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
      width: 100,
      render: (type) => {
        const typeMap = {
          'MRP': { text: '按预测计划', color: 'processing' },
          'LRP': { text: '历史按订单计划', color: 'success' },
        };
        const config = typeMap[type as keyof typeof typeMap] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '计划期间',
      dataIndex: 'plan_duration',
      width: 200,
      hideInSearch: true,
      render: (_, record) => `${record.plan_start_date} ~ ${record.plan_end_date}`,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueType: 'select',
      valueEnum: {
        草稿: { text: '草稿' },
        已审核: { text: '已审核' },
        已执行: { text: '已执行' },
        已取消: { text: '已取消' },
        已驳回: { text: '已驳回' },
      },
      render: (_: unknown, record: ProductionPlan) => {
        const lifecycle = getProductionPlanLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        return <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{stageName}</Tag>;
      },
    },
    {
      title: '生成人',
      dataIndex: 'created_by_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <UniWorkflowActions
            record={record}
            entityName="生产计划"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[]}
            pendingStatuses={['草稿']}
            approvedStatuses={['已审核']}
            rejectedStatuses={['已驳回']}
            theme="link"
            size="small"
            actions={{
              submit: (id) => planningApi.productionPlan.submit(id.toString()),
              approve: (id) => planningApi.productionPlan.approve(id.toString()),
              reject: (id, reason) =>
                apiRequest(`/apps/kuaizhizao/production-plans/${id}/approve`, {
                  method: 'POST',
                  params: reason ? { rejection_reason: reason } : undefined,
                }),
            }}
            onSuccess={() => {
              invalidatePlanStatistics();
              actionRef.current?.reload();
              if (currentPlan?.id === record.id) {
                planningApi.productionPlan.get(record.id!.toString()).then(setCurrentPlan).catch(() => {});
              }
            }}
          />
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.execution_status === '已执行'}
          >
            编辑
          </Button>
          {record.execution_status !== '已执行' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
              style={{ color: '#1890ff' }}
            >
              执行
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleDelete(record)}
            disabled={record.execution_status === '已执行'}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: ProductionPlan) => {
    try {
      const planDetail = await planningApi.productionPlan.get(record.id!.toString());
      const planItems = await planningApi.productionPlan.getItems(record.id!.toString());
      setCurrentPlan({ ...planDetail, items: planItems });
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取生产计划详情失败');
    }
  };

  // 处理执行
  const handleExecute = async (record: ProductionPlan) => {
    Modal.confirm({
      title: '执行生产计划',
      content: `确定要执行生产计划 "${record.plan_name}" 吗？执行后将生成相应的工单。`,
      onOk: async () => {
        try {
          await planningApi.productionPlan.execute(record.id!.toString());
          messageApi.success('生产计划执行成功，已生成工单');
          invalidatePlanStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || '生产计划执行失败');
        }
      },
    });
  };

  // 处理编辑
  const handleEdit = (_record: ProductionPlan) => {
    messageApi.info('编辑功能正在对接明细调整界面...');
  };

  // 处理删除
  const handleDelete = async (record: ProductionPlan) => {
    Modal.confirm({
      title: '删除生产计划',
      content: `确定要删除生产计划 "${record.plan_code}" 吗？此操作不可撤销。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await planningApi.productionPlan.delete(record.id!.toString());
          messageApi.success('删除成功');
          invalidatePlanStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条生产计划吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          for (const k of keys) {
            await planningApi.productionPlan.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条生产计划`);
          setSelectedRowKeys([]);
          invalidatePlanStatistics();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || '批量删除失败');
        }
      },
    });
  };

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning('导入数据为空或格式不正确');
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      if (h.includes('计划编号') || h.includes('plan_code')) headerMap['plan_code'] = i;
      else if (h.includes('计划名称') || h.includes('plan_name')) headerMap['plan_name'] = i;
      else if (h.includes('计划类型') || h.includes('plan_type')) headerMap['plan_type'] = i;
      else if (h.includes('开始') || h.includes('start')) headerMap['start'] = i;
      else if (h.includes('结束') || h.includes('end')) headerMap['end'] = i;
      else if (h.includes('物料') || h.includes('material')) headerMap['material_code'] = i;
      else if (h.includes('数量') || h.includes('quantity')) headerMap['quantity'] = i;
      else if (h.includes('单位') || h.includes('unit')) headerMap['unit'] = i;
    });
    if (headerMap['plan_name'] === undefined) {
      messageApi.error('导入表头需包含计划名称');
      return;
    }
    if (headerMap['material_code'] === undefined || headerMap['quantity'] === undefined) {
      messageApi.error('导入表头需包含物料编号和数量');
      return;
    }
    const getVal = (row: any[], key: string) => {
      const idx = headerMap[key];
      if (idx === undefined) return '';
      const v = row[idx];
      return v != null ? String(v).trim() : '';
    };
    const grouped = new Map<string, { plan_name: string; plan_type: string; start: string; end: string; items: { material_code: string; quantity: number; unit: string }[] }>();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((c: any) => (c == null || String(c).trim() === ''))) continue;
      const planCode = getVal(row, 'plan_code') || `PLAN-IMPORT-${i}`;
      const planName = getVal(row, 'plan_name');
      const materialCode = getVal(row, 'material_code');
      const qty = Number(getVal(row, 'quantity')) || 0;
      if (!planName || !materialCode || qty <= 0) continue;
      const entry = grouped.get(planCode);
      const item = { material_code: materialCode, quantity: qty, unit: getVal(row, 'unit') || '件' };
      if (!entry) {
        grouped.set(planCode, {
          plan_name: planName,
          plan_type: getVal(row, 'plan_type') || 'MANUAL',
          start: getVal(row, 'start'),
          end: getVal(row, 'end'),
          items: [item],
        });
      } else {
        entry.items.push(item);
      }
    }
    const toImport = Array.from(grouped.entries()).map(([code, v]) => ({
      plan_code: code,
      plan_name: v.plan_name,
      plan_type: v.plan_type,
      plan_start_date: v.start || undefined,
      plan_end_date: v.end || undefined,
      items: v.items,
    }));
    if (toImport.length === 0) {
      messageApi.warning('没有可导入的有效数据');
      return;
    }
    const matRes = await materialApi.list({ limit: 5000, isActive: true });
    const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.items ?? [];
    const items = toImport.map((t) => ({
      ...t,
      items: t.items.map((it) => {
        const mat = matList.find((m: any) => (m.code || m.material_code || '').toString().trim() === (it.material_code || '').trim());
        return {
          material_id: mat?.id ?? mat?.material_id,
          material_code: it.material_code,
          material_name: mat?.name || mat?.material_name || '',
          planned_quantity: it.quantity,
          unit: it.unit || mat?.unit || mat?.material_unit || '件',
          suggested_action: '生产',
        };
      }).filter((it) => it.material_id || it.material_code),
    })).filter((t) => t.items.length > 0);
    if (items.length === 0) {
      messageApi.warning('没有匹配到物料的有效数据');
      return;
    }
    const result = await batchImport({
      items,
      importFn: async (item: any) =>
        planningApi.productionPlan.create({
          plan_code: item.plan_code,
          plan_name: item.plan_name,
          plan_type: item.plan_type || 'MANUAL',
          plan_start_date: item.plan_start_date,
          plan_end_date: item.plan_end_date,
          source_type: 'Manual',
          items: item.items,
        }),
      title: '导入生产计划',
      concurrency: 5,
    });
    if (result.successCount > 0) {
      messageApi.success(`成功导入 ${result.successCount} 条生产计划`);
      invalidatePlanStatistics();
      actionRef.current?.reload();
    }
    if (result.failureCount > 0) {
      messageApi.warning(`部分失败 ${result.failureCount} 条`);
    }
  };

  return (
    <ListPageTemplate statCards={statCards}>
      <div style={{ marginBottom: 16 }}>
        <ProductionControlTower />
      </div>
      <UniTable
          headerTitle="生产计划管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建生产计划"
          onCreate={() => setCreateModalVisible(true)}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton
          onImport={handleListImport}
          importHeaders={['计划编号', '*计划名称', '计划类型', '开始日期', '结束日期', '*物料编号', '*数量', '单位']}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await planningApi.productionPlan.list({ skip: 0, limit: 10000 });
              let items = Array.isArray(res) ? res : ((res as any)?.data || []);
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: ProductionPlan) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `production-plans-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            const list = await planningApi.productionPlan.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              plan_type: params.plan_type,
              status: params.status,
              plan_code: params.plan_code,
            });
            const data = Array.isArray(list) ? list : ((list as any)?.data || []);
            const total = (list as any)?.total ?? (Array.isArray(list) && list.length >= params.pageSize! ? (params.current! * params.pageSize! + 1) : (params.current! - 1) * params.pageSize! + data.length);
            return { data, success: true, total };
          }}
          scroll={{ x: 1200 }}
        />

      <ModalForm
        title="创建生产计划"
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        formRef={createPlanFormRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
        onFinish={async (values) => {
          try {
            const [start, end] = values.dateRange || [];
            const payload = {
              ...values,
              plan_start_date: start,
              plan_end_date: end,
              source_type: 'Manual',
              items: values.items?.map((item: any) => ({
                ...item,
                suggested_action: '生产',
              })) || []
            };
            await planningApi.productionPlan.create(payload);
            messageApi.success('创建生产计划成功');
            invalidatePlanStatistics();
            actionRef.current?.reload();
            return true;
          } catch (error) {
            messageApi.error('创建生产计划失败');
            return false;
          }
        }}
      >
        <ProFormGroup title="基本信息">
          <ProFormText name="plan_name" label="计划名称" rules={[{ required: true }]} />
          <ProFormItem name="plan_type" label="计划类型" initialValue="MANUAL">
            <UniDropdown
              placeholder="请选择计划类型"
              showSearch
              allowClear
              loading={planTypeLoading}
              options={planTypeOptions}
              quickCreate={{ label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') }}
            />
          </ProFormItem>
          <ProFormDateRangePicker name="dateRange" label="计划期间" rules={[{ required: true }]} />
        </ProFormGroup>
        
        <ProFormList
          name="items"
          label="计划明细"
          copyIconProps={false}
          creatorButtonProps={{
            creatorButtonText: '添加物料',
          }}
        >
          <ProFormGroup>
            <ProFormText name="material_code" label="物料编号" width="sm" rules={[{ required: true }]} />
            <ProFormText name="material_name" label="物料名称" width="sm" rules={[{ required: true }]} />
            <ProFormDigit name="planned_quantity" label="计划数量" width="xs" rules={[{ required: true }]} />
            <ProFormDatePicker name="planned_date" label="计划日期" width="xs" rules={[{ required: true }]} />
          </ProFormGroup>
        </ProFormList>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
          <Button type="default" icon={<ShoppingOutlined />} onClick={() => setMaterialPickerOpen(true)}>
            {t('app.kuaizhizao.common.materialBatchSelect')}
          </Button>
        </div>
      </ModalForm>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendProductionPlanItemsFromMaterials}
      />

      <DetailDrawerTemplate
        title={`生产计划详情 - ${currentPlan?.plan_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        extra={
          currentPlan && currentPlan.execution_status !== '已执行' && (
            <Space>
              <UniWorkflowActions
                record={currentPlan}
                entityName="生产计划"
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={[]}
                pendingStatuses={['草稿']}
                approvedStatuses={['已审核']}
                rejectedStatuses={['已驳回']}
                theme="default"
                size="small"
                actions={{
                  submit: (id) => planningApi.productionPlan.submit(id.toString()),
                  approve: (id) => planningApi.productionPlan.approve(id.toString()),
                  reject: (id, reason) =>
                    apiRequest(`/apps/kuaizhizao/production-plans/${id}/approve`, {
                      method: 'POST',
                      params: reason ? { rejection_reason: reason } : undefined,
                    }),
                }}
                onSuccess={() => {
                  invalidatePlanStatistics();
                  actionRef.current?.reload();
                  if (currentPlan?.id) {
                    planningApi.productionPlan.get(currentPlan.id.toString()).then(setCurrentPlan).catch(() => {});
                  }
                }}
              />
              <DetailDrawerActions
                items={[
                  { key: 'edit', visible: currentPlan.status !== '已执行', render: () => <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setDetailDrawerVisible(false); handleEdit(currentPlan); }}>编辑</Button> },
                  { key: 'execute', visible: currentPlan.status === '已审核', render: () => <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(currentPlan)}>执行计划</Button> },
                  { key: 'delete', visible: currentPlan.status !== '已执行', render: () => <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(currentPlan)}>删除</Button> },
                ]}
              />
            </Space>
          )
        }
        customContent={
          currentPlan ? (
            <div style={{ padding: '16px 0' }}>
              <DetailDrawerSection title="基本信息">
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>计划编号：</strong>{currentPlan.plan_code}
                  </Col>
                  <Col span={12}>
                    <strong>计划名称：</strong>{currentPlan.plan_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}>
                    <strong>计划类型：</strong>
                    <Tag color={currentPlan.plan_type === 'MRP' ? 'processing' : 'success'}>
                      {currentPlan.plan_type === 'MRP' ? '按预测计划' : '按订单计划'}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <strong>状态：</strong>
                    <Tag color={currentPlan.status === '已执行' ? 'success' : 'default'}>
                      {currentPlan.status}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <strong>生成人：</strong>{currentPlan.created_by_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>计划期间：</strong>{currentPlan.plan_start_date} ~ {currentPlan.plan_end_date}
                  </Col>
                  <Col span={12}>
                    <strong>创建时间：</strong>{currentPlan.created_at}
                  </Col>
                </Row>
              </DetailDrawerSection>

              {/* 生命周期 */}
              {(() => {
                const lifecycle = getProductionPlanLifecycle(currentPlan);
                const mainStages = lifecycle.mainStages ?? [];
                const subStages = lifecycle.subStages ?? [];
                if (mainStages.length === 0 && subStages.length === 0) return null;
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
                      {subStages.length > 0 && (
                        <div>
                          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                            执行中 · 全链路
                          </div>
                          <UniLifecycleStepper steps={subStages} showLabels />
                        </div>
                      )}
                    </div>
                  </DetailDrawerSection>
                );
              })()}

              {/* 3. 单据明细 */}
              {currentPlan.items && currentPlan.items.length > 0 && (
                <DetailDrawerSection title="计划明细">
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编号', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '计划数量', dataIndex: 'planned_quantity', width: 100, align: 'right' },
                      { title: '单位', dataIndex: 'unit', width: 60 },
                      { 
                        title: '排程建议', 
                        dataIndex: 'planned_date', 
                        width: 140,
                        render: (date, record) => (
                          <div>
                            <div>{date}</div>
                            {record.planned_quantity && record.planned_quantity > 150 && (
                              <div style={{ color: '#ff4d4f', fontSize: 12 }}>建议顺延至: 02-16</div>
                            )}
                          </div>
                        )
                      },
                      { 
                        title: '执行状态', 
                        dataIndex: 'execution_status', 
                        width: 100,
                        render: (status) => (
                          <Tag color={status === '已执行' ? 'green' : 'default'}>
                            {status || '未执行'}
                          </Tag>
                        )
                      },
                      { 
                        title: '关联单号', 
                        dataIndex: 'work_order_id', 
                        width: 150,
                        render: (woId, record) => {
                          if (record.suggested_action === '生产' && woId) {
                            return (
                              <a onClick={() => messageApi.info(`跳转到工单详情: ${woId}`)}>
                                {record.work_order_code || `工单#${woId}`}
                              </a>
                            );
                          }
                          return '-';
                        }
                      },
                    ]}
                    dataSource={currentPlan.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
                </DetailDrawerSection>
              )}

              {/* 4. 操作记录 */}
              {currentPlan?.id && (
                <DetailDrawerSection title="操作历史">
                  <DocumentTrackingPanel documentType="production_plan" documentId={currentPlan.id} />
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />
      
      <SyncFromDatasetModal
        title="从数据集中心同步生产计划"
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={async (rows) => {
          try {
            let successCount = 0;
            for (const row of rows) {
              const payload = {
                plan_code: row.plan_code || row.planCode,
                plan_name: row.plan_name || row.planName,
                plan_type: row.plan_type || row.planType || 'MRP',
                plan_start_date: row.plan_start_date || row.planStartDate,
                plan_end_date: row.plan_end_date || row.planEndDate,
                items: Array.isArray(row.items) ? row.items : [],
              };
              await planningApi.productionPlan.create(payload);
              successCount += 1;
            }
            messageApi.success(`已同步 ${successCount} 条生产计划`);
            setSyncModalVisible(false);
            invalidatePlanStatistics();
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error?.message || '同步失败');
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default ProductionPlansPage;
