/**
 * 应用管理 - 按销售订单生成制造全流程数据（运维造数）
 *
 * 须先选择目标组织，再加载该组织销售订单/仓库并造数（与开放 API 页一致：切换本地 tenant 头）。
 */

import React, { useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Radio,
  Result,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  getTenantId,
  getToken,
  isInfraSuperAdminUser,
  setTenantId,
  setToken,
  setUserInfo,
} from '../../../../../utils/auth';
import { applyTenantSwitchSideEffects } from '../../../../../utils/applyTenantSwitch';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useGlobalStore } from '../../../../../stores';
import { getMyTenants, switchTenant, tenantNameFromLoginResponse } from '../../../../../services/auth';
import { getTenantList, TenantStatus } from '../../../../../services/tenant';
import { warehouseApi } from '../../../../master-data/services/warehouse';
import { workGroupApi } from '../../../../master-data/services/factory';
import { getRoleList } from '../../../../../services/role';
import { getDepartmentTree, type DepartmentTreeItem } from '../../../../../services/department';
import { UniUserIdSelect } from '../../../../../components/uni-user-id-select';
import { listSalesOrders } from '../../../services/sales-order';
import { listSalesForecasts } from '../../../services/sales-forecast';
import {
  executeFlowGenerate,
  getFlowOperatorDefaults,
  previewFlowGenerate,
  type FlowExecuteResult,
  type FlowGeneratePayload,
  type FlowPreviewResult,
  type FlowSourceType,
  type FlowStepResult,
  type StepOperatorMode,
  type StepOperatorPayload,
} from '../../../services/flow-data-generate';
import EquipmentOpsGeneratePanel from './EquipmentOpsGeneratePanel';

const STEP_OPTIONS = [
  { key: 'demand_computation', required: true },
  { key: 'purchase', required: false },
  { key: 'incoming_inspection', required: false },
  { key: 'inventory_topup', required: false },
  { key: 'production_picking', required: false },
  { key: 'reporting', required: false },
  { key: 'process_inspection', required: false },
  { key: 'finished_goods_inspection', required: false },
  { key: 'finished_goods_receipt', required: false },
  { key: 'shipment_delivery', required: false },
] as const;

const OPERATOR_MODE_VALUES: StepOperatorMode[] = [
  'random_role',
  'random_department',
  'random_team',
  'operation_assigned',
  'fixed',
  'current',
];
const DEFAULT_REPORTING_BATCHES_MIN = 2;
const DEFAULT_REPORTING_BATCHES_MAX = 5;

function flattenDepartmentOptions(
  nodes: DepartmentTreeItem[],
  depth = 0,
): Array<{ value: number; label: string }> {
  const out: Array<{ value: number; label: string }> = [];
  for (const node of nodes) {
    const id = Number(node.id);
    if (Number.isFinite(id) && id > 0) {
      const prefix = depth > 0 ? `${'—'.repeat(depth)} ` : '';
      out.push({
        value: id,
        label: `${prefix}${node.name}${node.code ? ` (${node.code})` : ''}`,
      });
    }
    if (node.children?.length) {
      out.push(...flattenDepartmentOptions(node.children, depth + 1));
    }
  }
  return out;
}

export default function FlowDataGeneratePage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
  const isInfraSuperAdmin = isInfraSuperAdminUser(currentUser);

  const [selectedTenantId, setSelectedTenantId] = useState<number | undefined>(() => {
    const tid = getTenantId();
    const n = tid != null ? Number(tid) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  });
  const [tenantConfirmed, setTenantConfirmed] = useState(false);
  const [tenantSwitching, setTenantSwitching] = useState(false);

  const [preview, setPreview] = useState<FlowPreviewResult | null>(null);
  const [result, setResult] = useState<FlowExecuteResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [orderKeyword, setOrderKeyword] = useState('');
  const [sourceType, setSourceType] = useState<FlowSourceType>('sales_order');

  const tenantsQuery = useQuery({
    queryKey: ['kuaizhizao', 'flow-generate', 'tenant-options', isInfraSuperAdmin],
    queryFn: async (): Promise<Array<{ value: number; label: string }>> => {
      if (isInfraSuperAdmin) {
        const resp = await getTenantList(
          {
            page: 1,
            page_size: 100,
            status: TenantStatus.ACTIVE,
            sort: 'id',
            order: 'asc',
          },
          true,
        );
        return (resp.items ?? [])
          .map((tenant) => ({
            value: Number(tenant.id),
            label: `${tenant.name} (#${tenant.id})`,
          }))
          .sort((a, b) => a.value - b.value);
      }
      const tenants = await getMyTenants();
      return tenants
        .map((tenant) => ({
          value: Number(tenant.id),
          label: `${tenant.name} (#${tenant.id})`,
        }))
        .sort((a, b) => a.value - b.value);
    },
    enabled: Boolean(getToken()),
    retry: 1,
  });

  const tenantOptions = tenantsQuery.data ?? [];
  const tenantsLoading = tenantsQuery.isLoading || tenantsQuery.isFetching;

  React.useEffect(() => {
    if (!tenantsQuery.isError) return;
    message.error(
      getApiErrorMessage(tenantsQuery.error, t('app.kuaizhizao.flowDataGenerate.tenantLoadFail')),
    );
  }, [tenantsQuery.isError, tenantsQuery.error, message, t]);

  const ready = Boolean(tenantConfirmed && selectedTenantId);

  const ordersQuery = useQuery({
    queryKey: ['kuaizhizao', 'flow-generate', 'eligible-orders', selectedTenantId, orderKeyword],
    queryFn: async () => {
      const res = await listSalesOrders({
        skip: 0,
        limit: 100,
        keyword: orderKeyword || undefined,
        view: 'options',
        pullable_only: true,
        pull_target: 'demand_computation',
        list_scope: 'all',
        order_by: '-id',
      });
      const rows = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : Array.isArray((res as any)?.items)
            ? (res as any).items
            : [];
      return {
        items: rows.map((o: any) => ({
          id: Number(o.id),
          order_code: String(o.order_code || ''),
          order_name: o.order_name,
          customer_name: o.customer_name,
          status: o.status,
          order_date: o.order_date,
          planning_pushed_to_computation: Boolean(
            o.planning_pushed_to_computation ?? o.pushed_to_computation,
          ),
          eligible: !Boolean(o.planning_pushed_to_computation ?? o.pushed_to_computation),
          block_reason: Boolean(o.planning_pushed_to_computation ?? o.pushed_to_computation)
            ? '已下推需求计算，请选择未下推的销售订单'
            : null,
        })),
        total: Number((res as any)?.total ?? rows.length),
      };
    },
    enabled: ready && sourceType === 'sales_order',
    retry: 1,
  });

  const forecastsQuery = useQuery({
    queryKey: ['kuaizhizao', 'flow-generate', 'eligible-forecasts', selectedTenantId, orderKeyword],
    queryFn: async () => {
      const res = await listSalesForecasts({
        skip: 0,
        limit: 100,
        keyword: orderKeyword || undefined,
        pullable_only: true,
        pull_target: 'demand_computation',
        order_by: '-id',
      });
      const rows = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : Array.isArray((res as any)?.items)
            ? (res as any).items
            : [];
      return {
        items: rows.map((o: any) => ({
          id: Number(o.id),
          forecast_code: String(o.forecast_code || ''),
          forecast_name: o.forecast_name,
          forecast_period: o.forecast_period,
          status: o.status,
          planning_pushed_to_computation: Boolean(o.planning_pushed_to_computation),
          eligible: !Boolean(o.planning_pushed_to_computation),
          block_reason: Boolean(o.planning_pushed_to_computation)
            ? '已下推需求计算，请选择未下推的销售预测'
            : null,
        })),
        total: Number((res as any)?.total ?? rows.length),
      };
    },
    enabled: ready && sourceType === 'sales_forecast',
    retry: 1,
  });

  const warehousesQuery = useQuery({
    queryKey: ['master-data', 'warehouses', 'flow-generate', selectedTenantId],
    queryFn: async () => {
      const res = await warehouseApi.list({ skip: 0, limit: 200, is_active: true });
      return res?.items || [];
    },
    enabled: ready,
  });

  const rolesQuery = useQuery({
    queryKey: ['core', 'roles', 'flow-generate', selectedTenantId],
    queryFn: async () => {
      const res = await getRoleList({ page: 1, page_size: 100, is_active: true });
      return res.items || [];
    },
    enabled: ready,
    retry: 1,
  });

  const departmentsQuery = useQuery({
    queryKey: ['core', 'departments', 'flow-generate', selectedTenantId],
    queryFn: async () => {
      const res = await getDepartmentTree({ is_active: true });
      return res.items || [];
    },
    enabled: ready,
    retry: 1,
  });

  const workGroupsQuery = useQuery({
    queryKey: ['master-data', 'work-groups', 'flow-generate', selectedTenantId],
    queryFn: async () => {
      const res = await workGroupApi.list({ skip: 0, limit: 200, is_active: true });
      return res?.items || [];
    },
    enabled: ready,
    retry: 1,
  });

  const operatorDefaultsQuery = useQuery({
    queryKey: ['kuaizhizao', 'flow-generate', 'operator-defaults', selectedTenantId],
    queryFn: () => getFlowOperatorDefaults(),
    enabled: ready,
    retry: 1,
  });

  const orderOptions = useMemo(() => {
    const items = ordersQuery.data?.items || [];
    return items.map((o) => ({
      value: o.id,
      disabled: o.eligible === false,
      label: `${o.order_code}${o.customer_name ? ` · ${o.customer_name}` : ''}${
        o.block_reason ? `（${o.block_reason}）` : ''
      }`,
    }));
  }, [ordersQuery.data]);

  const forecastOptions = useMemo(() => {
    const items = forecastsQuery.data?.items || [];
    return items.map((o) => ({
      value: o.id,
      disabled: o.eligible === false,
      label: `${o.forecast_code}${o.forecast_name ? ` · ${o.forecast_name}` : ''}${
        o.block_reason ? `（${o.block_reason}）` : ''
      }`,
    }));
  }, [forecastsQuery.data]);

  const sourceDocQuery = sourceType === 'sales_forecast' ? forecastsQuery : ordersQuery;
  const sourceDocOptions = sourceType === 'sales_forecast' ? forecastOptions : orderOptions;

  const warehouseOptions = useMemo(() => {
    return (warehousesQuery.data || []).map((w: any) => ({
      value: Number(w.id),
      label: `${w.name || w.code || w.id}${w.code ? ` (${w.code})` : ''}`,
    }));
  }, [warehousesQuery.data]);

  const roleOptions = useMemo(() => {
    return (rolesQuery.data || []).map((r) => ({
      value: r.code,
      label: `${r.name}${r.code ? ` (${r.code})` : ''}`,
    }));
  }, [rolesQuery.data]);

  const departmentOptions = useMemo(
    () => flattenDepartmentOptions(departmentsQuery.data || []),
    [departmentsQuery.data],
  );

  const workGroupOptions = useMemo(() => {
    return (workGroupsQuery.data || []).map((g: any) => ({
      value: Number(g.id),
      label: `${g.name || g.code || g.id}${g.code ? ` (${g.code})` : ''}`,
    }));
  }, [workGroupsQuery.data]);

  const defaultRoleByStep = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of operatorDefaultsQuery.data?.steps || []) {
      map[row.step_key] = row.default_role_codes || [];
    }
    return map;
  }, [operatorDefaultsQuery.data]);

  const applyTenant = async (tenantId: number) => {
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      message.warning(t('app.kuaizhizao.flowDataGenerate.tenantRequired'));
      return;
    }
    const tenantLabel =
      tenantOptions.find((o) => o.value === tenantId)?.label || `#${tenantId}`;
    const tenantName = tenantLabel.replace(/\s*\(#\d+\)\s*$/, '').trim() || tenantLabel;

    try {
      setTenantSwitching(true);
      if (isInfraSuperAdmin) {
        setTenantId(tenantId);
        const nextUser = {
          ...(currentUser || {}),
          tenant_id: tenantId,
          tenant_name: tenantName,
        };
        setCurrentUser(nextUser as any);
        setUserInfo(nextUser);
      } else {
        const currentId = Number(getTenantId());
        if (currentId !== tenantId) {
          const response = await switchTenant(tenantId);
          setToken(response.access_token);
          const selectedId = response.user?.tenant_id || response.default_tenant_id || tenantId;
          setTenantId(selectedId);
          const switchedName = tenantNameFromLoginResponse(response) || tenantName;
          const nextUser = {
            ...(currentUser || {}),
            ...(response.user || {}),
            tenant_id: selectedId,
            tenant_name: switchedName,
          };
          setCurrentUser(nextUser as any);
          setUserInfo(nextUser);
          await applyTenantSwitchSideEffects(queryClient, navigate);
          tenantId = Number(selectedId);
        } else {
          setTenantId(tenantId);
        }
      }

      setSelectedTenantId(tenantId);
      setTenantConfirmed(true);
      setPreview(null);
      setResult(null);
      setOrderKeyword('');
      form.setFieldsValue({
        source_doc_id: undefined,
        sales_order_id: undefined,
        sales_forecast_id: undefined,
        warehouse_id: undefined,
      });
      message.success(t('app.kuaizhizao.flowDataGenerate.tenantSwitched', { id: tenantId }));
    } catch (e) {
      message.error(getApiErrorMessage(e, t('app.kuaizhizao.flowDataGenerate.tenantLoadFail')));
    } finally {
      setTenantSwitching(false);
    }
  };

  const buildPayload = async (): Promise<FlowGeneratePayload> => {
    if (!ready || !selectedTenantId) {
      throw new Error(t('app.kuaizhizao.flowDataGenerate.tenantRequired'));
    }
    // 确保请求头落到所选组织
    setTenantId(selectedTenantId);
    const values = await form.validateFields();
    const steps: Record<string, boolean> = {};
    for (const opt of STEP_OPTIONS) {
      steps[opt.key] = (values.enabled_steps || []).includes(opt.key);
    }
    steps.demand_computation = true;
    const intervals: Record<string, { min_seconds: number; max_seconds: number }> = {};
    for (const opt of STEP_OPTIONS) {
      const minV = values[`interval_min_${opt.key}`];
      const maxV = values[`interval_max_${opt.key}`];
      if (minV != null && maxV != null) {
        const minMinutes = Math.max(1, Number(minV));
        const maxMinutes = Math.max(minMinutes, Number(maxV));
        intervals[opt.key] = {
          min_seconds: minMinutes * 60,
          max_seconds: maxMinutes * 60,
        };
      }
    }
    const anchor: Dayjs | undefined = values.anchor_at;
    const docId = Number(values.source_doc_id);
    const defaultMinMinutes = Math.max(1, Number(values.default_min_minutes ?? 5));
    const defaultMaxMinutes = Math.max(defaultMinMinutes, Number(values.default_max_minutes ?? 30));
    const step_operators: Record<string, StepOperatorPayload> = {};
    for (const opt of STEP_OPTIONS) {
      const rawMode = String(values[`op_mode_${opt.key}`] || 'random_role') as StepOperatorMode;
      const mode: StepOperatorMode = OPERATOR_MODE_VALUES.includes(rawMode) ? rawMode : 'random_role';
      const userId = Number(values[`op_user_${opt.key}`]);
      const roleCode = String(values[`op_role_${opt.key}`] || '').trim();
      const departmentId = Number(values[`op_dept_${opt.key}`]);
      const workGroupId = Number(values[`op_team_${opt.key}`]);
      const stepLabel = t(`app.kuaizhizao.flowDataGenerate.step.${opt.key}`);
      if (mode === 'fixed' && !(Number.isFinite(userId) && userId > 0)) {
        throw new Error(
          t('app.kuaizhizao.flowDataGenerate.operatorUserRequired', { step: stepLabel }),
        );
      }
      if (mode === 'random_department' && !(Number.isFinite(departmentId) && departmentId > 0)) {
        throw new Error(
          t('app.kuaizhizao.flowDataGenerate.operatorDepartmentRequired', { step: stepLabel }),
        );
      }
      if (mode === 'random_team' && !(Number.isFinite(workGroupId) && workGroupId > 0)) {
        throw new Error(
          t('app.kuaizhizao.flowDataGenerate.operatorTeamRequired', { step: stepLabel }),
        );
      }
      step_operators[opt.key] = {
        mode,
        user_id: mode === 'fixed' && Number.isFinite(userId) && userId > 0 ? userId : null,
        role_code: mode === 'random_role' && roleCode ? roleCode : null,
        department_id:
          mode === 'random_department' && Number.isFinite(departmentId) && departmentId > 0
            ? departmentId
            : null,
        work_group_id:
          mode === 'random_team' && Number.isFinite(workGroupId) && workGroupId > 0
            ? workGroupId
            : null,
      };
    }
    const reportingMin = Math.max(1, Math.min(20, Number(values.reporting_batches_min ?? DEFAULT_REPORTING_BATCHES_MIN)));
    const reportingMax = Math.max(
      reportingMin,
      Math.min(20, Number(values.reporting_batches_max ?? DEFAULT_REPORTING_BATCHES_MAX)),
    );
    return {
      source_type: sourceType,
      sales_order_id: sourceType === 'sales_order' ? docId : null,
      sales_forecast_id: sourceType === 'sales_forecast' ? docId : null,
      warehouse_id: values.warehouse_id ? Number(values.warehouse_id) : null,
      anchor_at: anchor ? anchor.toISOString() : null,
      default_interval: {
        min_seconds: defaultMinMinutes * 60,
        max_seconds: defaultMaxMinutes * 60,
      },
      intervals,
      steps,
      step_operators,
      reporting_batches: {
        min_batches: reportingMin,
        max_batches: reportingMax,
      },
      use_work_schedule: Boolean(values.use_work_schedule),
      work_schedule: values.use_work_schedule
        ? {
            weekdays: [0, 1, 2, 3, 4],
            start_time: '09:00',
            end_time: '18:00',
            lookback_days: 30,
          }
        : null,
    };
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    setResult(null);
    try {
      const payload = await buildPayload();
      const data = await previewFlowGenerate(payload);
      setPreview(data);
      message.success(t('app.kuaizhizao.flowDataGenerate.previewOk'));
    } catch (e) {
      message.error(getApiErrorMessage(e, t('app.kuaizhizao.flowDataGenerate.previewFail')));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecute = async () => {
    if (!ready) {
      message.warning(t('app.kuaizhizao.flowDataGenerate.tenantRequired'));
      return;
    }
    const tenantLabel =
      tenantOptions.find((o) => o.value === selectedTenantId)?.label || `#${selectedTenantId}`;
    modal.confirm({
      title: t('app.kuaizhizao.flowDataGenerate.confirmTitle'),
      content: t('app.kuaizhizao.flowDataGenerate.confirmContentWithTenant', {
        tenant: tenantLabel,
      }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setLoadingExecute(true);
        setResult(null);
        try {
          const payload = await buildPayload();
          const data = await executeFlowGenerate(payload);
          setResult(data);
          if (data.success) {
            message.success(t('app.kuaizhizao.flowDataGenerate.executeOk'));
          } else {
            message.warning(t('app.kuaizhizao.flowDataGenerate.executePartial'));
          }
          void sourceDocQuery.refetch();
        } catch (e) {
          message.error(getApiErrorMessage(e, t('app.kuaizhizao.flowDataGenerate.executeFail')));
        } finally {
          setLoadingExecute(false);
        }
      },
    });
  };

  const timelineColumns: ColumnsType<FlowStepResult> = [
    { title: t('app.kuaizhizao.flowDataGenerate.colLabel'), dataIndex: 'label', width: 160 },
    { title: t('app.kuaizhizao.flowDataGenerate.colDocType'), dataIndex: 'doc_type', width: 140 },
    { title: t('app.kuaizhizao.flowDataGenerate.colDocCode'), dataIndex: 'doc_code', width: 160 },
    {
      title: t('app.kuaizhizao.flowDataGenerate.colIssuedAt'),
      dataIndex: 'issued_at',
      width: 200,
      render: (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.flowDataGenerate.colLogId'),
      dataIndex: 'operation_log_id',
      width: 100,
      render: (v) => v ?? '-',
    },
    {
      title: t('app.kuaizhizao.flowDataGenerate.colStatus'),
      dataIndex: 'status',
      width: 100,
      render: (v, row) => v || (row.message ? 'error' : 'ok'),
    },
    {
      title: t('app.kuaizhizao.flowDataGenerate.colNote'),
      dataIndex: 'note',
      ellipsis: true,
      render: (v, row) => v || row.message || '-',
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px 48px' }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t('app.kuaizhizao.flowDataGenerate.pageTitle')}
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={t('app.kuaizhizao.flowDataGenerate.pageHint')}
      />

      <Card size="small" title={t('app.kuaizhizao.flowDataGenerate.tenantCard')} style={{ marginBottom: 16 }}>
        <Space wrap align="start">
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              {t('app.kuaizhizao.flowDataGenerate.tenantLabel')}
            </Typography.Text>
            <Select
              style={{ width: 360 }}
              showSearch
              loading={tenantsLoading || tenantSwitching}
              placeholder={t('app.kuaizhizao.flowDataGenerate.tenantPlaceholder')}
              optionFilterProp="label"
              value={selectedTenantId}
              options={tenantOptions}
              notFoundContent={
                tenantsQuery.isError
                  ? t('app.kuaizhizao.flowDataGenerate.tenantLoadFail')
                  : tenantsLoading
                    ? t('ui.placeholder.loading')
                    : undefined
              }
              onOpenChange={(open) => {
                if (open && (tenantsQuery.isError || tenantOptions.length === 0)) {
                  void tenantsQuery.refetch();
                }
              }}
              onChange={(v) => {
                setSelectedTenantId(Number(v));
                setTenantConfirmed(false);
                setPreview(null);
                setResult(null);
              }}
            />
          </div>
          <Button
            type="primary"
            style={{ marginTop: 22 }}
            disabled={!selectedTenantId || tenantSwitching}
            loading={tenantSwitching}
            onClick={() => selectedTenantId && void applyTenant(selectedTenantId)}
          >
            {t('app.kuaizhizao.flowDataGenerate.confirmTenant')}
          </Button>
          {ready && (
            <Typography.Text type="secondary" style={{ marginTop: 28 }}>
              {t('app.kuaizhizao.flowDataGenerate.tenantActiveHint', {
                tenant:
                  tenantOptions.find((o) => o.value === selectedTenantId)?.label ||
                  `#${selectedTenantId}`,
              })}
            </Typography.Text>
          )}
        </Space>
        {isInfraSuperAdmin && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            {t('app.kuaizhizao.flowDataGenerate.tenantInfraHint')}
          </Typography.Paragraph>
        )}
      </Card>

      {!ready ? (
        <Result
          status="info"
          title={t('app.kuaizhizao.flowDataGenerate.selectTenantFirst')}
          subTitle={t('app.kuaizhizao.flowDataGenerate.selectTenantFirstHint')}
        />
      ) : (
        <Tabs
          destroyOnHidden
          items={[
            {
              key: 'manufacturing-flow',
              label: t('app.kuaizhizao.flowDataGenerate.tabManufacturing'),
              children: (
                <>
          <Card size="small" title={t('app.kuaizhizao.flowDataGenerate.configCard')}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                enabled_steps: STEP_OPTIONS.map((s) => s.key),
                default_min_minutes: 5,
                default_max_minutes: 30,
                use_work_schedule: false,
                reporting_batches_min: DEFAULT_REPORTING_BATCHES_MIN,
                reporting_batches_max: DEFAULT_REPORTING_BATCHES_MAX,
                ...Object.fromEntries(
                  STEP_OPTIONS.flatMap((s) => [
                    [`interval_min_${s.key}`, 5],
                    [`interval_max_${s.key}`, 30],
                    [`op_mode_${s.key}`, 'random_role'],
                  ]),
                ),
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={24}>
                  <Form.Item label={t('app.kuaizhizao.flowDataGenerate.sourceType')}>
                    <Radio.Group
                      value={sourceType}
                      optionType="button"
                      options={[
                        {
                          value: 'sales_order',
                          label: t('app.kuaizhizao.flowDataGenerate.salesOrder'),
                        },
                        {
                          value: 'sales_forecast',
                          label: t('app.kuaizhizao.flowDataGenerate.salesForecast'),
                        },
                      ]}
                      onChange={(e) => {
                        const next = e.target.value as FlowSourceType;
                        setSourceType(next);
                        setOrderKeyword('');
                        setPreview(null);
                        setResult(null);
                        form.setFieldsValue({ source_doc_id: undefined });
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="source_doc_id"
                    label={
                      sourceType === 'sales_forecast'
                        ? t('app.kuaizhizao.flowDataGenerate.salesForecast')
                        : t('app.kuaizhizao.flowDataGenerate.salesOrder')
                    }
                    rules={[
                      {
                        required: true,
                        message:
                          sourceType === 'sales_forecast'
                            ? t('app.kuaizhizao.flowDataGenerate.salesForecastRequired')
                            : t('app.kuaizhizao.flowDataGenerate.salesOrderRequired'),
                      },
                    ]}
                  >
                    <Select
                      showSearch
                      allowClear
                      placeholder={
                        sourceType === 'sales_forecast'
                          ? t('app.kuaizhizao.flowDataGenerate.salesForecastPlaceholder')
                          : t('app.kuaizhizao.flowDataGenerate.salesOrderPlaceholder')
                      }
                      options={sourceDocOptions}
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        String(option?.label ?? '')
                          .toLowerCase()
                          .includes(String(input || '').toLowerCase())
                      }
                      onSearch={(v) => {
                        const next = String(v || '').trim();
                        if (next.length === 0 || next.length >= 2) {
                          setOrderKeyword(next);
                        }
                      }}
                      onClear={() => setOrderKeyword('')}
                      loading={sourceDocQuery.isLoading || sourceDocQuery.isFetching}
                      notFoundContent={
                        sourceDocQuery.isError
                          ? getApiErrorMessage(
                              sourceDocQuery.error,
                              t('app.kuaizhizao.flowDataGenerate.previewFail'),
                            )
                          : sourceDocQuery.isLoading
                            ? t('ui.placeholder.loading')
                            : sourceType === 'sales_forecast'
                              ? t('app.kuaizhizao.flowDataGenerate.emptyForecasts')
                              : t('app.kuaizhizao.flowDataGenerate.emptyOrders')
                      }
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="warehouse_id" label={t('app.kuaizhizao.flowDataGenerate.warehouse')}>
                    <Select
                      showSearch
                      allowClear
                      optionFilterProp="label"
                      placeholder={t('app.kuaizhizao.flowDataGenerate.warehousePlaceholder')}
                      options={warehouseOptions}
                      loading={warehousesQuery.isLoading}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="anchor_at" label={t('app.kuaizhizao.flowDataGenerate.anchorAt')}>
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="default_min_minutes"
                    label={t('app.kuaizhizao.flowDataGenerate.defaultMinMinutes')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter={t('app.kuaizhizao.flowDataGenerate.minuteUnit')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="default_max_minutes"
                    label={t('app.kuaizhizao.flowDataGenerate.defaultMaxMinutes')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter={t('app.kuaizhizao.flowDataGenerate.minuteUnit')} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="enabled_steps" label={t('app.kuaizhizao.flowDataGenerate.steps')}>
                <Checkbox.Group
                  options={STEP_OPTIONS.map((s) => ({
                    value: s.key,
                    disabled: s.required,
                    label: t(`app.kuaizhizao.flowDataGenerate.step.${s.key}`),
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="use_work_schedule"
                label={t('app.kuaizhizao.flowDataGenerate.useWorkSchedule')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                {t('app.kuaizhizao.flowDataGenerate.intervalHint')}
              </Typography.Paragraph>
              {STEP_OPTIONS.map((s) => (
                <Row gutter={12} key={s.key} style={{ marginBottom: 8 }}>
                  <Col span={8}>
                    <Typography.Text>
                      {t(`app.kuaizhizao.flowDataGenerate.step.${s.key}`)}
                    </Typography.Text>
                  </Col>
                  <Col span={8}>
                    <Form.Item name={`interval_min_${s.key}`} noStyle>
                      <InputNumber
                        min={1}
                        addonBefore={t('app.kuaizhizao.flowDataGenerate.min')}
                        addonAfter={t('app.kuaizhizao.flowDataGenerate.minuteUnit')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name={`interval_max_${s.key}`} noStyle>
                      <InputNumber
                        min={1}
                        addonBefore={t('app.kuaizhizao.flowDataGenerate.max')}
                        addonAfter={t('app.kuaizhizao.flowDataGenerate.minuteUnit')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ))}

              <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>
                {t('app.kuaizhizao.flowDataGenerate.reportingBatchCard')}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                {t('app.kuaizhizao.flowDataGenerate.reportingBatchHint')}
              </Typography.Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="reporting_batches_min"
                    label={t('app.kuaizhizao.flowDataGenerate.reportingBatchesMin')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="reporting_batches_max"
                    label={t('app.kuaizhizao.flowDataGenerate.reportingBatchesMax')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
                {t('app.kuaizhizao.flowDataGenerate.operatorCard')}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                {t('app.kuaizhizao.flowDataGenerate.operatorHint')}
              </Typography.Paragraph>
              {STEP_OPTIONS.map((s) => (
                <Row gutter={12} key={`op-${s.key}`} align="middle" style={{ marginBottom: 12 }}>
                  <Col xs={24} md={5}>
                    <Typography.Text>
                      {t(`app.kuaizhizao.flowDataGenerate.step.${s.key}`)}
                    </Typography.Text>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name={`op_mode_${s.key}`} noStyle>
                      <Select
                        style={{ width: '100%' }}
                        options={[
                          {
                            value: 'random_role',
                            label: t('app.kuaizhizao.flowDataGenerate.operatorMode.random_role'),
                          },
                          {
                            value: 'random_department',
                            label: t(
                              'app.kuaizhizao.flowDataGenerate.operatorMode.random_department',
                            ),
                          },
                          {
                            value: 'random_team',
                            label: t('app.kuaizhizao.flowDataGenerate.operatorMode.random_team'),
                          },
                          {
                            value: 'operation_assigned',
                            label: t(
                              'app.kuaizhizao.flowDataGenerate.operatorMode.operation_assigned',
                            ),
                          },
                          {
                            value: 'fixed',
                            label: t('app.kuaizhizao.flowDataGenerate.operatorMode.fixed'),
                          },
                          {
                            value: 'current',
                            label: t('app.kuaizhizao.flowDataGenerate.operatorMode.current'),
                          },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={13}>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) =>
                        prev[`op_mode_${s.key}`] !== cur[`op_mode_${s.key}`]
                      }
                    >
                      {() => {
                        const mode = form.getFieldValue(`op_mode_${s.key}`) as StepOperatorMode;
                        if (mode === 'fixed') {
                          return (
                            <UniUserIdSelect
                              name={`op_user_${s.key}`}
                              label=""
                              required
                              placeholder={t(
                                'app.kuaizhizao.flowDataGenerate.operatorUserPlaceholder',
                              )}
                            />
                          );
                        }
                        if (mode === 'current') {
                          return (
                            <Typography.Text type="secondary">
                              {t('app.kuaizhizao.flowDataGenerate.operatorCurrentHint')}
                            </Typography.Text>
                          );
                        }
                        if (mode === 'operation_assigned') {
                          return (
                            <Typography.Text type="secondary">
                              {t('app.kuaizhizao.flowDataGenerate.operatorOperationAssignedHint')}
                            </Typography.Text>
                          );
                        }
                        if (mode === 'random_department') {
                          return (
                            <Form.Item name={`op_dept_${s.key}`} noStyle>
                              <Select
                                showSearch
                                optionFilterProp="label"
                                loading={departmentsQuery.isLoading}
                                style={{ width: '100%' }}
                                placeholder={t(
                                  'app.kuaizhizao.flowDataGenerate.operatorDepartmentPlaceholder',
                                )}
                                options={departmentOptions}
                              />
                            </Form.Item>
                          );
                        }
                        if (mode === 'random_team') {
                          return (
                            <Form.Item name={`op_team_${s.key}`} noStyle>
                              <Select
                                showSearch
                                optionFilterProp="label"
                                loading={workGroupsQuery.isLoading}
                                style={{ width: '100%' }}
                                placeholder={t(
                                  'app.kuaizhizao.flowDataGenerate.operatorTeamPlaceholder',
                                )}
                                options={workGroupOptions}
                              />
                            </Form.Item>
                          );
                        }
                        const defaults = defaultRoleByStep[s.key] || [];
                        return (
                          <Form.Item name={`op_role_${s.key}`} noStyle>
                            <Select
                              allowClear
                              showSearch
                              optionFilterProp="label"
                              loading={rolesQuery.isLoading || operatorDefaultsQuery.isLoading}
                              style={{ width: '100%' }}
                              placeholder={
                                defaults.length
                                  ? t('app.kuaizhizao.flowDataGenerate.operatorRoleDefaultHint', {
                                      roles: defaults.join(' / '),
                                    })
                                  : t('app.kuaizhizao.flowDataGenerate.operatorRolePlaceholder')
                              }
                              options={roleOptions}
                            />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  </Col>
                </Row>
              ))}

              <Space style={{ marginTop: 16 }}>
                <Button onClick={() => void handlePreview()} loading={loadingPreview}>
                  {t('app.kuaizhizao.flowDataGenerate.preview')}
                </Button>
                <Button type="primary" onClick={() => void handleExecute()} loading={loadingExecute}>
                  {t('app.kuaizhizao.flowDataGenerate.execute')}
                </Button>
              </Space>
            </Form>
          </Card>

          {preview && (
            <Card
              size="small"
              style={{ marginTop: 16 }}
              title={t('app.kuaizhizao.flowDataGenerate.previewCard')}
            >
              <Typography.Paragraph>
                {t('app.kuaizhizao.flowDataGenerate.previewSummary', {
                  order: preview.order_code,
                  warehouse: preview.warehouse_name,
                })}
              </Typography.Paragraph>
              {(preview.warnings || []).map((w) => (
                <Alert key={w} type="warning" showIcon style={{ marginBottom: 8 }} title={w} />
              ))}
              <Table
                size="small"
                rowKey={(r) => `${r.step_key}-${r.issued_at}`}
                pagination={false}
                dataSource={preview.steps}
                columns={[
                  { title: t('app.kuaizhizao.flowDataGenerate.colLabel'), dataIndex: 'label' },
                  {
                    title: t('app.kuaizhizao.flowDataGenerate.colIssuedAt'),
                    dataIndex: 'issued_at',
                    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
                  },
                ]}
              />
            </Card>
          )}

          {result && (
            <Card
              size="small"
              style={{ marginTop: 16 }}
              title={
                result.success
                  ? t('app.kuaizhizao.flowDataGenerate.resultOk')
                  : t('app.kuaizhizao.flowDataGenerate.resultPartial')
              }
            >
              {(result.errors || []).map((e) => (
                <Alert key={e} type="error" showIcon style={{ marginBottom: 8 }} title={e} />
              ))}
              {(result.outsource_notes || []).map((n) => (
                <Alert key={n} type="info" showIcon style={{ marginBottom: 8 }} title={n} />
              ))}
              {result.operators && Object.keys(result.operators).length > 0 && (
                <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                  {t('app.kuaizhizao.flowDataGenerate.operatorsResolved', {
                    detail: Object.entries(result.operators)
                      .map(
                        ([k, uid]) =>
                          `${t(`app.kuaizhizao.flowDataGenerate.step.${k}`, { defaultValue: k })}=#${uid}`,
                      )
                      .join(' · '),
                  })}
                </Typography.Paragraph>
              )}
              <Table
                size="small"
                rowKey={(r, idx) => `${r.doc_type || r.step_key}-${r.doc_id || idx}`}
                pagination={false}
                scroll={{ x: 960 }}
                dataSource={result.timeline?.length ? result.timeline : result.steps}
                columns={timelineColumns}
              />
            </Card>
          )}

          {!sourceDocQuery.isLoading && sourceDocQuery.isError && (
            <Alert
              style={{ marginTop: 16 }}
              type="error"
              showIcon
              title={getApiErrorMessage(
                sourceDocQuery.error,
                t('app.kuaizhizao.flowDataGenerate.previewFail'),
              )}
            />
          )}
          {!sourceDocQuery.isLoading &&
            !sourceDocQuery.isError &&
            (sourceDocQuery.data?.items?.length ?? 0) === 0 && (
            <Result
              style={{ marginTop: 24 }}
              status="info"
              title={
                sourceType === 'sales_forecast'
                  ? t('app.kuaizhizao.flowDataGenerate.emptyForecasts')
                  : t('app.kuaizhizao.flowDataGenerate.emptyOrders')
              }
            />
          )}
                </>
              ),
            },
            {
              key: 'equipment-ops',
              label: t('app.kuaizhizao.flowDataGenerate.tabEquipmentOps'),
              children: (
                <EquipmentOpsGeneratePanel
                  ready={ready}
                  selectedTenantId={selectedTenantId}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
