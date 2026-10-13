/**
 * 设备点检 / 保养执行造数面板（按点检计划 / 保养计划）
 */

import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Row,
  Select,
  Space,
  Switch,
  Table,
  TimePicker,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UniImportToolbarButton } from '../../../../../components/uni-import/UniImportToolbarButton';
import { UniUserIdSelect } from '../../../../../components/uni-user-id-select';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getDepartmentTree, type DepartmentTreeItem } from '../../../../../services/department';
import { getRoleList } from '../../../../../services/role';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { workGroupApi } from '../../../../master-data/services/factory';
import { maintenancePlanApi, spotCheckPlanApi } from '../../../services/equipment';
import {
  executeEquipmentOpsGenerate,
  previewEquipmentOpsGenerate,
  type EquipmentOpsCreatedDoc,
  type EquipmentOpsExecuteResult,
  type EquipmentOpsGeneratePayload,
  type EquipmentOpsOperatorMode,
  type EquipmentOpsOperatorPayload,
  type EquipmentOpsPreviewResult,
} from '../../../services/equipment-ops-data-generate';
import {
  buildSpotCheckImportTemplate,
  runSpotCheckExcelImport,
} from '../../equipment-management/spot-checks/spotCheckExcelImport';

const LazyUniImport = lazy(() => import('../../../../../components/uni-import'));
const SPOT_CHECK_RESOURCE = 'kuaizhizao:equipment-spot-check';

const WEEKDAY_OPTIONS = [
  { value: 0, labelKey: 'monday' },
  { value: 1, labelKey: 'tuesday' },
  { value: 2, labelKey: 'wednesday' },
  { value: 3, labelKey: 'thursday' },
  { value: 4, labelKey: 'friday' },
  { value: 5, labelKey: 'saturday' },
  { value: 6, labelKey: 'sunday' },
] as const;

const OPERATOR_KEYS = ['inspector', 'approver'] as const;

const OPERATOR_MODE_VALUES: EquipmentOpsOperatorMode[] = [
  'equipment_assigned',
  'scheme_assigned',
  'random_role',
  'random_department',
  'random_team',
  'fixed',
  'current',
];

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

function listItems(res: unknown): any[] {
  if (Array.isArray(res)) return res;
  const anyRes = res as { items?: unknown; data?: unknown };
  if (Array.isArray(anyRes?.items)) return anyRes.items;
  if (Array.isArray(anyRes?.data)) return anyRes.data;
  return [];
}

export interface EquipmentOpsGeneratePanelProps {
  ready: boolean;
  selectedTenantId?: number;
}

export default function EquipmentOpsGeneratePanel({
  ready,
  selectedTenantId,
}: EquipmentOpsGeneratePanelProps) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const spotCheckPerms = useResourcePermissions(SPOT_CHECK_RESOURCE);
  const [form] = Form.useForm();
  const [preview, setPreview] = useState<EquipmentOpsPreviewResult | null>(null);
  const [result, setResult] = useState<EquipmentOpsExecuteResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const useWorkSchedule = Form.useWatch('use_work_schedule', form);
  const selectedSpotPlanIds = Form.useWatch('spot_check_plan_ids', form) as number[] | undefined;
  const selectedMaintPlanIds = Form.useWatch('maintenance_plan_ids', form) as
    | number[]
    | undefined;
  const spotCheckImportTemplate = useMemo(() => buildSpotCheckImportTemplate(t), [t]);

  const spotPlansQuery = useQuery({
    queryKey: ['kuaizhizao', 'equipment-ops-generate', 'spot-check-plans', selectedTenantId],
    queryFn: async () => listItems(await spotCheckPlanApi.list({ skip: 0, limit: 200 })),
    enabled: ready,
    retry: 1,
  });

  const maintPlansQuery = useQuery({
    queryKey: ['kuaizhizao', 'equipment-ops-generate', 'maintenance-plans', selectedTenantId],
    queryFn: async () => listItems(await maintenancePlanApi.list({ skip: 0, limit: 200 })),
    enabled: ready,
    retry: 1,
  });

  const rolesQuery = useQuery({
    queryKey: ['core', 'roles', 'equipment-ops-generate', selectedTenantId],
    queryFn: async () => {
      const res = await getRoleList({ page: 1, page_size: 100, is_active: true });
      return res.items || [];
    },
    enabled: ready,
    retry: 1,
  });

  const departmentsQuery = useQuery({
    queryKey: ['core', 'departments', 'equipment-ops-generate', selectedTenantId],
    queryFn: async () => {
      const res = await getDepartmentTree({ is_active: true });
      return res.items || [];
    },
    enabled: ready,
    retry: 1,
  });

  const workGroupsQuery = useQuery({
    queryKey: ['master-data', 'work-groups', 'equipment-ops-generate', selectedTenantId],
    queryFn: async () => {
      const res = await workGroupApi.list({ skip: 0, limit: 200, is_active: true });
      return res?.items || [];
    },
    enabled: ready,
    retry: 1,
  });

  const spotPlanOptions = useMemo(
    () =>
      (spotPlansQuery.data || []).map((p: any) => ({
        value: Number(p.id),
        label: `${p.plan_no || p.id} ${p.plan_name || ''}`.trim(),
      })),
    [spotPlansQuery.data],
  );

  const maintPlanOptions = useMemo(
    () =>
      (maintPlansQuery.data || []).map((p: any) => ({
        value: Number(p.id),
        label: `${p.plan_no || p.id} ${p.plan_name || ''}`.trim(),
      })),
    [maintPlansQuery.data],
  );

  const planBoundEquipmentOptions = useMemo(() => {
    const spotIdSet = new Set(
      (selectedSpotPlanIds || []).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0),
    );
    const maintIdSet = new Set(
      (selectedMaintPlanIds || [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
    const byId = new Map<number, string>();
    const pushItems = (items: unknown) => {
      if (!Array.isArray(items)) return;
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const id = Number((it as { id?: unknown }).id);
        if (!(Number.isFinite(id) && id > 0)) continue;
        const code = String((it as { code?: unknown }).code || '').trim();
        const name = String((it as { name?: unknown }).name || '').trim();
        const label = `${code || id} ${name}`.trim();
        if (!byId.has(id)) byId.set(id, label);
      }
    };
    for (const p of spotPlansQuery.data || []) {
      if (!spotIdSet.has(Number(p.id))) continue;
      pushItems(p.equipment_items);
      if (!Array.isArray(p.equipment_items) || p.equipment_items.length === 0) {
        const eid = Number(p.equipment_id);
        if (Number.isFinite(eid) && eid > 0) {
          pushItems([
            {
              id: eid,
              code: p.equipment_code || p.equipment_uuid,
              name: p.equipment_name,
            },
          ]);
        }
      }
    }
    for (const p of maintPlansQuery.data || []) {
      if (!maintIdSet.has(Number(p.id))) continue;
      pushItems(p.equipment_items);
      if (!Array.isArray(p.equipment_items) || p.equipment_items.length === 0) {
        const eid = Number(p.equipment_id);
        if (Number.isFinite(eid) && eid > 0) {
          pushItems([
            {
              id: eid,
              code: p.equipment_code || p.equipment_uuid,
              name: p.equipment_name,
            },
          ]);
        }
      }
    }
    return Array.from(byId.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([value, label]) => ({ value, label }));
  }, [
    selectedSpotPlanIds,
    selectedMaintPlanIds,
    spotPlansQuery.data,
    maintPlansQuery.data,
  ]);

  const planBoundEquipmentIds = useMemo(
    () => planBoundEquipmentOptions.map((o) => o.value),
    [planBoundEquipmentOptions],
  );

  React.useEffect(() => {
    const allowed = new Set(planBoundEquipmentIds);
    const current = (form.getFieldValue('equipment_ids') as number[] | undefined) || [];
    const next = current.filter((id) => allowed.has(Number(id)));
    if (next.length !== current.length) {
      form.setFieldsValue({ equipment_ids: next });
    }
  }, [planBoundEquipmentIds, form]);

  const roleOptions = useMemo(
    () =>
      (rolesQuery.data || []).map((r) => ({
        value: r.code,
        label: `${r.name}${r.code ? ` (${r.code})` : ''}`,
      })),
    [rolesQuery.data],
  );

  const departmentOptions = useMemo(
    () => flattenDepartmentOptions(departmentsQuery.data || []),
    [departmentsQuery.data],
  );

  const workGroupOptions = useMemo(
    () =>
      (workGroupsQuery.data || []).map((g: any) => ({
        value: Number(g.id),
        label: `${g.name || g.code || g.id}${g.code ? ` (${g.code})` : ''}`,
      })),
    [workGroupsQuery.data],
  );

  const weekdayOptions = useMemo(
    () =>
      WEEKDAY_OPTIONS.map((d) => ({
        value: d.value,
        label: t(`app.kuaizhizao.equipmentOpsGenerate.weekday.${d.labelKey}`),
      })),
    [t],
  );

  const buildOperatorPayload = (
    values: Record<string, unknown>,
    key: (typeof OPERATOR_KEYS)[number],
    defaultMode: EquipmentOpsOperatorMode,
  ): EquipmentOpsOperatorPayload => {
    const rawMode = String(values[`op_mode_${key}`] || defaultMode) as EquipmentOpsOperatorMode;
    const mode: EquipmentOpsOperatorMode = OPERATOR_MODE_VALUES.includes(rawMode)
      ? rawMode
      : defaultMode;
    const userId = Number(values[`op_user_${key}`]);
    const deptId = Number(values[`op_dept_${key}`]);
    const teamId = Number(values[`op_team_${key}`]);
    const roleCode = String(values[`op_role_${key}`] || '').trim();
    if (mode === 'fixed' && !(Number.isFinite(userId) && userId > 0)) {
      throw new Error(t('app.kuaizhizao.equipmentOpsGenerate.operatorUserRequired'));
    }
    if (mode === 'random_department' && !(Number.isFinite(deptId) && deptId > 0)) {
      throw new Error(t('app.kuaizhizao.equipmentOpsGenerate.operatorDepartmentRequired'));
    }
    if (mode === 'random_team' && !(Number.isFinite(teamId) && teamId > 0)) {
      throw new Error(t('app.kuaizhizao.equipmentOpsGenerate.operatorTeamRequired'));
    }
    return {
      mode,
      user_id: mode === 'fixed' && Number.isFinite(userId) && userId > 0 ? userId : null,
      role_code: mode === 'random_role' && roleCode ? roleCode : null,
      department_id:
        mode === 'random_department' && Number.isFinite(deptId) && deptId > 0 ? deptId : null,
      work_group_id:
        mode === 'random_team' && Number.isFinite(teamId) && teamId > 0 ? teamId : null,
    };
  };

  const buildPayload = async (): Promise<EquipmentOpsGeneratePayload> => {
    const values = await form.validateFields();
    const spotIds = (Array.isArray(values.spot_check_plan_ids) ? values.spot_check_plan_ids : [])
      .map((x: unknown) => Number(x))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const maintIds = (
      Array.isArray(values.maintenance_plan_ids) ? values.maintenance_plan_ids : []
    )
      .map((x: unknown) => Number(x))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (spotIds.length === 0 && maintIds.length === 0) {
      throw new Error(t('app.kuaizhizao.equipmentOpsGenerate.plansRequired'));
    }
    const equipmentIds = (Array.isArray(values.equipment_ids) ? values.equipment_ids : [])
      .map((x: unknown) => Number(x))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (equipmentIds.length === 0) {
      throw new Error(t('app.kuaizhizao.equipmentOpsGenerate.equipmentRequired'));
    }
    const range = values.anchor_range as [Dayjs, Dayjs] | undefined;
    if (!range?.[0] || !range?.[1]) {
      throw new Error(t('app.kuaizhizao.equipmentOpsGenerate.anchorRangeRequired'));
    }
    if (range[1].isBefore(range[0], 'day')) {
      throw new Error(t('app.kuaizhizao.equipmentOpsGenerate.anchorRangeInvalid'));
    }
    const weekdays: number[] = Array.isArray(values.weekdays) ? values.weekdays : [0, 1, 2, 3, 4];
    return {
      spot_check_plan_ids: spotIds,
      maintenance_plan_ids: maintIds,
      equipment_ids: equipmentIds,
      anchor_start: range[0].startOf('day').toISOString(),
      anchor_end: range[1].endOf('day').toISOString(),
      use_work_schedule: Boolean(values.use_work_schedule),
      work_schedule: values.use_work_schedule
        ? {
            weekdays,
            start_time: dayjs.isDayjs(values.start_time)
              ? values.start_time.format('HH:mm:ss')
              : String(values.start_time || '09:00:00'),
            end_time: dayjs.isDayjs(values.end_time)
              ? values.end_time.format('HH:mm:ss')
              : String(values.end_time || '18:00:00'),
            lookback_days: 30,
          }
        : null,
      auto_approve_spot_check: Boolean(values.auto_approve_spot_check),
      inspector_operator: buildOperatorPayload(values, 'inspector', 'equipment_assigned'),
      approver_operator: buildOperatorPayload(values, 'approver', 'scheme_assigned'),
    };
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    setResult(null);
    try {
      const payload = await buildPayload();
      const data = await previewEquipmentOpsGenerate(payload);
      setPreview(data);
      message.success(t('app.kuaizhizao.equipmentOpsGenerate.previewOk'));
    } catch (e) {
      message.error(getApiErrorMessage(e, t('app.kuaizhizao.equipmentOpsGenerate.previewFail')));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecute = async () => {
    modal.confirm({
      title: t('app.kuaizhizao.equipmentOpsGenerate.confirmTitle'),
      content: t('app.kuaizhizao.equipmentOpsGenerate.confirmContent'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setLoadingExecute(true);
        setResult(null);
        try {
          const payload = await buildPayload();
          const data = await executeEquipmentOpsGenerate(payload);
          setResult(data);
          if (data.success) {
            message.success(t('app.kuaizhizao.equipmentOpsGenerate.executeOk'));
          } else {
            message.warning(t('app.kuaizhizao.equipmentOpsGenerate.executePartial'));
          }
        } catch (e) {
          message.error(getApiErrorMessage(e, t('app.kuaizhizao.equipmentOpsGenerate.executeFail')));
        } finally {
          setLoadingExecute(false);
        }
      },
    });
  };

  const resultColumns: ColumnsType<EquipmentOpsCreatedDoc> = [
    {
      title: t('app.kuaizhizao.equipmentOpsGenerate.colDocType'),
      dataIndex: 'doc_type',
      width: 140,
      render: (v) =>
        v === 'spot_check'
          ? t('app.kuaizhizao.equipmentOpsGenerate.docType.spot_check')
          : t('app.kuaizhizao.equipmentOpsGenerate.docType.maintenance_execution'),
    },
    {
      title: t('app.kuaizhizao.equipmentOpsGenerate.colDocCode'),
      dataIndex: 'doc_code',
      width: 160,
    },
    {
      title: t('app.kuaizhizao.equipmentOpsGenerate.colPlan'),
      dataIndex: 'plan_no',
      width: 140,
    },
    {
      title: t('app.kuaizhizao.equipmentOpsGenerate.colEquipment'),
      dataIndex: 'equipment_code',
      width: 140,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
    },
  ];

  if (!ready) {
    return null;
  }

  return (
    <>
      <Card size="small" title={t('app.kuaizhizao.equipmentOpsGenerate.configCard')}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('app.kuaizhizao.equipmentOpsGenerate.configHint')}
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            spot_check_plan_ids: [],
            maintenance_plan_ids: [],
            equipment_ids: [],
            use_work_schedule: true,
            weekdays: [0, 1, 2, 3, 4],
            start_time: dayjs('09:00:00', 'HH:mm:ss'),
            end_time: dayjs('18:00:00', 'HH:mm:ss'),
            auto_approve_spot_check: false,
            anchor_range: [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')],
            op_mode_inspector: 'equipment_assigned',
            op_mode_approver: 'scheme_assigned',
          }}
        >
          <Form.Item
            name="spot_check_plan_ids"
            label={t('app.kuaizhizao.equipmentOpsGenerate.spotCheckPlans')}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={spotPlansQuery.isLoading}
              placeholder={t('app.kuaizhizao.equipmentOpsGenerate.spotCheckPlansPlaceholder')}
              options={spotPlanOptions}
              style={{ maxWidth: 720 }}
            />
          </Form.Item>
          <Form.Item
            name="maintenance_plan_ids"
            label={t('app.kuaizhizao.equipmentOpsGenerate.maintenancePlans')}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={maintPlansQuery.isLoading}
              placeholder={t('app.kuaizhizao.equipmentOpsGenerate.maintenancePlansPlaceholder')}
              options={maintPlanOptions}
              style={{ maxWidth: 720 }}
            />
          </Form.Item>
          <Form.Item
            label={t('app.kuaizhizao.equipmentOpsGenerate.equipment')}
            required
            extra={t('app.kuaizhizao.equipmentOpsGenerate.equipmentFromPlansHint')}
          >
            <Space orientation="vertical" style={{ width: '100%', maxWidth: 720 }}>
              <Space wrap>
                <Button
                  size="small"
                  disabled={planBoundEquipmentIds.length === 0}
                  onClick={() => form.setFieldsValue({ equipment_ids: planBoundEquipmentIds })}
                >
                  {t('app.kuaizhizao.equipmentOpsGenerate.selectAllEquipment')}
                </Button>
                <Button
                  size="small"
                  disabled={planBoundEquipmentIds.length === 0}
                  onClick={() => form.setFieldsValue({ equipment_ids: [] })}
                >
                  {t('app.kuaizhizao.equipmentOpsGenerate.clearEquipment')}
                </Button>
                <Typography.Text type="secondary">
                  {t('app.kuaizhizao.equipmentOpsGenerate.equipmentBoundCount', {
                    count: planBoundEquipmentIds.length,
                  })}
                </Typography.Text>
              </Space>
              <Form.Item
                name="equipment_ids"
                noStyle
                rules={[
                  {
                    required: true,
                    type: 'array',
                    min: 1,
                    message: t('app.kuaizhizao.equipmentOpsGenerate.equipmentRequired'),
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={planBoundEquipmentIds.length === 0}
                  placeholder={t('app.kuaizhizao.equipmentOpsGenerate.equipmentPlaceholder')}
                  options={planBoundEquipmentOptions}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Space>
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="auto_approve_spot_check"
                label={t('app.kuaizhizao.equipmentOpsGenerate.autoApprove')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item
                name="anchor_range"
                label={t('app.kuaizhizao.equipmentOpsGenerate.anchorRange')}
                rules={[
                  {
                    required: true,
                    message: t('app.kuaizhizao.equipmentOpsGenerate.anchorRangeRequired'),
                  },
                ]}
              >
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="use_work_schedule"
            label={t('app.kuaizhizao.equipmentOpsGenerate.useWorkSchedule')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          {useWorkSchedule ? (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="weekdays"
                  label={t('app.kuaizhizao.equipmentOpsGenerate.weekdays')}
                  rules={[{ required: true }]}
                >
                  <Select mode="multiple" options={weekdayOptions} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item
                  name="start_time"
                  label={t('app.kuaizhizao.equipmentOpsGenerate.startTime')}
                  rules={[{ required: true }]}
                >
                  <TimePicker format="HH:mm:ss" needConfirm={false} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item
                  name="end_time"
                  label={t('app.kuaizhizao.equipmentOpsGenerate.endTime')}
                  rules={[{ required: true }]}
                >
                  <TimePicker format="HH:mm:ss" needConfirm={false} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          ) : null}

          <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
            {t('app.kuaizhizao.equipmentOpsGenerate.operatorCard')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {t('app.kuaizhizao.equipmentOpsGenerate.operatorHint')}
          </Typography.Paragraph>
          {OPERATOR_KEYS.map((key) => {
            const assignedMode = key === 'inspector' ? 'equipment_assigned' : 'scheme_assigned';
            const modeOptions: EquipmentOpsOperatorMode[] =
              key === 'inspector'
                ? [
                    'equipment_assigned',
                    'random_role',
                    'random_department',
                    'random_team',
                    'fixed',
                    'current',
                  ]
                : [
                    'scheme_assigned',
                    'random_role',
                    'random_department',
                    'random_team',
                    'fixed',
                    'current',
                  ];
            return (
              <Row gutter={12} key={`op-${key}`} align="middle" style={{ marginBottom: 12 }}>
                <Col xs={24} md={5}>
                  <Typography.Text>
                    {t(`app.kuaizhizao.equipmentOpsGenerate.operator.${key}`)}
                  </Typography.Text>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name={`op_mode_${key}`} noStyle>
                    <Select
                      style={{ width: '100%' }}
                      options={modeOptions.map((m) => ({
                        value: m,
                        label: t(`app.kuaizhizao.equipmentOpsGenerate.operatorMode.${m}`),
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={13}>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) => prev[`op_mode_${key}`] !== cur[`op_mode_${key}`]}
                  >
                    {() => {
                      const mode = form.getFieldValue(`op_mode_${key}`) as EquipmentOpsOperatorMode;
                      if (mode === 'fixed') {
                        return (
                          <UniUserIdSelect
                            name={`op_user_${key}`}
                            label=""
                            required
                            placeholder={t(
                              'app.kuaizhizao.equipmentOpsGenerate.operatorUserPlaceholder',
                            )}
                          />
                        );
                      }
                      if (mode === 'current') {
                        return (
                          <Typography.Text type="secondary">
                            {t('app.kuaizhizao.equipmentOpsGenerate.operatorCurrentHint')}
                          </Typography.Text>
                        );
                      }
                      if (mode === assignedMode) {
                        return (
                          <Typography.Text type="secondary">
                            {t(
                              `app.kuaizhizao.equipmentOpsGenerate.operatorAssignedHint.${key}`,
                            )}
                          </Typography.Text>
                        );
                      }
                      if (mode === 'random_department') {
                        return (
                          <Form.Item name={`op_dept_${key}`} noStyle>
                            <Select
                              showSearch
                              optionFilterProp="label"
                              loading={departmentsQuery.isLoading}
                              style={{ width: '100%' }}
                              placeholder={t(
                                'app.kuaizhizao.equipmentOpsGenerate.operatorDepartmentPlaceholder',
                              )}
                              options={departmentOptions}
                            />
                          </Form.Item>
                        );
                      }
                      if (mode === 'random_team') {
                        return (
                          <Form.Item name={`op_team_${key}`} noStyle>
                            <Select
                              showSearch
                              optionFilterProp="label"
                              loading={workGroupsQuery.isLoading}
                              style={{ width: '100%' }}
                              placeholder={t(
                                'app.kuaizhizao.equipmentOpsGenerate.operatorTeamPlaceholder',
                              )}
                              options={workGroupOptions}
                            />
                          </Form.Item>
                        );
                      }
                      if (mode === 'random_role') {
                        return (
                          <Form.Item name={`op_role_${key}`} noStyle>
                            <Select
                              allowClear
                              showSearch
                              optionFilterProp="label"
                              loading={rolesQuery.isLoading}
                              style={{ width: '100%' }}
                              placeholder={t(
                                'app.kuaizhizao.equipmentOpsGenerate.operatorRolePlaceholder',
                              )}
                              options={roleOptions}
                            />
                          </Form.Item>
                        );
                      }
                      return null;
                    }}
                  </Form.Item>
                </Col>
              </Row>
            );
          })}

          <Space style={{ marginTop: 8 }}>
            <Button onClick={() => void handlePreview()} loading={loadingPreview}>
              {t('app.kuaizhizao.flowDataGenerate.preview')}
            </Button>
            <Button type="primary" onClick={() => void handleExecute()} loading={loadingExecute}>
              {t('app.kuaizhizao.flowDataGenerate.execute')}
            </Button>
          </Space>
        </Form>
      </Card>

      {spotCheckPerms.canImport ? (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={t('app.kuaizhizao.equipmentOpsGenerate.importCard')}
        >
          <Typography.Paragraph type="secondary">
            {t('app.kuaizhizao.equipmentOpsGenerate.importHint')}
          </Typography.Paragraph>
          <UniImportToolbarButton onOpen={() => setImportModalVisible(true)} />
          {importModalVisible ? (
            <Suspense fallback={null}>
              <LazyUniImport
                visible={importModalVisible}
                onCancel={() => setImportModalVisible(false)}
                onConfirm={async (data) => {
                  await runSpotCheckExcelImport({
                    data,
                    t,
                    messageApi: message,
                  });
                  setImportModalVisible(false);
                  return undefined;
                }}
                headers={spotCheckImportTemplate.importHeaders}
                exampleRow={spotCheckImportTemplate.importExampleRow}
                columnOptions={spotCheckImportTemplate.importColumnOptions}
                importFieldMap={spotCheckImportTemplate.importHeaderMap}
                enableXlsxTemplate
                enableMappingImport
                enableImportPreview
                templateDocumentName={t('app.kuaizhizao.equipmentOpsGenerate.importTemplateName')}
              />
            </Suspense>
          ) : null}
        </Card>
      ) : null}

      {preview && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={t('app.kuaizhizao.equipmentOpsGenerate.previewCard')}
        >
          <Typography.Paragraph>
            {t('app.kuaizhizao.equipmentOpsGenerate.previewSummary', {
              equipment: preview.equipment_count,
              spotPlans: preview.spot_check_plan_count ?? 0,
              spotTargets: preview.spot_check_targets,
              spotDocs: preview.spot_check_docs,
              maintPlans: preview.maintenance_plan_count ?? 0,
              maintTargets: preview.maintenance_targets,
              maintDocs: preview.maintenance_docs,
            })}
          </Typography.Paragraph>
          {(preview.notes || []).length > 0 && (
            <Typography.Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
              {(preview.notes || []).slice(0, 20).join('\n')}
              {(preview.notes || []).length > 20
                ? `\n… (+${(preview.notes || []).length - 20})`
                : ''}
            </Typography.Paragraph>
          )}
        </Card>
      )}

      {result && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={t('app.kuaizhizao.equipmentOpsGenerate.resultCard')}
        >
          <Typography.Paragraph>
            {t('app.kuaizhizao.equipmentOpsGenerate.resultSummary', {
              count: result.created_count,
              runId: result.run_id,
            })}
          </Typography.Paragraph>
          {(result.errors || []).length > 0 && (
            <Typography.Paragraph type="danger" style={{ whiteSpace: 'pre-wrap' }}>
              {(result.errors || []).join('\n')}
            </Typography.Paragraph>
          )}
          <Table
            size="small"
            rowKey={(r) => `${r.doc_type}-${r.doc_id}`}
            columns={resultColumns}
            dataSource={result.created || []}
            pagination={{ pageSize: 20 }}
          />
        </Card>
      )}
    </>
  );
}
