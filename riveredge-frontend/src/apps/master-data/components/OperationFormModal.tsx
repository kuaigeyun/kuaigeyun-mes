/**
 * 工序新建/编辑弹窗
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProFormInstance, ProFormSelect, ProFormDependency } from '@ant-design/pro-components';
import { App, Button, Space } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { operationApi, defectTypeApi } from '../services/process';
import {
  workshopApi,
  workCenterApi,
  workGroupApi,
  workstationApi,
  factoryListItems,
} from '../services/factory';
import { equipmentApi } from '../../kuaizhizao/services/equipment';
import { inspectionPlanApi } from '../../kuaizhizao/services/production';
import { useGlobalStore } from '../../../stores';
import { searchUserDisplay } from '../../../services/user';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Operation, OperationCreate, OperationUpdate, DefectTypeMinimal, DefectType } from '../types/process';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { operationFormSchema } from '../schemas/operation';
import { DefectTypeFormModal } from './DefectTypeFormModal';

const PAGE_CODE = 'master-data-process-operation';

/** 上线「质检模式」前的工序可能未存该字段或库中为 none；按绑定关系推断展示与编辑 */
function resolveInspectionModeForLegacyDetail(
  detail: Operation,
  boundDefectCount: number,
  planId: number | null | undefined
): 'none' | 'simple' | 'plan' {
  const dAny = detail as any;
  const raw = detail.inspectionMode ?? dAny.inspection_mode;
  const r = raw != null && raw !== '' ? String(raw).trim().toLowerCase() : '';
  let mode: 'none' | 'simple' | 'plan' =
    r === 'none' || r === 'simple' || r === 'plan' ? r : 'none';
  const pid = planId != null ? Number(planId) : NaN;
  const hasPlan = Number.isFinite(pid) && pid > 0;
  if (mode === 'none' && hasPlan) return 'plan';
  if (mode === 'none' && boundDefectCount > 0) return 'simple';
  return mode;
}

export interface OperationFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (operation: Operation) => void;
}

export const OperationFormModal: React.FC<OperationFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [defectTypeOptions, setDefectTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [workshopOptions, setWorkshopOptions] = useState<{ label: string; value: number }[]>([]);
  const [personnelOptions, setPersonnelOptions] = useState<{ label: string; value: string }[]>([]);
  const [resourceOptions, setResourceOptions] = useState<{ label: string; value: string }[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [inspectionPlanOptions, setInspectionPlanOptions] = useState<{ label: string; value: number }[]>([]);
  const [currentOperationId, setCurrentOperationId] = useState<number | null>(null);
  const [defectQuickAddOpen, setDefectQuickAddOpen] = useState(false);

  const isEdit = Boolean(editUuid);

  /** 合并列表接口与工序已绑定的不良品，避免「仅启用」列表不含已停用项时多选把值清空 */
  const buildDefectTypeOptions = (
    defects: Array<{ uuid?: string; code?: string; name?: string }>,
    bound?: DefectTypeMinimal[]
  ): { label: string; value: string }[] => {
    const byKey = new Map<string, { label: string; value: string }>();
    for (const d of defects) {
      const v = String(d.uuid ?? '').trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, { label: `${d.code ?? ''} ${d.name ?? ''}`.trim() || v, value: v });
      }
    }
    if (Array.isArray(bound)) {
      for (const d of bound) {
        const v = String((d as any).uuid ?? '').trim();
        if (!v) continue;
        const key = v.toLowerCase();
        if (!byKey.has(key)) {
          byKey.set(key, { label: `${d.code ?? ''} ${d.name ?? ''}`.trim() || v, value: v });
        }
      }
    }
    return [...byKey.values()];
  };

  const loadFormOptions = async (
    operationId?: number,
    boundDefectTypes?: DefectTypeMinimal[],
    fallbackInspectionPlan?: { id: number; label?: string }
  ) => {
    try {
      const [defectsRes, usersRes, teamsRes, workshopsRes, workCentersRes, stationsRes, equipmentRes, plansRes] = await Promise.all([
        // 不传 isActive：与列表/详情展示一致；再通过 boundDefectTypes 补齐未出现在列表中的绑定项
        defectTypeApi.list({ limit: 500 }),
        searchUserDisplay({ page: 1, page_size: 100, is_active: true }).catch(() => ({
          items: [],
          total: 0,
          page: 1,
          page_size: 100,
        })),
        workGroupApi.list({ is_active: true, limit: 500 }),
        workshopApi.list({ is_active: true, limit: 500 }),
        workCenterApi.list({ is_active: true, limit: 500 }),
        workstationApi.list({ is_active: true, limit: 500 }),
        equipmentApi.list({ is_active: true, limit: 500 }),
        inspectionPlanApi.list({ limit: 200, plan_type: 'process', operation_id: operationId, is_active: true }),
      ]);
      const defects = Array.isArray(defectsRes) ? defectsRes : (defectsRes?.data ?? []);
      const defectOpts = buildDefectTypeOptions(defects, boundDefectTypes);
      const workshopOpts = factoryListItems(workshopsRes as any).map((w: any) => ({
        label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
        value: w.id,
      }));

      const pOpts: { label: string; value: string }[] = [];
      (usersRes?.items ?? []).forEach((u) => {
        pOpts.push({ label: `[人员] ${u.full_name || u.username}`, value: `U_${u.uuid}` });
      });
      factoryListItems(teamsRes as any).forEach((t: any) => {
        pOpts.push({ label: `[小组] ${t.name}`, value: `T_${t.id}` });
      });

      const rOpts: { label: string; value: string }[] = [];
      factoryListItems(workCentersRes as any).forEach((wc: any) => {
        rOpts.push({ label: `[工作中心] ${wc.code || ''} ${wc.name || ''}`.trim(), value: `WC_${wc.id}` });
      });
      factoryListItems(stationsRes as any).forEach((s: any) => {
        rOpts.push({ label: `[工位] ${s.code || ''} ${s.name || ''}`.trim(), value: `S_${s.id}` });
      });
      const eqItems = equipmentRes?.items ?? (Array.isArray(equipmentRes) ? equipmentRes : []);
      const equipOpts = (Array.isArray(eqItems) ? eqItems : []).map((e: any) => ({
        label: `${e.code || ''} ${e.name || ''}`.trim() || String(e.id),
        value: e.id,
      }));
      const plans = Array.isArray(plansRes) ? plansRes : plansRes?.data ?? [];
      let planOpts = plans.map((p: any) => ({
        label: `${p.plan_code || p.planCode || ''} ${p.plan_name || p.planName || ''}`.trim() || String(p.id),
        value: p.id,
      }));
      if (
        fallbackInspectionPlan?.id != null &&
        !planOpts.some((o: { value: number }) => o.value === fallbackInspectionPlan.id)
      ) {
        planOpts = [
          ...planOpts,
          {
            label: fallbackInspectionPlan.label?.trim() || `质检方案 #${fallbackInspectionPlan.id}`,
            value: fallbackInspectionPlan.id,
          },
        ];
      }

      // 必须同步刷入 state：否则 await 返回后立刻 setFieldsValue 时 Select 仍持有空的 options，会丢弃已绑定值
      flushSync(() => {
        setDefectTypeOptions(defectOpts);
        setWorkshopOptions(workshopOpts);
        setPersonnelOptions(pOpts);
        setResourceOptions(rOpts);
        setEquipmentOptions(equipOpts);
        setInspectionPlanOptions(planOpts);
      });
      return { defectOptions: defectOpts };
    } catch (e) {
      console.warn('加载不良品项/用户/质检方案选项失败:', e);
      return { defectOptions: [] as { label: string; value: string }[] };
    }
  };

  const mapDefectUuidsToOptionValues = (uuids: string[], options: { value: string }[]): string[] => {
    const byLower = new Map(options.map((o) => [String(o.value).trim().toLowerCase(), o.value]));
    return uuids
      .map((u) => byLower.get(String(u).trim().toLowerCase()) ?? String(u).trim())
      .filter(Boolean);
  };

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    setCurrentOperationId(null);

    if (!editUuid) {
      formRef.current?.setFieldsValue({
        isActive: true,
        reportingType: 'quantity',
        overReportMode: 'none',
        overReportValue: 0,
        inspectionMode: 'simple',
      });
      loadFormOptions();

      let ruleCode: string | undefined;
      let autoGenerate = false;
      const initValues = {
        isActive: true,
        reportingType: 'quantity',
        overReportMode: 'none',
        overReportValue: 0,
      };
      (async () => {
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          ruleCode = pageConfig?.ruleCode;
          autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
        } catch {
          ruleCode = getPageRuleCode(PAGE_CODE);
          autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        }
        if (autoGenerate && ruleCode) {
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              const previewCodeValue = (res?.code ?? '').trim();
              setPreviewCode(previewCodeValue || null);
              formRef.current?.setFieldsValue({
                ...initValues,
                ...(previewCodeValue ? { code: previewCodeValue } : {}),
              });
              if (!previewCodeValue) {
                messageApi.info(t('app.master-data.codeRulePreviewHint'));
              }
            })
            .catch(() => {
              setPreviewCode(null);
              formRef.current?.setFieldsValue(initValues);
              messageApi.info(t('app.master-data.codeRuleAutoFailed'));
            });
        } else {
          setPreviewCode(null);
          formRef.current?.setFieldsValue(initValues);
        }
      })();
      return;
    }

    setPreviewCode(null);
    let cancelled = false;
    void (async () => {
      try {
        const detail = await operationApi.get(editUuid);
        if (cancelled) return;
        const dts = detail.defectTypes ?? detail.defect_types ?? [];
        const boundList = Array.isArray(dts) ? dts : [];
        const planId = detail.defaultInspectionPlanId ?? (detail as any).default_inspection_plan_id;
        const planName = detail.defaultInspectionPlanName ?? (detail as any).default_inspection_plan_name;
        const { defectOptions } = await loadFormOptions(
          detail.id,
          boundList,
          planId != null ? { id: Number(planId), label: planName ? String(planName) : undefined } : undefined
        );
        if (cancelled) return;
        setCurrentOperationId(detail.id);

        const rawDefectUuids = boundList
          .map((d: DefectTypeMinimal) => String((d as any).uuid ?? '').trim())
          .filter(Boolean);
        const defectTypeUuids = mapDefectUuidsToOptionValues(rawDefectUuids, defectOptions);
        const personnelConfigs: string[] = [];
        const ops = detail.defaultOperatorUuids ?? (detail as any).default_operator_uuids ?? [];
        if (Array.isArray(ops)) ops.forEach((u: string) => personnelConfigs.push(`U_${u}`));
        const teams = detail.defaultTeamIds ?? (detail as any).default_team_ids ?? [];
        if (Array.isArray(teams)) teams.forEach((t: number) => personnelConfigs.push(`T_${t}`));

        const resourceConfigs: string[] = [];
        const wcs = detail.defaultWorkCenterIds ?? (detail as any).default_work_center_ids ?? [];
        if (Array.isArray(wcs)) wcs.forEach((wc: number) => resourceConfigs.push(`WC_${wc}`));
        const stations = detail.defaultStationIds ?? (detail as any).default_station_ids ?? [];
        if (Array.isArray(stations)) stations.forEach((s: number) => resourceConfigs.push(`S_${s}`));

        const dAny = detail as any;
        const inspectionMode = resolveInspectionModeForLegacyDetail(detail, boundList.length, planId);
        const reportingType = (detail.reportingType ?? dAny.reporting_type ?? 'quantity') as 'quantity' | 'status';

        if (cancelled) return;
        // 禁止 ...detail 整包写入：API 可能带 inspection_mode、tenantId、时间戳等，易与 ProForm 字段存储冲突或触发异常合并
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          reportingType,
          overReportMode: detail.overReportMode ?? dAny.over_report_mode ?? 'none',
          overReportValue: Number(detail.overReportValue ?? dAny.over_report_value ?? 0) || 0,
          isActive: detail.isActive ?? dAny.is_active ?? true,
          inspectionMode,
          defaultInspectionPlanId: detail.defaultInspectionPlanId ?? dAny.default_inspection_plan_id ?? undefined,
          defectTypeUuids: defectTypeUuids.length ? defectTypeUuids : undefined,
          defaultPersonnelConfigs: personnelConfigs.length > 0 ? personnelConfigs : undefined,
          defaultResourceConfigs: resourceConfigs.length > 0 ? resourceConfigs : undefined,
          defaultWorkshopIds: detail.defaultWorkshopIds ?? dAny.default_workshop_ids ?? undefined,
          defaultEquipmentIds: detail.defaultEquipmentIds ?? dAny.default_equipment_ids ?? undefined,
        });
      } catch (err: any) {
        if (!cancelled) {
          messageApi.error(err?.message || t('app.master-data.operations.getDetailFailed'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const formValues = formRef.current?.getFieldsValue?.() ?? {};
      const defectTypeUuids = Array.isArray(formValues.defectTypeUuids) ? formValues.defectTypeUuids : (Array.isArray(values?.defectTypeUuids) ? values.defectTypeUuids : []);
      const personnelConfigs = (formValues.defaultPersonnelConfigs || values?.defaultPersonnelConfigs || []) as string[];
      const defaultOperatorUuids: string[] = [];
      const defaultTeamIds: number[] = [];
      personnelConfigs.forEach(val => {
        if (val.startsWith('U_')) defaultOperatorUuids.push(val.substring(2));
        else if (val.startsWith('T_')) defaultTeamIds.push(Number(val.substring(2)));
      });

      const resourceConfigs = (formValues.defaultResourceConfigs || values?.defaultResourceConfigs || []) as string[];
      const defaultWorkCenterIds: number[] = [];
      const defaultStationIds: number[] = [];
      resourceConfigs.forEach(val => {
        if (val.startsWith('WC_')) defaultWorkCenterIds.push(Number(val.substring(3)));
        else if (val.startsWith('S_')) defaultStationIds.push(Number(val.substring(2)));
      });

      const defaultWorkshopIds = Array.isArray(formValues.defaultWorkshopIds) ? formValues.defaultWorkshopIds : (Array.isArray(values?.defaultWorkshopIds) ? values.defaultWorkshopIds : []);
      const defaultEquipmentIds = Array.isArray(formValues.defaultEquipmentIds) ? formValues.defaultEquipmentIds : (Array.isArray(values?.defaultEquipmentIds) ? values.defaultEquipmentIds : []);
      
      const inspectionMode = formValues.inspectionMode ?? values?.inspectionMode ?? 'none';
      const defaultInspectionPlanId = formValues.defaultInspectionPlanId ?? values?.defaultInspectionPlanId;
      const inspectionPayload =
        inspectionMode === 'plan'
          ? { inspectionMode, defaultInspectionPlanId: defaultInspectionPlanId || null }
          : { inspectionMode, defaultInspectionPlanId: null };

      if (isEdit && editUuid) {
        const updatePayload: OperationUpdate = {
          ...formValues,
          ...values,
          defectTypeUuids,
          defaultOperatorUuids,
          defaultTeamIds,
          defaultWorkshopIds,
          defaultWorkCenterIds,
          defaultStationIds,
          defaultEquipmentIds,
          ...inspectionPayload,
          allowJump: false,
          isNodeOperation: false,
        };
        await operationApi.update(editUuid, updatePayload);
        messageApi.success(t('common.updateSuccess'));
        const updated = await operationApi.get(editUuid);
        onSuccess(updated);
      } else {
        let ruleCode: string | undefined;
        let autoGenerate = false;
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          ruleCode = pageConfig?.ruleCode;
          autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
        } catch {
          ruleCode = getPageRuleCode(PAGE_CODE);
          autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        }
        if (autoGenerate && ruleCode) {
          const currentCode = values.code?.trim?.() ?? '';
          const useAutoCode = !currentCode || currentCode === previewCode;
          if (useAutoCode) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.code = codeResponse.code;
            } catch {
              if (previewCode) values.code = previewCode;
            }
          }
        }
        if (!values.code?.trim?.()) {
          messageApi.error(t('app.master-data.operations.codeRequired'));
          return;
        }
        const createPayload: OperationCreate = {
          ...formValues,
          ...values,
          defectTypeUuids,
          defaultOperatorUuids,
          defaultTeamIds,
          defaultWorkshopIds,
          defaultWorkCenterIds,
          defaultEquipmentIds,
          ...inspectionPayload,
          allowJump: false,
          isNodeOperation: false,
        };
        const created = await operationApi.create(createPayload);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    setDefectQuickAddOpen(false);
    onClose();
    formRef.current?.resetFields();
    setPreviewCode(null);
    setCurrentOperationId(null);
  };

  const optionsMap: Record<string, Array<{ value: any; label: string }>> = {
    defectTypeUuids: defectTypeOptions,
    defaultPersonnelConfigs: personnelOptions,
    defaultWorkshopIds: workshopOptions,
    defaultResourceConfigs: resourceOptions,
    defaultEquipmentIds: equipmentOptions,
    defaultInspectionPlanId: inspectionPlanOptions,
  };

  const handleGotoInspectionPlans = () => {
    const opId = currentOperationId;
    navigate(`/apps/kuaizhizao/quality-management/inspection-plans${opId ? `?operationId=${opId}` : ''}`);
  };

  /** 嵌套新建不良品类型成功后刷新下拉选项并勾选新项目 */
  const handleDefectTypeQuickCreated = async (created: DefectType) => {
    const selected = (formRef.current?.getFieldValue('defectTypeUuids') as string[] | undefined) ?? [];
    const boundMinimal = selected.map((uuid) => ({ uuid }));
    await loadFormOptions(currentOperationId ?? undefined, boundMinimal);
    const newUuid = String(created.uuid ?? '').trim();
    if (newUuid) {
      const next = [...new Set([...selected.map((u) => String(u).trim()).filter(Boolean), newUuid])];
      formRef.current?.setFieldsValue({ defectTypeUuids: next });
    }
  };

  const formInitialValues = useMemo(
    () => ({ isActive: true, reportingType: 'quantity' as const, inspectionMode: 'simple' as const }),
    []
  );
  /** 编辑时勿带默认 inspectionMode，否则与详情异步回填竞态时易被 ProForm/initialValues 拉回 simple */
  const editFormInitialValues = useMemo(() => ({}), []);

  return (
    <>
    <FormModalTemplate
      key={isEdit && editUuid ? `operation-edit-${editUuid}` : 'operation-create'}
      title={isEdit ? t('field.operation.editTitle') : t('field.operation.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={isEdit ? editFormInitialValues : formInitialValues}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer
        schema={operationFormSchema}
        slots={{
          inspectionBlock: (
            <>
              <ProFormSelect
                name="inspectionMode"
                label={t('field.operation.inspectionMode')}
                placeholder={t('field.operation.inspectionModePlaceholder')}
                colProps={{ span: 12 }}
                options={[
                  { label: t('field.operation.inspectionModeNone'), value: 'none' },
                  { label: t('field.operation.inspectionModeSimple'), value: 'simple' },
                  { label: t('field.operation.inspectionModePlan'), value: 'plan' },
                ]}
              />
              <ProFormDependency name={['inspectionMode']}>
                {({ inspectionMode }) => {
                  const mode = (inspectionMode ?? 'simple') as string;
                  return (
                    <>
                      {mode === 'plan' && (
                        <ProFormSelect
                          name="defaultInspectionPlanId"
                          label={
                            <Space size="small">
                              <span>{t('field.operation.defaultInspectionPlan')}</span>
                              <Button type="link" size="small" onClick={handleGotoInspectionPlans}>
                                {t('field.operation.gotoInspectionPlans')}
                              </Button>
                            </Space>
                          }
                          placeholder={t('field.operation.defaultInspectionPlanPlaceholder')}
                          colProps={{ span: 24 }}
                          options={inspectionPlanOptions}
                          fieldProps={{ allowClear: true }}
                          formItemProps={{ preserve: true }}
                        />
                      )}
                      {mode === 'simple' && (
                        <ProFormSelect
                          name="defectTypeUuids"
                          label={
                            <Space size="small">
                              <span>{t('field.operation.defectTypeUuids')}</span>
                              <Button type="link" size="small" onClick={() => setDefectQuickAddOpen(true)}>
                                {t('field.operation.quickAddDefectType')}
                              </Button>
                            </Space>
                          }
                          placeholder={t('field.operation.defectTypeUuidsPlaceholder')}
                          colProps={{ span: 24 }}
                          mode="multiple"
                          options={defectTypeOptions}
                          fieldProps={{ allowClear: true }}
                          extra={t('field.operation.defectTypeUuidsSimpleHint')}
                          formItemProps={{ preserve: true }}
                        />
                      )}
                    </>
                  );
                }}
              </ProFormDependency>
            </>
          ),
        }}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.operation.codeAutoGenerated"
        isEdit={isEdit}
        allowEditCodeWhenEdit={true}
        optionsMap={optionsMap}
      />
    </FormModalTemplate>

    <DefectTypeFormModal
      open={defectQuickAddOpen}
      onClose={() => setDefectQuickAddOpen(false)}
      editUuid={null}
      onSuccess={handleDefectTypeQuickCreated}
    />
    </>
  );
};
