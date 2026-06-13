/**
 * 好力 GO — 设备维保完成单（维修/保养；关联设备维保单；对齐模具维保完修单交互）
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { rowActionKind } from '../../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import type { UploadProps } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import { App, Alert, Button, Col, Divider, Form, Input, Modal, Row, Space, Spin, Table, Tabs, Upload } from 'antd';
import HaoligoDocumentPrintModal from '../../../../components/HaoligoDocumentPrintModal';
import { HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_COMPLETE, HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET } from '../../../../constants/documentPermissionResources';
import { canPrintHaoligoDocument } from '../../../../utils/documentPrintPermission';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../../../../stores';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { uploadFile } from '../../../../../../services/file';
import { UniUserIdSelect } from '../../../../../../components/uni-user-id-select';
import { useApplicantUserIdField } from '../../../../hooks/useApplicantUserIdField';
import {
  createEquipmentUpkeepCompleteSheet,
  deleteEquipmentUpkeepCompleteSheet,
  getEquipmentUpkeepCompleteSheet,
  getEquipmentUpkeepSheet,
  HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS,
  listEquipmentUpkeepCompleteNotifyUserOptions,
  listEquipmentUpkeepCompleteSheets,
  listEquipmentUpkeepParamSets,
  listEquipmentUpkeepSheets,
  updateEquipmentUpkeepCompleteSheet,
  type EquipmentUpkeepCompleteSheetRow,
  type EquipmentUpkeepSheetRow,
} from '../../../../services/haoligo';
import { ReadonlyAttachmentStrip } from '../../../../components/ReadonlyAttachmentStrip';
import { PatrolImagePreview } from '../../../patrol/shared/PatrolImagePreview';
import { normUploadUuids, uuidsToSecureUploadFileList } from '../../../patrol/shared/uploadHelpers';
import { withMoldPictureCardUploadClass } from '../../../../utils/moldPictureCardUpload';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { EquipmentUpkeepRecordFields } from '../../../../components/EquipmentUpkeepRecordFields';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';
import { EQUIPMENT_UPKEEP_COMPLETE_SOURCE_PARAM } from '../../../../utils/equipmentUpkeepCompleteNavigation';

const EQUIP_UPKEEP_COMPLETE_DOC_NOTIFICATION = 'haoligo_equipment_upkeep_complete';
const EQUIP_UPKEEP_COMPLETE_ACTION_CREATED = 'created';

function parseNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => Number(v)).filter((id) => Number.isFinite(id) && id > 0);
}

function formatUpkeepRowLabel(r: EquipmentUpkeepSheetRow): string {
  const no = (r.sheet_no && String(r.sheet_no).trim()) || `维保单#${r.id}`;
  const eq =
    r.equipment_asset_code || r.equipment_name
      ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
      : `设备#${r.equipment_id}`;
  return `${no} · ${eq}`;
}

function SourceUpkeepPickerTrigger({
  value,
  onOpen,
  onClear,
  rows,
  disabled,
  placeholder,
  pickLabel,
  clearLabel,
}: {
  value?: number | string | null;
  onOpen: () => void;
  onClear: () => void;
  rows: EquipmentUpkeepSheetRow[];
  disabled?: boolean;
  placeholder: string;
  pickLabel: string;
  clearLabel: string;
}) {
  const n =
    value === '' || value === undefined || value === null
      ? NaN
      : typeof value === 'string'
        ? Number(value)
        : Number(value);
  const r = Number.isFinite(n) ? rows.find((x) => x.id === n) : undefined;
  const text = r ? formatUpkeepRowLabel(r) : '';
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        readOnly
        value={text}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, cursor: disabled ? 'default' : 'pointer' }}
        onClick={() => {
          if (!disabled) onOpen();
        }}
      />
      <Button type="primary" disabled={disabled} onClick={() => onOpen()}>
        {pickLabel}
      </Button>
      {!disabled ? (
        <Button htmlType="button" onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </Space.Compact>
  );
}

const EquipmentUpkeepCompletePage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const canPrintUpkeepComplete = canPrintHaoligoDocument(
    currentUser,
    HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_COMPLETE,
  );
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const {
    applicantPresetUsers,
    leafDeptOptions,
    onApplicantPicked,
    preloadTenantFormOptions,
    getCreateApplicantDefaults,
    resolveInitDepartmentUuid,
    presetFromApplicantRow,
    searchApplicantUsers,
  } = useApplicantUserIdField(formRef);
  const notifyLabelRef = useRef(new Map<number, string>());

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });
  const completeNotifyRule = useMemo(
    () =>
      findEnabledBusinessNotificationRule(
        businessConfigRes?.parameters?.notifications,
        EQUIP_UPKEEP_COMPLETE_DOC_NOTIFICATION,
        EQUIP_UPKEEP_COMPLETE_ACTION_CREATED,
      ),
    [businessConfigRes?.parameters?.notifications],
  );
  const completeNotifyDefaults = useMemo(
    () => getFormNotifyUserDefaultsFromRule(completeNotifyRule),
    [completeNotifyRule],
  );

  const searchCompleteNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const fromArg = (selectedIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      const selIds =
        fromArg.length > 0
          ? fromArg
          : ((formRef.current?.getFieldValue('complete_notify_user_ids') as number[] | undefined) || []);
      const users = await listEquipmentUpkeepCompleteNotifyUserOptions({
        keyword,
        limit: 80,
        selected_user_ids: selIds,
      });
      const opts = users.map((u) => ({ label: u.label, value: u.id }));
      for (const o of opts) {
        notifyLabelRef.current.set(o.value, o.label);
      }
      return opts;
    },
    [],
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formOptionsReady, setFormOptionsReady] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printRowId, setPrintRowId] = useState<number | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [sourceRows, setSourceRows] = useState<EquipmentUpkeepSheetRow[]>([]);
  const [upkeepSetOptions, setUpkeepSetOptions] = useState<{ value: number; label: string }[]>([]);
  const [sourceUpkeepParamSetId, setSourceUpkeepParamSetId] = useState<number | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [sourcePickerTab, setSourcePickerTab] = useState<'维修' | '保养'>('维修');
  const [formServiceType, setFormServiceType] = useState<'维修' | '保养'>('保养');
  const [beforePreview, setBeforePreview] = useState<{ header: string[]; description: string } | null>(null);
  const [sourceOrderDisplay, setSourceOrderDisplay] = useState('');
  const [equipmentDisplay, setEquipmentDisplay] = useState('');

  const title = t('app.haoligo.menu.equipment.documents.upkeep-complete');

  const sourceRowsRepair = useMemo(
    () => sourceRows.filter((r) => String(r.service_type ?? '').trim() === '维修'),
    [sourceRows],
  );
  const sourceRowsUpkeep = useMemo(
    () => sourceRows.filter((r) => String(r.service_type ?? '保养').trim() !== '维修'),
    [sourceRows],
  );

  const deptLabelByUuid = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of leafDeptOptions) m.set(o.value, o.label);
    return m;
  }, [leafDeptOptions]);

  const loadSourcesForPicker = useCallback(async () => {
    try {
      const [res, sets] = await Promise.all([
        listEquipmentUpkeepSheets({ skip: 0, limit: 200, open_for_complete: true }),
        listEquipmentUpkeepParamSets(),
      ]);
      setSourceRows(res.items || []);
      setUpkeepSetOptions(sets.map((s) => ({ value: s.id, label: `${s.code} ${s.name}` })));
    } catch {
      setSourceRows([]);
      setUpkeepSetOptions([]);
    }
  }, []);

  const uploadFieldProps = useMemo(
    (): Partial<UploadProps> =>
      withMoldPictureCardUploadClass({
        listType: 'picture-card',
        accept: '.jpg,.jpeg,.png,.gif,.webp',
        beforeUpload: (file) => {
          const isLt30M = (file.size ?? 0) / 1024 / 1024 < 30;
          if (!isLt30M) {
            messageApi.error('单个文件需小于 30MB');
            return Upload.LIST_IGNORE;
          }
          return true;
        },
        customRequest: async (options) => {
          try {
            const file = options.file as Parameters<typeof uploadFile>[0];
            const res = await uploadFile(file, { category: 'haoligo_equipment_upkeep_complete' });
            options.onSuccess?.(res, options.file);
          } catch (err) {
            options.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        },
      }),
    [messageApi],
  );

  const applySelectedSource = useCallback(
    async (row: EquipmentUpkeepSheetRow) => {
      const n = row.id;
      const preset = presetFromApplicantRow(row);
      await preloadTenantFormOptions(preset ? [preset] : undefined);
      const st = String(row.service_type ?? '').trim() === '维修' ? '维修' : '保养';
      setFormServiceType(st);
      setBeforePreview({
        header: [...(row.header_attachment_file_uuids || [])],
        description: row.description || '',
      });
      setSourceUpkeepParamSetId(row.upkeep_param_set_id ?? null);
      formRef.current?.setFieldsValue({
        source_upkeep_sheet_id: n,
        equipment_id: row.equipment_id,
        service_type: st,
        applicant_user_id: row.applicant_user_id ?? undefined,
        department_uuid: (row.department_uuid || '').trim() || undefined,
        upkeep_param_set_id: row.upkeep_param_set_id ?? undefined,
        upkeep_record_lines: [],
        completion_content: '',
        repair_content: '',
        repair_result: undefined,
        clear_total_production: st === '保养',
      });
      setSourcePickerOpen(false);
    },
    [preloadTenantFormOptions, presetFromApplicantRow],
  );

  const clearSelectedSource = useCallback(() => {
    setBeforePreview(null);
    setSourceUpkeepParamSetId(null);
    setFormServiceType('保养');
    formRef.current?.setFieldsValue({
      source_upkeep_sheet_id: undefined,
      equipment_id: undefined,
      service_type: undefined,
      upkeep_param_set_id: undefined,
      upkeep_record_lines: [],
      header_attachments: [],
      completion_content: '',
      repair_content: '',
      repair_result: undefined,
      clear_total_production: true,
    });
  }, []);

  const closeSheetModal = useCallback(() => {
    setModalVisible(false);
    setEditId(null);
    setIsDetailView(false);
    setFormOptionsReady(false);
    setBeforePreview(null);
    setFormServiceType('保养');
    setSourceOrderDisplay('');
    setEquipmentDisplay('');
  }, []);

  const handleCreate = useCallback(async () => {
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormOptionsReady(false);
    setModalVisible(true);
    try {
      await loadSourcesForPicker();
      await preloadTenantFormOptions(undefined);
      const applicantDefaults = getCreateApplicantDefaults();
      setFormServiceType('保养');
      setFormInitialValues({
        service_type: undefined,
        ...applicantDefaults,
        source_upkeep_sheet_id: undefined,
        completion_content: '',
        repair_content: '',
        repair_result: undefined,
        clear_total_production: true,
        header_attachments: [],
        complete_notify_user_ids: [...completeNotifyDefaults],
      });
      setBeforePreview(null);
      startTransition(() => setFormOptionsReady(true));
    } catch {
      messageApi.error(t('app.haoligo.equipment.upkeep.loadOptionsFailed'));
      setModalVisible(false);
      setFormOptionsReady(false);
    }
  }, [getCreateApplicantDefaults, loadSourcesForPicker, messageApi, preloadTenantFormOptions, t]);

  const startCreateWithSourceSheet = useCallback(
    async (row: EquipmentUpkeepSheetRow) => {
      setIsDetailView(false);
      setIsEdit(false);
      setEditId(null);
      setFormOptionsReady(false);
      setModalVisible(true);
      try {
        const fullRow = row.equipment_id ? row : await getEquipmentUpkeepSheet(row.id);
        await loadSourcesForPicker();
        setSourceRows((prev) => {
          if (prev.some((x) => x.id === fullRow.id)) return prev;
          return [fullRow, ...prev];
        });
        const st = String(fullRow.service_type ?? '').trim() === '维修' ? '维修' : '保养';
        const preset = presetFromApplicantRow(fullRow);
        await preloadTenantFormOptions(preset ? [preset] : undefined);
        setFormServiceType(st);
        setBeforePreview({
          header: [...(fullRow.header_attachment_file_uuids || [])],
          description: fullRow.description || '',
        });
        setSourceUpkeepParamSetId(fullRow.upkeep_param_set_id ?? null);
        const eqLabel =
          fullRow.equipment_asset_code || fullRow.equipment_name
            ? `${fullRow.equipment_asset_code || ''} ${fullRow.equipment_name || ''}`.trim()
            : fullRow.equipment_id != null
              ? `ID ${fullRow.equipment_id}`
              : '';
        setSourceOrderDisplay(
          (fullRow.sheet_no && String(fullRow.sheet_no).trim()) || `维保单#${fullRow.id}`,
        );
        setEquipmentDisplay(eqLabel);
        setFormInitialValues({
          service_type: st,
          source_upkeep_sheet_id: fullRow.id,
          equipment_id: fullRow.equipment_id,
          applicant_user_id: fullRow.applicant_user_id ?? undefined,
          department_uuid: (fullRow.department_uuid || '').trim() || undefined,
          upkeep_param_set_id: fullRow.upkeep_param_set_id ?? undefined,
          upkeep_record_lines: [],
          completion_content: '',
          repair_content: '',
          repair_result: undefined,
          clear_total_production: st === '保养',
          header_attachments: [],
          complete_notify_user_ids: [...completeNotifyDefaults],
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || '无法创建设备维保完成单');
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    },
    [completeNotifyDefaults, loadSourcesForPicker, messageApi, preloadTenantFormOptions, presetFromApplicantRow],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConsumedRef = useRef(false);

  useEffect(() => {
    const raw = searchParams.get(EQUIPMENT_UPKEEP_COMPLETE_SOURCE_PARAM);
    if (!raw || deepLinkConsumedRef.current) return;
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    deepLinkConsumedRef.current = true;
    setSearchParams({}, { replace: true });
    void (async () => {
      try {
        const row = await getEquipmentUpkeepSheet(id);
        await startCreateWithSourceSheet(row);
      } catch (e) {
        messageApi.error((e as Error).message || '无法根据设备维保单打开维保完成单');
      }
    })();
  }, [messageApi, searchParams, setSearchParams, startCreateWithSourceSheet]);

  const openSheetForm = useCallback(
    async (record: EquipmentUpkeepCompleteSheetRow, detailOnly: boolean) => {
      setFormOptionsReady(false);
      setModalVisible(true);
      setIsDetailView(detailOnly);
      setIsEdit(true);
      setEditId(record.id);
      try {
        const d = await getEquipmentUpkeepCompleteSheet(record.id);
        const preset = presetFromApplicantRow(d);
        await preloadTenantFormOptions(preset ? [preset] : undefined);
        const initDept = resolveInitDepartmentUuid(d.applicant_user_id, d.department_uuid);
        setBeforePreview({
          header: [...(d.source_header_attachment_file_uuids || [])],
          description: d.source_description || '',
        });
        const st = (d.service_type || d.source_service_type || '保养').trim() === '维修' ? '维修' : '保养';
        setFormServiceType(st);
        setSourceOrderDisplay(d.source_order_no || '');
        const eqLabel =
          d.equipment_asset_code || d.equipment_name
            ? `${d.equipment_asset_code || ''} ${d.equipment_name || ''}`.trim()
            : d.equipment_id != null
              ? `ID ${d.equipment_id}`
              : '';
        setEquipmentDisplay(eqLabel);
        setSourceUpkeepParamSetId(d.source_upkeep_param_set_id ?? d.upkeep_param_set_id ?? null);
        setFormInitialValues({
          service_type: st,
          source_upkeep_sheet_id: d.source_upkeep_sheet_id ?? undefined,
          equipment_id: d.equipment_id ?? undefined,
          applicant_user_id: d.applicant_user_id ?? undefined,
          department_uuid: initDept,
          upkeep_param_set_id: d.upkeep_param_set_id ?? undefined,
          upkeep_record_lines: (d.upkeep_record_lines ?? []).map((ln) => ({
            param_id: ln.param_id,
            record_value: ln.record_value ?? '',
          })),
          completion_content: d.completion_content ?? '',
          repair_content: d.repair_content ?? '',
          repair_result: d.repair_result ?? undefined,
          clear_total_production: st === '保养' ? d.clear_total_production !== false : false,
          header_attachments: await uuidsToSecureUploadFileList(d.header_attachment_file_uuids),
          complete_notify_user_ids:
            d.complete_notify_user_ids?.length ? d.complete_notify_user_ids : [...completeNotifyDefaults],
        });
        startTransition(() => setFormOptionsReady(true));
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        setModalVisible(false);
        setFormOptionsReady(false);
      }
    },
    [messageApi, preloadTenantFormOptions, presetFromApplicantRow, resolveInitDepartmentUuid, t],
  );

  const triggerSubmit = useCallback(() => {
    if (isDetailView) return;
    if (!formOptionsReady) {
      messageApi.warning('表单加载中，请稍候');
      return;
    }
    globalThis.setTimeout(() => {
      const inst = formRef.current;
      if (!inst || typeof inst.submit !== 'function') {
        messageApi.warning('表单未就绪');
        return;
      }
      inst.submit();
    }, 0);
  }, [formOptionsReady, isDetailView, messageApi]);

  useSubmitShortcut(triggerSubmit, modalVisible && !isDetailView);

  const handleSubmit = async (values: Record<string, unknown>) => {
    const applicantRaw = values.applicant_user_id;
    const applicantId =
      typeof applicantRaw === 'number'
        ? applicantRaw
        : typeof applicantRaw === 'string'
          ? Number(applicantRaw)
          : NaN;
    if (!Number.isFinite(applicantId)) {
      messageApi.error(t('app.haoligo.equipment.upkeep.selectApplicant'));
      return Promise.reject(new Error('validation'));
    }
    const deptUuid = typeof values.department_uuid === 'string' ? values.department_uuid.trim() : '';
    if (!deptUuid) {
      messageApi.error(t('app.haoligo.equipment.upkeep.selectDept'));
      return Promise.reject(new Error('validation'));
    }
    if (!deptLabelByUuid.has(deptUuid)) {
      messageApi.error(t('app.haoligo.equipment.upkeep.deptInvalid'));
      return Promise.reject(new Error('validation'));
    }
    const st = formServiceType;
    const completion = String(values.completion_content ?? '').trim();
    const repairContent = String(values.repair_content ?? '').trim();
    const repairResult = String(values.repair_result ?? '').trim();
    const upkeepSetId =
      values.upkeep_param_set_id != null && values.upkeep_param_set_id !== ''
        ? Number(values.upkeep_param_set_id)
        : undefined;
    const rawLines = values.upkeep_record_lines;
    const upkeepRecordLines = Array.isArray(rawLines)
      ? rawLines
          .filter((ln): ln is { param_id: number; record_value?: string } => ln && typeof ln === 'object')
          .map((ln) => ({
            param_id: Number(ln.param_id),
            record_value:
              ln.record_value != null && String(ln.record_value).trim() ? String(ln.record_value).trim() : null,
          }))
      : undefined;
    const hasRecordValues = upkeepRecordLines?.some((ln) => ln.record_value);
    if (st === '保养') {
      if (!hasRecordValues && !completion && upkeepSetId == null) {
        messageApi.error('请选择保养方案并填写保养项记录，或填写保养完成说明');
        return Promise.reject(new Error('validation'));
      }
    } else {
      if (!repairContent) {
        messageApi.error(t('app.haoligo.equipment.upkeepComplete.repairContentRequired'));
        return Promise.reject(new Error('validation'));
      }
      if (!repairResult) {
        messageApi.error(t('app.haoligo.equipment.upkeepComplete.repairResultRequired'));
        return Promise.reject(new Error('validation'));
      }
    }
    const headerUuids = normUploadUuids(values.header_attachments);
    const clearTotal =
      st === '保养' ? values.clear_total_production !== false && values.clear_total_production !== 0 : false;
    setFormLoading(true);
    try {
      if (isEdit && editId != null) {
        await updateEquipmentUpkeepCompleteSheet(editId, {
          applicant_user_id: applicantId,
          department_uuid: deptUuid,
          completion_content: st === '保养' ? completion || null : null,
          upkeep_param_set_id: st === '保养' ? upkeepSetId : undefined,
          upkeep_record_lines: st === '保养' ? upkeepRecordLines : undefined,
          repair_content: st === '维修' ? repairContent : null,
          repair_result: st === '维修' ? repairResult : null,
          header_attachment_file_uuids: headerUuids.length ? headerUuids : [],
          clear_total_production: st === '保养' ? clearTotal : undefined,
          complete_notify_user_ids: parseNotifyUserIds(values.complete_notify_user_ids),
        });
        messageApi.success(t('app.haoligo.equipment.upkeep.saved'));
      } else {
        const sid = Number(values.source_upkeep_sheet_id);
        if (!Number.isFinite(sid)) {
          messageApi.error(t('app.haoligo.equipment.upkeepComplete.sourceRequired'));
          return Promise.reject(new Error('validation'));
        }
        await createEquipmentUpkeepCompleteSheet({
          source_upkeep_sheet_id: sid,
          applicant_user_id: applicantId,
          department_uuid: deptUuid,
          completion_content: st === '保养' ? completion || null : null,
          upkeep_param_set_id: st === '保养' ? upkeepSetId : undefined,
          upkeep_record_lines: st === '保养' ? upkeepRecordLines : undefined,
          repair_content: st === '维修' ? repairContent : null,
          repair_result: st === '维修' ? repairResult : null,
          header_attachment_file_uuids: headerUuids.length ? headerUuids : undefined,
          clear_total_production: st === '保养' ? clearTotal : undefined,
          complete_notify_user_ids: parseNotifyUserIds(values.complete_notify_user_ids),
        });
        messageApi.success(t('app.haoligo.equipment.upkeep.submitted'));
      }
      closeSheetModal();
      actionRef.current?.reload();
    } catch (e) {
      if ((e as Error).message !== 'validation') {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      }
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteOne = (record: EquipmentUpkeepCompleteSheetRow) => {
    Modal.confirm({
      title: t('app.haoligo.equipment.upkeep.confirmDelete'),
      content: t('app.haoligo.equipment.upkeepComplete.confirmDeleteContent'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteEquipmentUpkeepCompleteSheet(record.id);
          messageApi.success(t('app.haoligo.equipment.updateSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        }
      },
    });
  };

  const pickerColumns: ColumnsType<EquipmentUpkeepSheetRow> = useMemo(
    () => [
      { title: t('app.haoligo.equipment.upkeep.serviceType'), dataIndex: 'service_type', width: 80 },
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', ellipsis: true, width: 130 },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        key: 'eq',
        ellipsis: true,
        width: 180,
        render: (_, r) =>
          r.equipment_asset_code || r.equipment_name
            ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
            : `ID ${r.equipment_id}`,
      },
      { title: t('app.haoligo.equipment.upkeep.applicant'), dataIndex: 'applicant_name', width: 100, ellipsis: true },
      { title: t('app.haoligo.equipment.upkeep.department'), dataIndex: 'department_name', width: 120, ellipsis: true },
    ],
    [t],
  );

  const columns: ProColumns<EquipmentUpkeepCompleteSheetRow>[] = [
    {
      title: t('app.haoligo.equipment.upkeep.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('app.haoligo.equipment.upkeepComplete.keywordPh') },
    },
    {
      title: t('app.haoligo.equipment.documents.colSheetNo'),
      dataIndex: 'sheet_no',
      width: 140,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeepComplete.colSourceNo'),
      dataIndex: 'source_order_no',
      width: 150,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeep.serviceType'),
      dataIndex: 'service_type',
      width: 90,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeep.department'),
      dataIndex: 'department_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: t('app.haoligo.equipment.upkeep.applicant'),
      dataIndex: 'applicant_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeepComplete.upkeepContent'),
      dataIndex: 'completion_content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeepComplete.repairContent'),
      dataIndex: 'repair_content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.haoligo.equipment.upkeepComplete.repairResult'),
      dataIndex: 'repair_result',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '重置累计产量',
      dataIndex: 'clear_total_production',
      width: 110,
      hideInSearch: true,
      render: (_, r) => {
        const st = String(r.service_type ?? '').trim();
        if (st === '维修') return '—';
        return r.clear_total_production ? '是' : '否';
      },
    },
    moldDocumentCreatedAtColumn<EquipmentUpkeepCompleteSheetRow>(),
    {
      title: t('app.haoligo.equipment.documents.colActions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
        <Button key="view" {...rowActionKind('read')} onClick={() => void openSheetForm(record, true)} />,
        ...(canPrintUpkeepComplete
          ? [
              <Button
                key="print"
                {...rowActionKind('print')}
                onClick={() => {
                  setPrintRowId(record.id);
                  setPrintOpen(true);
                }}
              />,
            ]
          : []),
        <Button key="edit" {...rowActionKind('update')} onClick={() => void openSheetForm(record, false)} />,
        <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)} />,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentUpkeepCompleteSheetRow>
          headerTitle={title}
          columnPersistenceId="apps.haoligo.pages.equipment.documents.upkeep-complete"
          completeCreateSourceResource={HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_SHEET}
          permissionResource={HAOLIGO_RESOURCE_EQUIPMENT_UPKEEP_COMPLETE}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText={t('app.haoligo.equipment.documents.btnNew')}
          onCreate={() => void handleCreate()}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listEquipmentUpkeepCompleteSheets({
                skip,
                limit: pageSize,
                keyword:
                  typeof searchFormValues?.keyword === 'string' && searchFormValues.keyword.trim()
                    ? searchFormValues.keyword.trim()
                    : undefined,
              });
              return { data: res.items, success: true, total: res.total };
            } catch (e) {
              messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <Modal
        title={
          isDetailView
            ? `${title} — ${t('app.haoligo.equipment.documents.actionView')}`
            : isEdit
              ? `${title} — ${t('app.haoligo.equipment.documents.actionEdit')}`
              : `${title} — ${t('app.haoligo.equipment.documents.phaseNew')}`
        }
        open={modalVisible}
        onCancel={closeSheetModal}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
        footer={
          isDetailView ? (
            <Button htmlType="button" onClick={closeSheetModal}>
              {t('app.haoligo.equipment.documents.btnClose')}
            </Button>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              <Button htmlType="button" type="primary" disabled={!formOptionsReady} loading={formLoading} onClick={triggerSubmit}>
                {t('app.haoligo.equipment.documents.btnSave')}
                {SUBMIT_SHORTCUT_HINT}
              </Button>
            </div>
          )
        }
      >
        <div className="form-modal-content-inner">
          {!formOptionsReady ? (
            <div style={{ display: 'flex', minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Spin tip="加载选项中…" />
            </div>
          ) : (
            <ProForm
              key={modalVisible ? `${isEdit}-${editId ?? 'n'}` : 'closed'}
              formRef={formRef}
              loading={formLoading}
              readonly={isDetailView}
              onFinish={handleSubmit}
              onFinishFailed={({ errorFields }) => {
                const first = errorFields?.[0];
                const text = first?.errors?.filter(Boolean)[0];
                messageApi.error(text || '请检查表单');
              }}
              initialValues={formInitialValues}
              submitter={false}
              layout="vertical"
              scrollToFirstError
            >
              {!isEdit && sourceRowsRepair.length === 0 && sourceRowsUpkeep.length === 0 ? (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={t('app.haoligo.equipment.upkeepComplete.noneOpen')}
                  description={t('app.haoligo.equipment.upkeepComplete.noneOpenDesc')}
                />
              ) : null}
              <Row gutter={16}>
                <Col span={24}>
                  {!isEdit && (sourceRowsRepair.length > 0 || sourceRowsUpkeep.length > 0) ? (
                    <ProForm.Item
                      name="source_upkeep_sheet_id"
                      label={t('app.haoligo.equipment.upkeepComplete.sourceSheet')}
                      rules={[{ required: true, message: t('app.haoligo.equipment.upkeepComplete.sourceRequired') }]}
                    >
                      <SourceUpkeepPickerTrigger
                        rows={[...sourceRowsRepair, ...sourceRowsUpkeep]}
                        disabled={isDetailView}
                        onOpen={() => {
                          setSourcePickerTab('维修');
                          setSourcePickerOpen(true);
                          void loadSourcesForPicker();
                        }}
                        onClear={clearSelectedSource}
                        placeholder={t('app.haoligo.equipment.upkeepComplete.phPickSource')}
                        pickLabel={t('app.haoligo.equipment.upkeepComplete.pick')}
                        clearLabel={t('app.haoligo.equipment.upkeepComplete.clear')}
                      />
                    </ProForm.Item>
                  ) : null}
                  {!isEdit && beforePreview ? (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{t('app.haoligo.equipment.upkeep.serviceType')}</span>
                      <Input readOnly value={formServiceType} />
                    </div>
                  ) : null}
                  {isEdit ? (
                    <section style={{ marginBottom: 12 }}>
                      <span style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{t('app.haoligo.equipment.upkeep.serviceType')}</span>
                      <Input readOnly value={formServiceType} style={{ marginBottom: 8 }} />
                      <span style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{t('app.haoligo.equipment.upkeepComplete.sourceSheet')}</span>
                      <Input readOnly value={sourceOrderDisplay} />
                    </section>
                  ) : null}
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <UniUserIdSelect
                    name="applicant_user_id"
                    label={t('app.haoligo.equipment.upkeep.applicant')}
                    placeholder="请输入姓名或账号搜索"
                    required
                    presetUsers={applicantPresetUsers}
                    onUserPicked={onApplicantPicked}
                    searchUsers={searchApplicantUsers}
                  />
                </Col>
                <Col span={12}>
                  <ProFormSelect
                    name="department_uuid"
                    label={t('app.haoligo.equipment.upkeep.department')}
                    placeholder="请选择申请部门"
                    rules={[{ required: true, message: t('app.haoligo.equipment.upkeep.selectDept') }]}
                    options={leafDeptOptions}
                    showSearch
                    fieldProps={{
                      virtual: true,
                      listHeight: 256,
                      optionFilterProp: 'label',
                    }}
                  />
                </Col>
              </Row>

              <FormNotifyUsersSelect
                colSpan={12}
                name="complete_notify_user_ids"
                label="完修通知人员"
                placeholder="请选择完修通知人员（抄送）"
                readonly={isDetailView}
                seedUserIds={completeNotifyDefaults}
                searchUsers={searchCompleteNotifyUsers}
              />

              {(beforePreview || isEdit) && formServiceType ? (
                <>
                  <Divider titlePlacement="left">{t('app.haoligo.equipment.upkeepComplete.sectionSource')}</Divider>
                  {equipmentDisplay ? (
                    <div style={{ marginBottom: 12, fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
                      {t('app.haoligo.equipment.documents.colEquipment')}: {equipmentDisplay}
                    </div>
                  ) : null}
                  {beforePreview ? (
                    <div
                      style={{
                        marginBottom: 16,
                        padding: 12,
                        background: '#fafafa',
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ marginBottom: 6, fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
                        {formServiceType === '维修'
                          ? t('app.haoligo.equipment.upkeepComplete.equipPhotoBeforeRepair')
                          : t('app.haoligo.equipment.upkeepComplete.equipPhotoBefore')}
                      </div>
                      <ReadonlyAttachmentStrip uuids={beforePreview.header} />
                      {beforePreview.description ? (
                        <>
                          <Divider dashed style={{ margin: '12px 0' }} />
                          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.65)', marginBottom: 4 }}>
                            {formServiceType === '维修'
                              ? t('app.haoligo.equipment.upkeepComplete.sourceDescRepair')
                              : t('app.haoligo.equipment.upkeepComplete.sourceDesc')}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{beforePreview.description}</div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}

              {formServiceType ? (
                <>
                  <Divider titlePlacement="left">{t('app.haoligo.equipment.upkeepComplete.sectionComplete')}</Divider>
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                    }}
                  >
                    {formServiceType === '保养' ? (
                      <>
                        <ProFormText name="equipment_id" hidden />
                        <Row gutter={16}>
                          <EquipmentUpkeepRecordFields
                            readOnly={isDetailView}
                            upkeepSetOptions={upkeepSetOptions}
                            sourceUpkeepParamSetId={sourceUpkeepParamSetId}
                          />
                        </Row>
                        {!isDetailView ? (
                          <ProFormSwitch
                            name="clear_total_production"
                            label="是否重置累计产量"
                            initialValue
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <ProFormTextArea
                          name="repair_content"
                          label={t('app.haoligo.equipment.upkeepComplete.repairContent')}
                          rules={[
                            {
                              required: !isDetailView,
                              message: t('app.haoligo.equipment.upkeepComplete.repairContentRequired'),
                            },
                          ]}
                          fieldProps={{ rows: 4, maxLength: 4000, showCount: true }}
                        />
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <ProFormSelect
                              name="repair_result"
                              label={t('app.haoligo.equipment.upkeepComplete.repairResult')}
                              rules={[
                                {
                                  required: !isDetailView,
                                  message: t('app.haoligo.equipment.upkeepComplete.repairResultRequired'),
                                },
                              ]}
                              options={HAOLIGO_MAINTENANCE_COMPLETE_REPAIR_RESULTS.map((v) => ({
                                label: v,
                                value: v,
                              }))}
                            />
                          </Col>
                        </Row>
                      </>
                    )}
                    <Divider dashed style={{ margin: '14px 0' }} />
                    {isDetailView ? (
                      <Form.Item
                        label={
                          formServiceType === '维修'
                            ? t('app.haoligo.equipment.upkeepComplete.equipPhotoAfterRepair')
                            : t('app.haoligo.equipment.upkeepComplete.equipPhotoAfter')
                        }
                      >
                        <PatrolImagePreview
                          files={(formInitialValues?.header_attachments as UploadFile[] | undefined) ?? []}
                        />
                      </Form.Item>
                    ) : (
                      <ProFormUploadButton
                        name="header_attachments"
                        label={
                          formServiceType === '维修'
                            ? t('app.haoligo.equipment.upkeepComplete.equipPhotoAfterRepair')
                            : t('app.haoligo.equipment.upkeepComplete.equipPhotoAfter')
                        }
                        max={10}
                        fieldProps={uploadFieldProps}
                      />
                    )}
                  </div>
                </>
              ) : null}
            </ProForm>
          )}
        </div>
      </Modal>

      <Modal
        title={t('app.haoligo.equipment.upkeepComplete.pickModalTitle')}
        open={sourcePickerOpen}
        onCancel={() => setSourcePickerOpen(false)}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <Tabs
          activeKey={sourcePickerTab}
          onChange={(k) => setSourcePickerTab(k as '维修' | '保养')}
          items={[
            {
              key: '维修',
              label: `${t('app.haoligo.equipment.upkeepComplete.tabRepair')}（${sourceRowsRepair.length}）`,
              children: (
                <Table<EquipmentUpkeepSheetRow>
                  size="small"
                  rowKey="id"
                  columns={pickerColumns}
                  dataSource={sourceRowsRepair}
                  pagination={false}
                  scroll={{ y: 380 }}
                  locale={{ emptyText: t('app.haoligo.equipment.upkeepComplete.noneOpenRepair') }}
                  onRow={(record) => ({
                    onClick: () => void applySelectedSource(record),
                    style: { cursor: 'pointer' },
                  })}
                />
              ),
            },
            {
              key: '保养',
              label: `${t('app.haoligo.equipment.upkeepComplete.tabUpkeep')}（${sourceRowsUpkeep.length}）`,
              children: (
                <Table<EquipmentUpkeepSheetRow>
                  size="small"
                  rowKey="id"
                  columns={pickerColumns}
                  dataSource={sourceRowsUpkeep}
                  pagination={false}
                  scroll={{ y: 380 }}
                  locale={{ emptyText: t('app.haoligo.equipment.upkeepComplete.noneOpenUpkeep') }}
                  onRow={(record) => ({
                    onClick: () => void applySelectedSource(record),
                    style: { cursor: 'pointer' },
                  })}
                />
              ),
            },
          ]}
        />
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Button onClick={() => setSourcePickerOpen(false)}>{t('app.haoligo.equipment.documents.btnClose')}</Button>
        </div>
      </Modal>

      <HaoligoDocumentPrintModal
        open={printOpen}
        onClose={() => {
          setPrintOpen(false);
          setPrintRowId(null);
        }}
        documentType="equipment_upkeep_complete"
        documentId={printRowId}
        title={t('app.haoligo.print.equipmentUpkeepCompleteTitle')}
      />
    </>
  );
};

export default EquipmentUpkeepCompletePage;
