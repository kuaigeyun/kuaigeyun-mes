/**
 * 设备验收单详情 — 调试 / 试产 / 台账结案（与手机端 [id].tsx 对齐）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { DictionarySelect } from '../../../../../../components/dictionary-select';
import {
  findEnabledBusinessNotificationRule,
  getFormNotifyUserDefaultsFromRule,
} from '../../../../../../components/business-notification-rules/notificationRuleFormUsers';
import { getBusinessConfig } from '../../../../../../services/businessConfig';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates';
import ManufacturerSelect from '../../../../components/ManufacturerSelect';
import { HAOLIGO_RESOURCE_EQUIPMENT_ACCEPTANCE } from '../../../../constants/documentPermissionResources';
import {
  completeEquipmentAcceptanceTrial,
  finalizeEquipmentAcceptanceLedger,
  listCategories,
  listEquipmentUpkeepParamSets,
  listEquipments,
  listHaoligoNotifyUserOptions,
  listInspectionParamSets,
  listWorkshops,
  startEquipmentAcceptanceTrial,
  submitEquipmentAcceptanceCommissioning,
  updateEquipmentAcceptanceRoundCommissioning,
  updateEquipmentAcceptanceRoundTrial,
  type EquipmentAcceptanceRoundRow,
  type EquipmentAcceptanceSheetRow,
} from '../../../../services/haoligo';
import {
  ACCEPTANCE_RESULT_OPTIONS,
  acceptanceWorkflowStatusTagColor,
  calcAcceptancePassRate,
  commissioningContentRequired,
  currentAcceptanceRound,
  formatAcceptancePassRate,
} from '../../../../utils/equipmentAcceptance';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { formatDateTime } from '../../../../../../utils/format';
import { SecurePictureCardUpload } from '../../../../components/SecurePictureCardUpload';
import { MoldAttachmentImagePreview } from '../../../../components/MoldAttachmentImagePreview';
import { uploadFile, type FileUploadResponse } from '../../../../../../services/file';
import { HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT } from '../../../../utils/equipmentOperationalStatus';

const ACCEPTANCE_DOC_NOTIFICATION = 'haoligo_equipment_acceptance';
const ACCEPTANCE_UPLOAD_CATEGORY = 'haoligo_equipment_acceptance';
const EQUIPMENT_LEDGER_UPLOAD_CATEGORY = 'haoligo_equipment';
const ACCEPTANCE_ACTION_TRIAL_PENDING = 'trial_pending';
const ACCEPTANCE_ACTION_ACCEPTED = 'accepted';
const ACCEPTANCE_ACTION_TRIAL_FAILED = 'trial_failed';

export type AcceptanceDetailPanelProps = {
  detail: EquipmentAcceptanceSheetRow;
  onReload: () => Promise<void>;
  /** 从列表「台账结案」进入时自动打开结案弹窗 */
  initialAction?: 'ledger' | null;
  onInitialActionHandled?: () => void;
};

const AcceptanceDetailPanel: React.FC<AcceptanceDetailPanelProps> = ({
  detail,
  onReload,
  initialAction,
  onInitialActionHandled,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(HAOLIGO_RESOURCE_EQUIPMENT_ACCEPTANCE);

  const canSubmit = perms.canAction?.('submit') ?? false;
  const canExecute = perms.canAction?.('execute') ?? false;
  const canComplete = perms.canAction?.('complete') ?? false;

  const [busy, setBusy] = useState(false);
  const [commissioningContent, setCommissioningContent] = useState('');
  const [commissioningResult, setCommissioningResult] = useState<string | null>(null);
  const [notifyIds, setNotifyIds] = useState<number[]>([]);
  const [productName, setProductName] = useState('');
  const [materialNo, setMaterialNo] = useState('');
  const [quantity, setQuantity] = useState<number | null>(null);
  const [defectQty, setDefectQty] = useState<number | null>(null);
  const [defectReason, setDefectReason] = useState('');
  const [runningTime, setRunningTime] = useState<number | null>(null);
  const [faultTime, setFaultTime] = useState<number | null>(null);
  const [capacityPerHour, setCapacityPerHour] = useState<number | null>(null);
  const [trialResult, setTrialResult] = useState<string | null>(null);
  const [commissioningAttachmentUuids, setCommissioningAttachmentUuids] = useState<string[]>([]);
  const [trialAttachmentUuids, setTrialAttachmentUuids] = useState<string[]>([]);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerMode, setLedgerMode] = useState<'create' | 'link'>('create');
  const [assetCode, setAssetCode] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [workshopId, setWorkshopId] = useState<number | null>(null);
  const [manufacturerId, setManufacturerId] = useState<number | null>(null);
  const [inspectionParamSetIds, setInspectionParamSetIds] = useState<number[]>([]);
  const [upkeepParamSetId, setUpkeepParamSetId] = useState<number | null>(null);
  const [criticality, setCriticality] = useState<string | null>(null);
  const [operationalStatus, setOperationalStatus] = useState<string | null>(null);
  const [manufactureDate, setManufactureDate] = useState<Dayjs | null>(null);
  const [maintenanceCycleByYield, setMaintenanceCycleByYield] = useState<number | null>(null);
  const [maintenanceCycleByDays, setMaintenanceCycleByDays] = useState<number | null>(null);
  const [ledgerRemark, setLedgerRemark] = useState('');
  const [ledgerImageUuids, setLedgerImageUuids] = useState<string[]>([]);
  const [linkEquipmentId, setLinkEquipmentId] = useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: number }[]>([]);
  const [workshopOptions, setWorkshopOptions] = useState<{ label: string; value: number }[]>([]);
  const [paramSetOptions, setParamSetOptions] = useState<{ label: string; value: number }[]>([]);
  const [upkeepSetOptions, setUpkeepSetOptions] = useState<{ label: string; value: number }[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);

  const criticalitySelectOptions = useMemo(
    () => [
      { label: t('app.haoligo.equipment.ledger.criticalityA'), value: 'A' },
      { label: t('app.haoligo.equipment.ledger.criticalityB'), value: 'B' },
      { label: t('app.haoligo.equipment.ledger.criticalityC'), value: 'C' },
    ],
    [t],
  );

  const currentRound = useMemo(() => currentAcceptanceRound(detail), [detail]);
  const passRate = useMemo(
    () => formatAcceptancePassRate(calcAcceptancePassRate(quantity, defectQty)),
    [quantity, defectQty],
  );
  const status = detail.workflow_status ?? '';
  const historyRounds = useMemo(
    () => (detail.rounds ?? []).filter((r) => r.round_no !== detail.current_round),
    [detail],
  );

  const workflowLabel = useCallback(
    (s: string | null | undefined) => {
      const key = (s || '').trim();
      if (!key) return '—';
      return t(`app.haoligo.equipment.documents.acceptance.workflow.${key}`, { defaultValue: key });
    },
    [t],
  );

  const syncForms = useCallback((round: EquipmentAcceptanceRoundRow | null, sheet: EquipmentAcceptanceSheetRow) => {
    if (round) {
      setCommissioningContent(round.commissioning_content ?? '');
      setCommissioningResult(round.commissioning_result ?? null);
      setProductName(round.product_name ?? '');
      setMaterialNo(round.material_no ?? '');
      setQuantity(round.quantity != null ? Number(round.quantity) : null);
      setDefectQty(round.defect_qty != null ? Number(round.defect_qty) : null);
      setDefectReason(round.defect_reason ?? '');
      setRunningTime(round.running_time != null ? Number(round.running_time) : null);
      setFaultTime(round.fault_time != null ? Number(round.fault_time) : null);
      setCapacityPerHour(round.capacity_per_hour != null ? Number(round.capacity_per_hour) : null);
      setTrialResult(round.trial_result ?? null);
      setCommissioningAttachmentUuids(round.commissioning_attachment_file_uuids ?? []);
      setTrialAttachmentUuids(round.trial_attachment_file_uuids ?? []);
    }
    setNotifyIds(sheet.submitted_notify_user_ids ?? []);
  }, []);

  useEffect(() => {
    syncForms(currentRound, detail);
  }, [currentRound, detail, syncForms]);

  const { data: businessConfigRes } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    staleTime: 0,
  });
  const commissioningNotifyDefaults = useMemo(() => {
    const rule = findEnabledBusinessNotificationRule(
      businessConfigRes?.parameters?.notifications,
      ACCEPTANCE_DOC_NOTIFICATION,
      ACCEPTANCE_ACTION_TRIAL_PENDING,
    );
    return getFormNotifyUserDefaultsFromRule(rule);
  }, [businessConfigRes?.parameters?.notifications]);
  const trialConclusionNotifyDefaults = useMemo(() => {
    const action =
      trialResult === '合格' ? ACCEPTANCE_ACTION_ACCEPTED : ACCEPTANCE_ACTION_TRIAL_FAILED;
    const rule = findEnabledBusinessNotificationRule(
      businessConfigRes?.parameters?.notifications,
      ACCEPTANCE_DOC_NOTIFICATION,
      action,
    );
    return getFormNotifyUserDefaultsFromRule(rule);
  }, [businessConfigRes?.parameters?.notifications, trialResult]);

  const searchNotifyUsers = useCallback(async (keyword?: string, defaults?: number[]) => {
    const fallbackDefaults = defaults ?? commissioningNotifyDefaults;
    const users = await listHaoligoNotifyUserOptions({
      keyword: keyword?.trim() || undefined,
      selected_user_ids: notifyIds.length ? notifyIds : fallbackDefaults.length ? fallbackDefaults : undefined,
      limit: 50,
    });
    return users.map((u) => ({ label: u.label, value: u.id }));
  }, [commissioningNotifyDefaults, notifyIds]);

  const [notifyUserOptions, setNotifyUserOptions] = useState<{ label: string; value: number }[]>([]);

  useEffect(() => {
    const showCommissioning = (status === 'commissioning' || status === 'draft') && canSubmit;
    const showTrial = status === 'trial_recording' && canExecute;
    if (!showCommissioning && !showTrial) return;
    void searchNotifyUsers().then(setNotifyUserOptions);
  }, [canExecute, canSubmit, searchNotifyUsers, status]);

  useEffect(() => {
    if (status === 'commissioning' || status === 'draft') {
      if (commissioningNotifyDefaults.length && !notifyIds.length) {
        setNotifyIds(commissioningNotifyDefaults);
      }
      return;
    }
    if (status === 'trial_recording' && trialConclusionNotifyDefaults.length && !notifyIds.length) {
      setNotifyIds(trialConclusionNotifyDefaults);
    }
  }, [commissioningNotifyDefaults, notifyIds.length, status, trialConclusionNotifyDefaults]);

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await onReload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const saveCommissioning = () =>
    runAction(async () => {
      if (!currentRound) return;
      await updateEquipmentAcceptanceRoundCommissioning(detail.id, currentRound.round_no, {
        commissioning_content: commissioningContent.trim() || undefined,
        commissioning_result: commissioningResult ?? undefined,
        commissioning_attachment_file_uuids: commissioningAttachmentUuids,
      });
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
    });

  const submitTrialRequest = () =>
    runAction(async () => {
      if (commissioningResult !== '合格') {
        messageApi.warning(t('app.haoligo.equipment.documents.acceptance.commissioningPassRequired'));
        return;
      }
      if (commissioningContentRequired(detail.current_round ?? 1) && !commissioningContent.trim()) {
        messageApi.warning(t('app.haoligo.equipment.documents.acceptance.commissioningContentRequired'));
        return;
      }
      await updateEquipmentAcceptanceRoundCommissioning(detail.id, detail.current_round ?? 1, {
        commissioning_content: commissioningContent.trim() || undefined,
        commissioning_result: commissioningResult,
        commissioning_attachment_file_uuids: commissioningAttachmentUuids,
      });
      await submitEquipmentAcceptanceCommissioning(detail.id, { submitted_notify_user_ids: notifyIds });
      messageApi.success(t('app.haoligo.equipment.documents.acceptance.submitTrialSuccess'));
    });

  const saveTrial = () =>
    runAction(async () => {
      if (!currentRound) return;
      await updateEquipmentAcceptanceRoundTrial(detail.id, currentRound.round_no, {
        product_name: productName.trim() || undefined,
        material_no: materialNo.trim() || undefined,
        quantity: quantity ?? undefined,
        defect_qty: defectQty ?? undefined,
        defect_reason: defectReason.trim() || undefined,
        running_time: runningTime ?? undefined,
        fault_time: faultTime ?? undefined,
        capacity_per_hour: capacityPerHour ?? undefined,
        trial_result: trialResult ?? undefined,
        trial_attachment_file_uuids: trialAttachmentUuids,
      });
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
    });

  const submitTrialConclusion = () =>
    runAction(async () => {
      if (!currentRound) return;
      await updateEquipmentAcceptanceRoundTrial(detail.id, currentRound.round_no, {
        product_name: productName.trim() || undefined,
        material_no: materialNo.trim() || undefined,
        quantity: quantity ?? undefined,
        defect_qty: defectQty ?? undefined,
        defect_reason: defectReason.trim() || undefined,
        running_time: runningTime ?? undefined,
        fault_time: faultTime ?? undefined,
        capacity_per_hour: capacityPerHour ?? undefined,
        trial_result: trialResult ?? undefined,
        trial_attachment_file_uuids: trialAttachmentUuids,
      });
      const sheet = await completeEquipmentAcceptanceTrial(detail.id, {
        submitted_notify_user_ids: notifyIds,
      });
      messageApi.success(
        sheet.workflow_status === 'accepted'
          ? t('app.haoligo.equipment.documents.acceptance.acceptedSuccess')
          : t('app.haoligo.equipment.documents.acceptance.trialFailedSuccess'),
      );
    });

  const openLedgerModal = useCallback(async () => {
    setLedgerMode('create');
    setAssetCode('');
    setEquipmentName(detail.equipment_name ?? '');
    setCategoryId(null);
    setWorkshopId(null);
    setManufacturerId(detail.manufacturer_id ?? null);
    setInspectionParamSetIds([]);
    setUpkeepParamSetId(null);
    setCriticality(null);
    setOperationalStatus(null);
    setManufactureDate(null);
    setMaintenanceCycleByYield(null);
    setMaintenanceCycleByDays(null);
    setLedgerRemark(detail.install_location ?? '');
    setLedgerImageUuids([]);
    setLinkEquipmentId(null);
    setLedgerOpen(true);
    try {
      const [categories, workshops, paramSets, upkeepSets, equipPage] = await Promise.all([
        listCategories(),
        listWorkshops(),
        listInspectionParamSets(),
        listEquipmentUpkeepParamSets(),
        listEquipments({ limit: 200 }),
      ]);
      setCategoryOptions(categories.map((c) => ({ label: c.name || c.code || `#${c.id}`, value: c.id })));
      setWorkshopOptions(workshops.map((w) => ({ label: w.name || w.code || `#${w.id}`, value: w.id })));
      setParamSetOptions(paramSets.map((p) => ({ label: `${p.code} ${p.name}`.trim() || `#${p.id}`, value: p.id })));
      setUpkeepSetOptions(upkeepSets.map((p) => ({ label: `${p.code} ${p.name}`.trim() || `#${p.id}`, value: p.id })));
      setEquipmentOptions(
        equipPage.items.map((e) => ({
          label: `${e.asset_code ?? ''} ${e.name ?? ''}`.trim() || `#${e.id}`,
          value: e.id,
        })),
      );
    } catch {
      /* options load on reopen */
    }
  }, [detail.equipment_name, detail.install_location, detail.manufacturer_id]);

  const initialLedgerHandledRef = useRef(false);

  useEffect(() => {
    initialLedgerHandledRef.current = false;
  }, [detail.id]);

  useEffect(() => {
    if (initialAction !== 'ledger' || initialLedgerHandledRef.current) return;
    if (!canComplete) {
      onInitialActionHandled?.();
      return;
    }
    const ledgerPending =
      status === 'accepted' && (detail.ledger_action === 'none' || !detail.ledger_action);
    if (!ledgerPending) {
      onInitialActionHandled?.();
      return;
    }
    initialLedgerHandledRef.current = true;
    void openLedgerModal().finally(() => onInitialActionHandled?.());
  }, [
    initialAction,
    canComplete,
    status,
    detail.ledger_action,
    detail.id,
    onInitialActionHandled,
    openLedgerModal,
  ]);

  const submitLedger = () =>
    runAction(async () => {
      if (ledgerMode === 'link') {
        if (!linkEquipmentId) {
          messageApi.warning(t('app.haoligo.equipment.documents.acceptance.ledgerLinkRequired'));
          return;
        }
        await finalizeEquipmentAcceptanceLedger(detail.id, {
          mode: 'link',
          equipment_id: linkEquipmentId,
        });
      } else {
        const code = assetCode.trim();
        const name = equipmentName.trim();
        if (!code) {
          messageApi.warning(t('app.haoligo.equipment.ledger.formAssetCodeReq'));
          return;
        }
        if (!name) {
          messageApi.warning(t('app.haoligo.equipment.ledger.formNameReq'));
          return;
        }
        if (categoryId == null || workshopId == null) {
          messageApi.warning(t('app.haoligo.equipment.documents.acceptance.ledgerCategoryWorkshopRequired'));
          return;
        }
        await finalizeEquipmentAcceptanceLedger(detail.id, {
          mode: 'create',
          asset_code: code,
          name,
          category_id: categoryId,
          workshop_id: workshopId,
          manufacturer_id: manufacturerId ?? undefined,
          manufacture_date: manufactureDate ? manufactureDate.format('YYYY-MM-DD') : undefined,
          inspection_param_set_ids: inspectionParamSetIds,
          upkeep_param_set_id: upkeepParamSetId ?? undefined,
          criticality: criticality ?? undefined,
          operational_status: operationalStatus ?? undefined,
          remark: ledgerRemark.trim() || undefined,
          image_file_uuids: ledgerImageUuids.length ? ledgerImageUuids : undefined,
          maintenance_cycle_by_yield: maintenanceCycleByYield ?? undefined,
          maintenance_cycle_by_days: maintenanceCycleByDays ?? undefined,
        });
      }
      setLedgerOpen(false);
      messageApi.success(t('app.haoligo.equipment.documents.acceptance.ledgerSuccess'));
    });

  const renderHistoryRound = (round: EquipmentAcceptanceRoundRow) => (
    <Card
      key={round.id}
      size="small"
      title={t('app.haoligo.equipment.documents.acceptance.roundTitle', { round: round.round_no })}
      style={{ marginBottom: 8 }}
    >
      <Descriptions column={2} size="small">
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colCommissioningContent')}>
          {round.commissioning_content || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colCommissioningResult')}>
          {round.commissioning_result || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colTrialResult')}>
          {round.trial_result || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colPassRate')}>
          {formatAcceptancePassRate(calcAcceptancePassRate(round.quantity, round.defect_qty))}
        </Descriptions.Item>
        {(round.commissioning_attachment_file_uuids?.length ?? 0) > 0 ? (
          <Descriptions.Item
            label={t('app.haoligo.equipment.documents.acceptance.colCommissioningAttachments')}
            span={2}
          >
            <MoldAttachmentImagePreview uuids={round.commissioning_attachment_file_uuids} />
          </Descriptions.Item>
        ) : null}
        {(round.trial_attachment_file_uuids?.length ?? 0) > 0 ? (
          <Descriptions.Item
            label={t('app.haoligo.equipment.documents.acceptance.colTrialAttachments')}
            span={2}
          >
            <MoldAttachmentImagePreview uuids={round.trial_attachment_file_uuids} />
          </Descriptions.Item>
        ) : null}
      </Descriptions>
    </Card>
  );

  return (
    <>
      <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.colSheetNo')}>
          {detail.sheet_no || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colWorkflowStatus')}>
          <Tag color={acceptanceWorkflowStatusTagColor(status)}>{workflowLabel(status)}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colEquipmentName')}>
          {detail.equipment_name || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colManufacturer')}>
          {detail.manufacturer_name || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colArrivedAt')}>
          {detail.arrived_at ? formatDateTime(detail.arrived_at, 'YYYY-MM-DD HH:mm') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colInstallLocation')}>
          {detail.install_location || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.documents.acceptance.colCurrentRound')}>
          {detail.current_round}
        </Descriptions.Item>
        <Descriptions.Item label={t('app.haoligo.equipment.ledger.title')}>
          {detail.equipment_asset_code || '—'}
        </Descriptions.Item>
      </Descriptions>

      {(status === 'commissioning' || status === 'draft') && currentRound ? (
        <Card
          size="small"
          title={t('app.haoligo.equipment.documents.acceptance.sectionCommissioning', {
            round: currentRound.round_no,
          })}
          style={{ marginBottom: 16 }}
        >
          <Form layout="vertical">
            <Form.Item
              label={t('app.haoligo.equipment.documents.acceptance.colCommissioningContent')}
              required={commissioningContentRequired(currentRound.round_no)}
            >
              <Input.TextArea
                rows={3}
                value={commissioningContent}
                onChange={(e) => setCommissioningContent(e.target.value)}
                placeholder={
                  commissioningContentRequired(currentRound.round_no)
                    ? t('app.haoligo.equipment.documents.acceptance.commissioningContentPhRequired')
                    : t('app.haoligo.equipment.documents.acceptance.commissioningContentPh')
                }
              />
            </Form.Item>
            <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colCommissioningResult')}>
              <Select
                allowClear
                style={{ width: 240 }}
                options={ACCEPTANCE_RESULT_OPTIONS}
                value={commissioningResult ?? undefined}
                onChange={(v) => setCommissioningResult(v ?? null)}
                placeholder={t('common.select')}
              />
            </Form.Item>
            <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colAttachments')}>
              <SecurePictureCardUpload
                uuids={commissioningAttachmentUuids}
                accept=".jpg,.jpeg,.png,.gif,.webp"
                onUuidsChange={setCommissioningAttachmentUuids}
                customRequest={async (options) => {
                  try {
                    const file = options.file as File;
                    const res: FileUploadResponse = await uploadFile(file, {
                      category: ACCEPTANCE_UPLOAD_CATEGORY,
                    });
                    options.onSuccess?.(res, options.file);
                  } catch (e) {
                    options.onError?.(e instanceof Error ? e : new Error(String(e)));
                  }
                }}
              />
            </Form.Item>
            {canSubmit ? (
              <Form.Item label={t('app.haoligo.equipment.documents.acceptance.notifyUsers')}>
                <Select
                  mode="multiple"
                  showSearch
                  filterOption={false}
                  style={{ width: '100%' }}
                  value={notifyIds}
                  onChange={(v) => setNotifyIds(v)}
                  onSearch={(kw) => {
                    void searchNotifyUsers(kw, commissioningNotifyDefaults).then(setNotifyUserOptions);
                  }}
                  options={notifyUserOptions}
                  placeholder={t('common.select')}
                />
              </Form.Item>
            ) : null}
            <Space wrap>
              <Button loading={busy} onClick={() => void saveCommissioning()}>
                {t('app.haoligo.equipment.documents.acceptance.saveCommissioning')}
              </Button>
              {canSubmit ? (
                <Button type="primary" loading={busy} onClick={() => void submitTrialRequest()}>
                  {t('app.haoligo.equipment.documents.acceptance.submitTrial')}
                </Button>
              ) : null}
            </Space>
          </Form>
        </Card>
      ) : null}

      {(status === 'pending_trial' || status === 'trial_recording') && currentRound ? (
        <Card
          size="small"
          title={t('app.haoligo.equipment.documents.acceptance.sectionTrial', { round: currentRound.round_no })}
          style={{ marginBottom: 16 }}
        >
          {status === 'pending_trial' && canExecute ? (
            <Button
              type="primary"
              loading={busy}
              style={{ marginBottom: 12 }}
              onClick={() =>
                runAction(async () => {
                  await startEquipmentAcceptanceTrial(detail.id);
                  messageApi.success(t('app.haoligo.equipment.documents.acceptance.startTrialSuccess'));
                })
              }
            >
              {t('app.haoligo.equipment.documents.acceptance.startTrial')}
            </Button>
          ) : null}
          {status === 'trial_recording' && canExecute ? (
            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colProductName')}>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colMaterialNo')}>
                    <Input value={materialNo} onChange={(e) => setMaterialNo(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colQuantity')}>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={quantity ?? undefined}
                      onChange={(v) => setQuantity(v ?? null)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colDefectQty')}>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={defectQty ?? undefined}
                      onChange={(v) => setDefectQty(v ?? null)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colPassRate')}>
                    <Typography.Text strong>{passRate}</Typography.Text>
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colDefectReason')}>
                    <Input.TextArea rows={2} value={defectReason} onChange={(e) => setDefectReason(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colRunningTime')}>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={runningTime ?? undefined}
                      onChange={(v) => setRunningTime(v ?? null)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colFaultTime')}>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={faultTime ?? undefined}
                      onChange={(v) => setFaultTime(v ?? null)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colCapacityPerHour')}>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={capacityPerHour ?? undefined}
                      onChange={(v) => setCapacityPerHour(v ?? null)}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colTrialResult')}>
                    <Select
                      allowClear
                      style={{ width: '100%' }}
                      options={ACCEPTANCE_RESULT_OPTIONS}
                      value={trialResult ?? undefined}
                      onChange={(v) => setTrialResult(v ?? null)}
                      placeholder={t('common.select')}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colAttachments')}>
                    <SecurePictureCardUpload
                      uuids={trialAttachmentUuids}
                      accept=".jpg,.jpeg,.png,.gif,.webp"
                      onUuidsChange={setTrialAttachmentUuids}
                      customRequest={async (options) => {
                        try {
                          const file = options.file as File;
                          const res: FileUploadResponse = await uploadFile(file, {
                            category: ACCEPTANCE_UPLOAD_CATEGORY,
                          });
                          options.onSuccess?.(res, options.file);
                        } catch (e) {
                          options.onError?.(e instanceof Error ? e : new Error(String(e)));
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  {canExecute ? (
                    <Form.Item label={t('app.haoligo.equipment.documents.acceptance.trialConclusionNotifyUsers')}>
                      <Select
                        mode="multiple"
                        showSearch
                        filterOption={false}
                        style={{ width: '100%' }}
                        value={notifyIds}
                        onChange={(v) => setNotifyIds(v)}
                        onSearch={(kw) => {
                          void searchNotifyUsers(kw, trialConclusionNotifyDefaults).then(setNotifyUserOptions);
                        }}
                        options={notifyUserOptions}
                        placeholder={t('common.select')}
                      />
                    </Form.Item>
                  ) : null}
                  <Space wrap>
                    <Button loading={busy} onClick={() => void saveTrial()}>
                      {t('app.haoligo.equipment.documents.acceptance.saveTrial')}
                    </Button>
                    <Button type="primary" loading={busy} onClick={() => void submitTrialConclusion()}>
                      {t('app.haoligo.equipment.documents.acceptance.submitTrialConclusion')}
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Form>
          ) : null}
        </Card>
      ) : null}

      {status === 'accepted' && (detail.ledger_action === 'none' || !detail.ledger_action) && canComplete ? (
        <Button type="primary" style={{ marginBottom: 16 }} onClick={() => void openLedgerModal()}>
          {t('app.haoligo.equipment.documents.acceptance.finalizeLedger')}
        </Button>
      ) : null}

      {historyRounds.length ? (
        <>
          <Divider orientation="left">{t('app.haoligo.equipment.documents.acceptance.historyRounds')}</Divider>
          {historyRounds.map(renderHistoryRound)}
        </>
      ) : null}

      <Modal
        {...MODAL_CONFIG}
        title={t('app.haoligo.equipment.documents.acceptance.finalizeLedger')}
        open={ledgerOpen}
        onCancel={() => setLedgerOpen(false)}
        onOk={() => void submitLedger()}
        confirmLoading={busy}
        destroyOnHidden
        width={MODAL_CONFIG.LARGE_WIDTH}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        <Form layout="vertical">
          <Form.Item label={t('app.haoligo.equipment.documents.acceptance.ledgerMode')}>
            <Select
              style={{ width: '100%' }}
              value={ledgerMode}
              onChange={(v) => setLedgerMode(v)}
              options={[
                { label: t('app.haoligo.equipment.documents.acceptance.ledgerModeCreate'), value: 'create' },
                { label: t('app.haoligo.equipment.documents.acceptance.ledgerModeLink'), value: 'link' },
              ]}
            />
          </Form.Item>
          {ledgerMode === 'create' ? (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formAssetCode')} required>
                  <Input
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    placeholder={t('app.haoligo.equipment.ledger.formAssetCodePh')}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formName')} required>
                  <Input
                    value={equipmentName}
                    onChange={(e) => setEquipmentName(e.target.value)}
                    placeholder={t('app.haoligo.equipment.ledger.formNamePh')}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formCategory')} required>
                  <Select
                    showSearch
                    allowClear
                    style={{ width: '100%' }}
                    options={categoryOptions}
                    value={categoryId ?? undefined}
                    onChange={(v) => setCategoryId(v ?? null)}
                    placeholder={t('common.select')}
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formWorkshop')} required>
                  <Select
                    showSearch
                    allowClear
                    style={{ width: '100%' }}
                    options={workshopOptions}
                    value={workshopId ?? undefined}
                    onChange={(v) => setWorkshopId(v ?? null)}
                    placeholder={t('common.select')}
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formManufacturer')}>
                  <ManufacturerSelect
                    noStyle
                    value={manufacturerId}
                    onChange={setManufacturerId}
                    quickCreatePopoverZIndex={2100}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formPlan')}>
                  <Select
                    mode="multiple"
                    showSearch
                    allowClear
                    style={{ width: '100%' }}
                    options={paramSetOptions}
                    value={inspectionParamSetIds}
                    onChange={(v) => setInspectionParamSetIds(v)}
                    placeholder={t('common.select')}
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="保养方案">
                  <Select
                    showSearch
                    allowClear
                    style={{ width: '100%' }}
                    options={upkeepSetOptions}
                    value={upkeepParamSetId ?? undefined}
                    onChange={(v) => setUpkeepParamSetId(v ?? null)}
                    placeholder={t('common.select')}
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formCriticality')}>
                  <Select
                    allowClear
                    showSearch
                    style={{ width: '100%' }}
                    options={criticalitySelectOptions}
                    value={criticality ?? undefined}
                    onChange={(v) => setCriticality(v ?? null)}
                    placeholder={t('common.select')}
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formOperationalStatus')}>
                  <DictionarySelect
                    noStyle
                    dictionaryCode={HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT}
                    value={operationalStatus ?? undefined}
                    onChange={(v) => setOperationalStatus(v != null && v !== '' ? String(v) : null)}
                    placeholder={t('app.haoligo.equipment.ledger.formOperationalStatusPh')}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formManufactureDate')}>
                  <DatePicker
                    style={{ width: '100%' }}
                    value={manufactureDate}
                    onChange={(v) => setManufactureDate(v)}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="保养周期(依产量)">
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    value={maintenanceCycleByYield ?? undefined}
                    onChange={(v) => setMaintenanceCycleByYield(v ?? null)}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="保养周期(依天数)">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                    value={maintenanceCycleByDays ?? undefined}
                    onChange={(v) => setMaintenanceCycleByDays(v ?? null)}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formEquipmentImages')}>
                  <SecurePictureCardUpload
                    uuids={ledgerImageUuids}
                    accept=".jpg,.jpeg,.png,.gif,.webp"
                    onUuidsChange={setLedgerImageUuids}
                    customRequest={async (options) => {
                      try {
                        const file = options.file as File;
                        const res: FileUploadResponse = await uploadFile(file, {
                          category: EQUIPMENT_LEDGER_UPLOAD_CATEGORY,
                        });
                        options.onSuccess?.(res, options.file);
                      } catch (e) {
                        options.onError?.(e instanceof Error ? e : new Error(String(e)));
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label={t('app.haoligo.equipment.ledger.formRemark')}>
                  <Input.TextArea
                    rows={3}
                    value={ledgerRemark}
                    onChange={(e) => setLedgerRemark(e.target.value)}
                  />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Form.Item label={t('app.haoligo.equipment.documents.acceptance.colLinkedEquipment')} required>
              <Select
                showSearch
                style={{ width: '100%' }}
                options={equipmentOptions}
                value={linkEquipmentId ?? undefined}
                onChange={(v) => setLinkEquipmentId(v ?? null)}
                placeholder={t('common.select')}
                optionFilterProp="label"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
};

export default AcceptanceDetailPanel;
