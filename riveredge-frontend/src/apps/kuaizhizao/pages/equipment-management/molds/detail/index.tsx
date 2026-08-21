/**
 * 模具详情页（独立标签：基本信息 / 领还流水 / 校验 / 运营单据）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ProDescriptions,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  Upload,
  DatePicker,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined, QrcodeOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { moldApi } from '../../../../services/equipment';
import {
  maintenanceSchemesApi,
  moldReportsApi,
  repairSchemesApi,
  schemeBindingsApi,
} from '../../../../services/moldOps';
import {
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  MODAL_CONFIG,
  MultiTabListPageTemplate,
} from '../../../../../../components/layout-templates';
import { QRCodeGenerator } from '../../../../../../components/qrcode';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../../components/custom-fields';
import { useCustomFieldsForList } from '../../../../../../hooks/useCustomFieldsForList';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { FutureDatePicker } from '../../../../../../utils/futureDatePickerShortcuts';
import { uploadMultipleFiles } from '../../../../../../services/file';
import { normalizeDocumentAttachments } from '../../../../utils/documentAttachments';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { renderIsActiveTag } from '../../shared/equipmentMasterDataDetail';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../../../../utils/format';
import { renderDocumentStatusTag } from '../../../../../../utils/documentLifecycleStatusTag';
import { toApiDateString } from '../../../../../../utils/formDate';
import { useLeaveFormTab, navigateClosingTab, uniTabKey } from '../../../../../../components/uni-tabs/navigateClosingTab';
import {
  KUAIZHIZAO_MOLD_LIST_PATH,
  resolveMoldDetailTabKey,
} from '../moldPaths';

const MOLD_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_molds';

interface MoldDetail {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  status?: string;
  is_active?: boolean;
  description?: string;
  total_usage_count?: number;
  cavity_count?: number;
  design_lifetime?: number;
  maintenance_interval?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  last_calibration_date?: string;
  next_calibration_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface MoldBorrowReturnLog {
  log_type?: string;
  document_no?: string;
  event_date?: string;
  usage_count?: number | null;
  operator_name?: string;
  status?: string;
}

interface MoldCalibration {
  uuid?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
}

function moldStatusTag(
  status: string | undefined,
  t: (key: string) => string,
): { text: string; color: string } {
  const statusMap: Record<string, { text: string; color: string }> = {
    正常: { text: t('app.kuaizhizao.mold.statusNormal'), color: 'success' },
    使用中: { text: t('app.kuaizhizao.mold.statusInUse'), color: 'processing' },
    维护中: { text: t('app.kuaizhizao.mold.statusMaintaining'), color: 'warning' },
    停用: { text: t('app.kuaizhizao.mold.statusDisabled'), color: 'default' },
    报废: { text: t('app.kuaizhizao.mold.statusScrapped'), color: 'error' },
  };
  return statusMap[status ?? ''] ?? { text: status ?? '-', color: 'default' };
}

const MoldDetailPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions('kuaizhizao:equipment-management-molds');
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();

  const activeTab = resolveMoldDetailTabKey(searchParams.get('tab'));

  const [loading, setLoading] = useState(true);
  const [mold, setMold] = useState<MoldDetail | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  const [borrowReturnLogs, setBorrowReturnLogs] = useState<MoldBorrowReturnLog[]>([]);
  const [borrowReturnLogsLoading, setBorrowReturnLogsLoading] = useState(false);
  const [calibrations, setCalibrations] = useState<MoldCalibration[]>([]);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  const [boundMaintenanceSchemeIds, setBoundMaintenanceSchemeIds] = useState<number[]>([]);
  const [boundRepairSchemeIds, setBoundRepairSchemeIds] = useState<number[]>([]);
  const [maintenanceSchemeOptions, setMaintenanceSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [repairSchemeOptions, setRepairSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [schemeBindingsSaving, setSchemeBindingsSaving] = useState(false);

  const {
    customFields: moldListCustomFields,
    customFieldValues: moldDetailCustomFieldValues,
    loadFieldValuesForDetail: loadMoldFieldValuesForDetail,
    resetDetailFieldValues: resetMoldDetailFieldValues,
  } = useCustomFieldsForList<MoldDetail>({ tableName: MOLD_CUSTOM_FIELD_TABLE });

  const moldTracking = useDocumentTracking(mold?.id ? 'mold' : undefined, mold?.id, trackingRefreshKey);

  const loadPageData = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const detail = await moldApi.get(uuid);
      setMold(detail);
      setTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadMoldFieldValuesForDetail(detail.id);
        setBorrowReturnLogsLoading(true);
        setCalibLoading(true);
        const [maintRes, repairRes, maintBindings, repairBindings, logsRes, calibRes] = await Promise.all([
          maintenanceSchemesApi.list({ limit: 1000, is_active: true }),
          repairSchemesApi.list({ limit: 1000, is_active: true }),
          schemeBindingsApi.list({ mold_id: detail.id, scheme_type: 'maintenance' }),
          schemeBindingsApi.list({ mold_id: detail.id, scheme_type: 'repair' }),
          moldReportsApi.borrowReturnLog({ mold_id: detail.id, skip: 0, limit: 100 }),
          moldApi.listCalibrations({ mold_uuid: uuid, limit: 100 }),
        ]);
        setMaintenanceSchemeOptions(
          (maintRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
            label: `${s.code} - ${s.name}`,
            value: s.id,
          })),
        );
        setRepairSchemeOptions(
          (repairRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
            label: `${s.code} - ${s.name}`,
            value: s.id,
          })),
        );
        setBoundMaintenanceSchemeIds(
          (maintBindings.items ?? maintBindings.bindings ?? []).map((b: { scheme_id: number }) => b.scheme_id),
        );
        setBoundRepairSchemeIds(
          (repairBindings.items ?? repairBindings.bindings ?? []).map((b: { scheme_id: number }) => b.scheme_id),
        );
        setBorrowReturnLogs(logsRes.items || []);
        setCalibrations(calibRes.items || []);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('app.kuaizhizao.mold.getDetailFailed'));
    } finally {
      setBorrowReturnLogsLoading(false);
      setCalibLoading(false);
      setLoading(false);
    }
  }, [uuid, loadMoldFieldValuesForDetail, messageApi, t]);

  useEffect(() => {
    void loadPageData();
    return () => {
      resetMoldDetailFieldValues();
    };
  }, [loadPageData, resetMoldDetailFieldValues]);

  const detailColumns: ProDescriptionsItemProps<MoldDetail>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.mold.colCode'), dataIndex: 'code' },
      { title: t('app.kuaizhizao.mold.colName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.mold.colType'), dataIndex: 'type' },
      { title: t('app.kuaizhizao.mold.colCategory'), dataIndex: 'category' },
      { title: t('app.kuaizhizao.mold.colBrand'), dataIndex: 'brand' },
      { title: t('app.kuaizhizao.mold.colModel'), dataIndex: 'model' },
      { title: t('app.kuaizhizao.mold.colSerialNumber'), dataIndex: 'serial_number' },
      { title: t('app.kuaizhizao.mold.colManufacturer'), dataIndex: 'manufacturer' },
      { title: t('app.kuaizhizao.mold.colSupplier'), dataIndex: 'supplier' },
      { title: t('app.kuaizhizao.mold.colPurchaseDate'), dataIndex: 'purchase_date', valueType: 'date' },
      { title: t('app.kuaizhizao.mold.colInstallationDate'), dataIndex: 'installation_date', valueType: 'date' },
      { title: t('app.kuaizhizao.mold.colWarrantyPeriod'), dataIndex: 'warranty_period' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, record) => {
          const mapped = moldStatusTag(record.status, t);
          return <MarkerTag color={mapped.color}>{mapped.text}</MarkerTag>;
        },
      },
      {
        title: t('app.kuaizhizao.mold.colIsActive'),
        dataIndex: 'is_active',
        render: (_, record) => renderIsActiveTag(t, record.is_active),
      },
      { title: t('app.kuaizhizao.mold.colCavityCount'), dataIndex: 'cavity_count' },
      { title: t('app.kuaizhizao.mold.colDesignLifetime'), dataIndex: 'design_lifetime' },
      { title: t('app.kuaizhizao.mold.colTotalUsageCount'), dataIndex: 'total_usage_count' },
      { title: t('app.kuaizhizao.mold.colMaintenanceInterval'), dataIndex: 'maintenance_interval' },
      {
        title: t('app.kuaizhizao.mold.colNeedsCalibration'),
        dataIndex: 'needs_calibration',
        render: (_, record) => (record.needs_calibration ? t('common.yes') : t('common.no')),
      },
      { title: t('app.kuaizhizao.mold.colCalibrationPeriod'), dataIndex: 'calibration_period' },
      { title: t('app.kuaizhizao.mold.colLastCalibrationDate'), dataIndex: 'last_calibration_date', valueType: 'date' },
      { title: t('app.kuaizhizao.mold.colNextCalibrationDate'), dataIndex: 'next_calibration_date', valueType: 'date' },
      { title: t('common.remark'), dataIndex: 'description', span: 2 },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t],
  );

  const borrowReturnLogColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docNo'), dataIndex: 'document_no', width: 140 },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docType'),
        dataIndex: 'log_type',
        width: 90,
        render: (v: string) =>
          v === 'borrow'
            ? t('app.kuaizhizao.menu.equipment-management.mold-borrows')
            : v === 'return'
              ? t('app.kuaizhizao.menu.equipment-management.mold-returns')
              : v || '-',
      },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docDate'),
        dataIndex: 'event_date',
        width: 110,
        render: (v: string) => (v ? formatDateTimeBySiteSetting(v) : '-'),
      },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.usageCount'),
        dataIndex: 'usage_count',
        width: 80,
        render: (v: number | null) => (v == null ? '-' : v),
      },
      {
        title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.borrower'),
        dataIndex: 'operator_name',
        width: 90,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (s: string) => renderDocumentStatusTag(s || '-', s),
      },
    ],
    [t],
  );

  const calibrationTableColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.mold.colCalibrationDate'),
        dataIndex: 'calibration_date',
        width: 120,
        render: (v: string) => (v ? formatDateBySiteSetting(v) : '-'),
      },
      {
        title: t('app.kuaizhizao.mold.colResult'),
        dataIndex: 'result',
        width: 100,
        render: (r: string) => renderDocumentStatusTag(r || '-', r),
      },
      { title: t('app.kuaizhizao.mold.colCertificateNo'), dataIndex: 'certificate_no', width: 140 },
      {
        title: t('app.kuaizhizao.mold.colExpiryDate'),
        dataIndex: 'expiry_date',
        width: 120,
        render: (v: string) => (v ? formatDateBySiteSetting(v) : '-'),
      },
      { title: t('common.remark'), dataIndex: 'remark', ellipsis: true },
    ],
    [t],
  );

  const moldCalibrationResultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.mold.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.mold.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.mold.resultApproved'), value: '准用' },
    ],
    [t],
  );

  const handleRecordCalibration = () => {
    if (!mold?.uuid) return;
    calibForm.resetFields();
    calibForm.setFieldsValue({ mold_uuid: mold.uuid, calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  };

  const handleSubmitCalibration = async () => {
    try {
      const moldUuid = mold?.uuid;
      if (!moldUuid) {
        messageApi.error(t('app.kuaizhizao.mold.noMoldSelected'));
        return;
      }
      const values = await calibForm.validateFields();
      await moldApi.createCalibration({
        mold_uuid: moldUuid,
        calibration_date: toApiDateString(values.calibration_date) ?? values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: toApiDateString(values.expiry_date) ?? values.expiry_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.mold.calibrationSaved'));
      setCalibModalVisible(false);
      const [fresh, calibRes] = await Promise.all([
        moldApi.get(moldUuid),
        moldApi.listCalibrations({ mold_uuid: moldUuid, limit: 100 }),
      ]);
      setMold(fresh);
      setCalibrations(calibRes.items || []);
      setTrackingRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const err = e as { errorFields?: unknown; message?: string };
      if (err?.errorFields) return;
      messageApi.error(err?.message || t('common.saveFailed'));
    }
  };

  useSubmitShortcut(handleSubmitCalibration, calibModalVisible);

  const lifetimeAlerts = useMemo(() => {
    if (!mold) return null;
    const alerts: React.ReactNode[] = [];
    if (mold.design_lifetime && mold.design_lifetime > 0) {
      const total = mold.total_usage_count ?? 0;
      const threshold = mold.design_lifetime * 0.9;
      if (total >= mold.design_lifetime) {
        alerts.push(
          <MarkerTag key="lifetime-expired" color="error">
            {t('app.kuaizhizao.mold.lifetimeExpired')}
          </MarkerTag>,
        );
      } else if (total >= threshold) {
        alerts.push(
          <MarkerTag key="lifetime-expiring" color="warning">
            {t('app.kuaizhizao.mold.lifetimeExpiring')}
          </MarkerTag>,
        );
      }
    }
    if (mold.maintenance_interval && mold.maintenance_interval > 0) {
      const total = mold.total_usage_count ?? 0;
      const nextAt = (Math.floor(total / mold.maintenance_interval) + 1) * mold.maintenance_interval;
      const left = nextAt - total;
      if (left > 0 && left <= mold.maintenance_interval * 0.2) {
        alerts.push(
          <MarkerTag key="maint-due" color="warning">
            {t('app.kuaizhizao.mold.maintenanceDueSoon', { count: left })}
          </MarkerTag>,
        );
      }
    }
    if (mold.needs_calibration && mold.next_calibration_date) {
      const daysLeft = dayjs(mold.next_calibration_date).diff(dayjs(), 'day');
      if (daysLeft < 0) {
        alerts.push(
          <MarkerTag key="calib-expired" color="error">
            {t('app.kuaizhizao.mold.calibrationExpired')}
          </MarkerTag>,
        );
      } else if (daysLeft <= 7) {
        alerts.push(
          <MarkerTag key="calib-expiring" color="warning">
            {t('app.kuaizhizao.mold.calibrationExpiringSoon', { days: daysLeft })}
          </MarkerTag>,
        );
      }
    }
    if (alerts.length === 0) return null;
    return <Space wrap>{alerts}</Space>;
  }, [mold, t]);

  const tabItems = useMemo(() => {
    if (!mold) return [];
    return [
      {
        key: 'info',
        label: t('app.kuaizhizao.mold.detailTabInfo'),
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" title={t('app.uniDetail.sectionBasic')}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ProDescriptions<MoldDetail> dataSource={mold} column={3} columns={detailColumns} />
                </div>
                {mold.uuid ? (
                  <div
                    style={{
                      flex: '0 0 168px',
                      width: 168,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {t('app.kuaizhizao.mold.qrcodeCardTitle')}
                    </Typography.Text>
                    <QRCodeGenerator
                      qrcodeType="MD"
                      data={{
                        mold_uuid: mold.uuid,
                        mold_code: mold.code || '',
                        mold_name: mold.name || '',
                      }}
                      autoGenerate
                      size={6}
                      noCard
                    />
                  </div>
                ) : null}
              </div>
            </Card>
            {lifetimeAlerts}
            {hasCustomFieldsDetailContent(moldListCustomFields, moldDetailCustomFieldValues) ? (
              <Card size="small" title={t('app.master-data.customFields')}>
                <CustomFieldsDetailSection
                  customFields={moldListCustomFields}
                  customFieldValues={moldDetailCustomFieldValues}
                />
              </Card>
            ) : null}
            <Card size="small" title={t('app.kuaizhizao.moldOps.schemeBindings.title')}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary">{t('app.kuaizhizao.moldOps.schemeBindings.maintenance')}</Typography.Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder={t('app.kuaizhizao.moldOps.schemeBindings.selectMaintenanceSchemes')}
                  options={maintenanceSchemeOptions}
                  value={boundMaintenanceSchemeIds}
                  onChange={setBoundMaintenanceSchemeIds}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary">{t('app.kuaizhizao.moldOps.schemeBindings.repair')}</Typography.Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder={t('app.kuaizhizao.moldOps.schemeBindings.selectRepairSchemes')}
                  options={repairSchemeOptions}
                  value={boundRepairSchemeIds}
                  onChange={setBoundRepairSchemeIds}
                />
              </div>
              <Button
                type="primary"
                loading={schemeBindingsSaving}
                disabled={mold.id == null}
                onClick={async () => {
                  if (mold.id == null) return;
                  setSchemeBindingsSaving(true);
                  try {
                    await schemeBindingsApi.bulkReplace({
                      mold_id: mold.id,
                      scheme_type: 'maintenance',
                      scheme_ids: boundMaintenanceSchemeIds,
                    });
                    await schemeBindingsApi.bulkReplace({
                      mold_id: mold.id,
                      scheme_type: 'repair',
                      scheme_ids: boundRepairSchemeIds,
                    });
                    messageApi.success(t('app.kuaizhizao.moldOps.schemeBindings.saveSuccess'));
                  } catch (error: unknown) {
                    const err = error as { message?: string };
                    messageApi.error(err?.message || t('common.operationFailed'));
                  } finally {
                    setSchemeBindingsSaving(false);
                  }
                }}
              >
                {t('common.save')}
              </Button>
            </Card>
            <Card size="small" title={t('app.uniDetail.sectionTimeline')}>
              {moldTracking.loading ? <Spin /> : null}
              {moldTracking.error && !moldTracking.loading ? (
                <Typography.Text type="danger">{moldTracking.error}</Typography.Text>
              ) : null}
              {moldTracking.data && !moldTracking.loading ? (
                <DocumentTrackingTimelineBody data={moldTracking.data} />
              ) : null}
              {!moldTracking.loading && !moldTracking.data && !moldTracking.error ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.mold.noTimeline')} />
              ) : null}
            </Card>
          </div>
        ),
      },
      {
        key: 'borrow_return',
        label: t('app.kuaizhizao.menu.reports.mold-borrow-return-log'),
        children: (
          <>
            <div style={{ marginBottom: 12 }}>
              <Space wrap>
                <Link to="/apps/kuaizhizao/equipment-management/mold-borrows">
                  <Button type="primary">{t('app.kuaizhizao.menu.equipment-management.mold-borrows')}</Button>
                </Link>
                <Link to="/apps/kuaizhizao/equipment-management/mold-returns">
                  <Button>{t('app.kuaizhizao.menu.equipment-management.mold-returns')}</Button>
                </Link>
              </Space>
            </div>
            <Table<MoldBorrowReturnLog>
              size="small"
              loading={borrowReturnLogsLoading}
              dataSource={borrowReturnLogs}
              rowKey={(row, index) => `${row.log_type}-${row.document_no}-${index}`}
              pagination={false}
              columns={borrowReturnLogColumns}
              scroll={{ x: true }}
            />
          </>
        ),
      },
      {
        key: 'calibrations',
        label: t('app.kuaizhizao.mold.tabCalibrations'),
        children: (
          <>
            <div style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleRecordCalibration}>
                {t('app.kuaizhizao.mold.createCalibration')}
              </Button>
            </div>
            <Table<MoldCalibration>
              size="small"
              loading={calibLoading}
              dataSource={calibrations}
              rowKey="uuid"
              pagination={false}
              columns={calibrationTableColumns}
              scroll={{ x: true }}
            />
          </>
        ),
      },
      {
        key: 'ops',
        label: t('app.kuaizhizao.moldOps.opsLinks.title'),
        children: (
          <Space wrap>
            <Link to="/apps/kuaizhizao/equipment-management/mold-borrows">
              <Button>{t('app.kuaizhizao.menu.equipment-management.mold-borrows')}</Button>
            </Link>
            <Link to="/apps/kuaizhizao/equipment-management/mold-trials">
              <Button>{t('app.kuaizhizao.menu.equipment-management.mold-trials')}</Button>
            </Link>
            <Link to="/apps/kuaizhizao/equipment-management/mold-maintenances">
              <Button>{t('app.kuaizhizao.menu.equipment-management.mold-maintenances')}</Button>
            </Link>
            <Link to="/apps/kuaizhizao/equipment-management/mold-repairs">
              <Button>{t('app.kuaizhizao.menu.equipment-management.mold-repairs')}</Button>
            </Link>
          </Space>
        ),
      },
    ];
  }, [
    mold,
    t,
    detailColumns,
    lifetimeAlerts,
    moldListCustomFields,
    moldDetailCustomFieldValues,
    maintenanceSchemeOptions,
    repairSchemeOptions,
    boundMaintenanceSchemeIds,
    boundRepairSchemeIds,
    schemeBindingsSaving,
    moldTracking,
    borrowReturnLogsLoading,
    borrowReturnLogs,
    borrowReturnLogColumns,
    calibLoading,
    calibrations,
    calibrationTableColumns,
    messageApi,
  ]);

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'info' ? {} : { tab: key }, { replace: true });
  };

  const leavePage = useLeaveFormTab(KUAIZHIZAO_MOLD_LIST_PATH);

  const pageTitle = mold
    ? `${mold.code ?? ''} ${mold.name ?? ''}`.trim() || t('app.kuaizhizao.mold.detail')
    : t('app.kuaizhizao.mold.detail');
  const statusTag = mold?.status ? moldStatusTag(mold.status, t) : null;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: {
          key: location.pathname + location.search,
          path: location.pathname,
          title: pageTitle,
        },
      }),
    );
  }, [pageTitle, location.pathname, location.search]);

  const fallbackTabs = useMemo(
    () => [
      {
        key: 'info',
        label: t('app.kuaizhizao.mold.detailTabInfo'),
        children: (
          <div style={{ padding: 48, textAlign: 'center' }}>
            {loading ? <Spin size="large" /> : <Empty description={t('app.kuaizhizao.mold.getDetailFailed')} />}
          </div>
        ),
      },
    ],
    [loading, t],
  );

  const tabs = mold && tabItems.length > 0 ? tabItems : fallbackTabs;

  if (!uuid) {
    return (
      <MultiTabListPageTemplate
        activeTabKey="info"
        onTabChange={() => undefined}
        tabs={[
          {
            key: 'info',
            label: t('app.kuaizhizao.mold.detailTabInfo'),
            children: <Empty description={t('app.kuaizhizao.mold.uuidNotFound')} />,
          },
        ]}
      />
    );
  }

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTab}
        onTabChange={handleTabChange}
        header={
          <div style={{ ...DOCUMENT_DETAIL_PAGE_HEADER_STYLE, marginBottom: 0 }}>
            <Space align="center" size={8}>
              <Button type="text" icon={<ArrowLeftOutlined />} aria-label={t('common.back')} onClick={leavePage} />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {pageTitle}
              </Typography.Title>
              {statusTag ? <MarkerTag color={statusTag.color}>{statusTag.text}</MarkerTag> : null}
            </Space>
            <Space wrap>
              <Button onClick={leavePage}>{t('common.back')}</Button>
              {perms.canPrint && mold?.uuid ? (
                <Button
                  icon={<QrcodeOutlined />}
                  onClick={() =>
                    openPrint({
                      documentType: 'mold_card',
                      documentId: mold.id ?? 1,
                      printApiPath: `/apps/kuaizhizao/molds/${mold.uuid}/print`,
                      pdfDownloadFilename: `mold-card-${mold.code || mold.uuid}.pdf`,
                    })
                  }
                >
                  {t('app.kuaizhizao.mold.printMoldCard')}
                </Button>
              ) : null}
              {mold?.uuid && perms.canUpdate ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() =>
                    navigateClosingTab(
                      navigate,
                      KUAIZHIZAO_MOLD_LIST_PATH,
                      uniTabKey(location.pathname, location.search),
                      { openEditUuid: mold.uuid },
                    )
                  }
                >
                  {t('common.edit')}
                </Button>
              ) : null}
            </Space>
          </div>
        }
        tabs={tabs}
      />

      {PrintModal}

      <Modal
        title={t('app.kuaizhizao.mold.createCalibration')}
        open={calibModalVisible}
        onOk={handleSubmitCalibration}
        okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT}
        onCancel={() => setCalibModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_uuid" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="calibration_date" label={t('app.kuaizhizao.mold.calibrationDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('app.kuaizhizao.mold.calibrationResult')} rules={[{ required: true }]}>
            <Select options={moldCalibrationResultOptions} />
          </Form.Item>
          <Form.Item name="certificate_no" label={t('app.kuaizhizao.mold.certificateNo')}>
            <Input placeholder={t('app.kuaizhizao.mold.phCertificateNo')} />
          </Form.Item>
          <Form.Item name="expiry_date" label={t('app.kuaizhizao.mold.expiryDate')}>
            <FutureDatePicker getForm={() => calibForm} baseFieldName="calibration_date" t={t} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.mold.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'mold_calibration_attachments',
                });
                options.onSuccess?.(res[0], options.file as File);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.mold.upload')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label={t('common.remark')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.mold.phRemark')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MoldDetailPage;
