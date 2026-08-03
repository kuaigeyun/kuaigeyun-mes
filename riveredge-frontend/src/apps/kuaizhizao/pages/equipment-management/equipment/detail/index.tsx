/**
 * 设备详情页（Tab 联动点检/巡检/报修/保养/备件/报废）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  Tag,
  Typography,
  Upload,
  DatePicker,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, QrcodeOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { equipmentApi } from '../../../../services/equipment';
import { inspectionSchemesApi, schemeBindingsApi } from '../../../../services/equipmentOps';
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
import { SecureImage } from '../../../../../../components/secure-image';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../../utils/globalSubmitShortcut';
import { useKuaizhizaoPrintModal } from '../../../../hooks/useKuaizhizaoPrintModal';
import {
  buildEquipmentDetailTabItems,
  resolveEquipmentDetailTabKey,
  useEquipmentTraceColumns,
  type EquipmentTraceData,
} from '../equipmentTraceTabs';
import { KUAIZHIZAO_EQUIPMENT_LIST_PATH } from '../equipmentPaths';

const EQUIPMENT_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_equipment';

function equipmentStatusTag(
  status: string | undefined,
  t: (key: string) => string,
): { text: string; color: string } {
  const statusMap: Record<string, { text: string; color: string }> = {
    正常: { text: t('app.kuaizhizao.equipment.statusNormal'), color: 'success' },
    运行中: { text: t('app.kuaizhizao.equipment.statusRunning'), color: 'processing' },
    待机: { text: t('app.kuaizhizao.equipment.statusStandby'), color: 'default' },
    故障: { text: t('app.kuaizhizao.equipment.statusFault'), color: 'error' },
    维修中: { text: t('app.kuaizhizao.equipment.statusRepairing'), color: 'warning' },
    停用: { text: t('app.kuaizhizao.equipment.statusDisabled'), color: 'default' },
    校验中: { text: t('app.kuaizhizao.equipment.statusCalibrating'), color: 'processing' },
    报废: { text: t('app.kuaizhizao.equipment.statusScrapped'), color: 'error' },
  };
  return statusMap[status ?? ''] ?? { text: status ?? '-', color: 'default' };
}

interface EquipmentDetail {
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
  workshop_id?: number;
  workshop_name?: string;
  production_line_id?: number;
  production_line_code?: string;
  production_line_name?: string;
  equipment_nature?: string;
  workstation_id?: number;
  workstation_name?: string;
  work_center_id?: number;
  work_center_name?: string;
  responsible_person_id?: number;
  responsible_person_name?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
  photo_file_uuid?: string | null;
  created_at?: string;
  updated_at?: string;
}

const EquipmentDetailPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const equipmentPerms = useResourcePermissions('kuaizhizao:equipment-management-equipment');
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();

  const activeTab = resolveEquipmentDetailTabKey(searchParams.get('tab'));

  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [traceData, setTraceData] = useState<EquipmentTraceData | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  const [boundSchemeIds, setBoundSchemeIds] = useState<number[]>([]);
  const [schemeSelectOptions, setSchemeSelectOptions] = useState<{ label: string; value: number }[]>([]);
  const [schemeBindingsSaving, setSchemeBindingsSaving] = useState(false);

  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  const {
    customFields: equipmentListCustomFields,
    customFieldValues: equipmentDetailCustomFieldValues,
    loadFieldValuesForDetail: loadEquipmentFieldValuesForDetail,
    resetDetailFieldValues: resetEquipmentDetailFieldValues,
  } = useCustomFieldsForList<EquipmentDetail>({ tableName: EQUIPMENT_CUSTOM_FIELD_TABLE });

  const equipmentTracking = useDocumentTracking(
    equipment?.id ? 'equipment' : undefined,
    equipment?.id,
    trackingRefreshKey,
  );

  const traceColumns = useEquipmentTraceColumns(t);

  const loadPageData = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const [detail, trace] = await Promise.all([equipmentApi.get(uuid), equipmentApi.getTrace(uuid)]);
      setEquipment(detail);
      setTraceData(trace);
      setTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadEquipmentFieldValuesForDetail(detail.id);
        const [bindings, schemesRes] = await Promise.all([
          schemeBindingsApi.list({ equipment_id: detail.id, scheme_type: 'spot_check' }),
          inspectionSchemesApi.list({ limit: 1000, is_active: true }),
        ]);
        setBoundSchemeIds((bindings ?? []).map((b: { scheme_id: number }) => b.scheme_id));
        setSchemeSelectOptions(
          (schemesRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
            label: `${s.code} - ${s.name}`,
            value: s.id,
          })),
        );
      } else {
        setBoundSchemeIds([]);
        setSchemeSelectOptions([]);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.equipment.getDetailFailed'));
    } finally {
      setLoading(false);
    }
  }, [uuid, loadEquipmentFieldValuesForDetail, messageApi, t]);

  useEffect(() => {
    void loadPageData();
    return () => {
      resetEquipmentDetailFieldValues();
    };
  }, [loadPageData, resetEquipmentDetailFieldValues]);

  const detailColumns: ProDescriptionsItemProps<EquipmentDetail>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.equipment.colCode'), dataIndex: 'code' },
      { title: t('app.kuaizhizao.equipment.colName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.equipment.colType'), dataIndex: 'type' },
      { title: t('app.kuaizhizao.equipment.colCategory'), dataIndex: 'category' },
      { title: t('app.kuaizhizao.equipment.colEquipmentNature'), dataIndex: 'equipment_nature' },
      { title: t('app.kuaizhizao.equipment.colBrand'), dataIndex: 'brand' },
      { title: t('app.kuaizhizao.equipment.colModel'), dataIndex: 'model' },
      {
        title: t('app.kuaizhizao.equipment.colSerialNumber'),
        dataIndex: 'serial_number',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.serial_number ?? '') }}>{r.serial_number ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.equipment.colManufacturer'), dataIndex: 'manufacturer' },
      { title: t('app.kuaizhizao.equipment.colSupplier'), dataIndex: 'supplier' },
      { title: t('app.kuaizhizao.equipment.colPurchaseDate'), dataIndex: 'purchase_date', valueType: 'date' },
      { title: t('app.kuaizhizao.equipment.colInstallationDate'), dataIndex: 'installation_date', valueType: 'date' },
      { title: t('app.kuaizhizao.equipment.colWarrantyPeriod'), dataIndex: 'warranty_period' },
      { title: t('app.kuaizhizao.equipment.colWorkshop'), dataIndex: 'workshop_name' },
      { title: t('app.kuaizhizao.equipment.colProductionLine'), dataIndex: 'production_line_name' },
      { title: t('app.kuaizhizao.equipment.colWorkstation'), dataIndex: 'workstation_name' },
      { title: t('app.kuaizhizao.equipment.colWorkCenter'), dataIndex: 'work_center_name' },
      { title: t('app.kuaizhizao.equipment.colResponsiblePerson'), dataIndex: 'responsible_person_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, record) => {
          const mapped = equipmentStatusTag(record.status, t);
          return <Tag color={mapped.color}>{mapped.text}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.equipment.colIsActive'),
        dataIndex: 'is_active',
        render: (_, record) => (
          <Tag color={record.is_active ? 'success' : 'default'}>
            {record.is_active ? t('app.kuaizhizao.equipment.isActiveEnabled') : t('app.kuaizhizao.equipment.isActiveDisabled')}
          </Tag>
        ),
      },
      { title: t('app.kuaizhizao.equipment.fieldDescription'), dataIndex: 'description', span: 2 },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t],
  );

  const calibrationResultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.equipment.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.equipment.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.equipment.resultRestricted'), value: '限制使用' },
    ],
    [t],
  );

  const handleCreateCalibration = () => {
    calibForm.resetFields();
    calibForm.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  };

  const handleSubmitCalibration = async () => {
    try {
      const values = await calibForm.validateFields();
      if (!uuid) return;
      await equipmentApi.createCalibration(uuid, {
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.equipment.calibrationSaved'));
      setCalibModalVisible(false);
      const refreshed = await equipmentApi.getTrace(uuid);
      setTraceData(refreshed);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('common.saveFailed'));
    }
  };

  useSubmitShortcut(handleSubmitCalibration, calibModalVisible);

  const opsTabItems = useMemo(() => {
    if (!traceData) return [];
    return buildEquipmentDetailTabItems({
      t,
      traceData,
      columns: traceColumns,
      onCreateCalibration: handleCreateCalibration,
      onNavigateOps: (path) => navigate(path),
    });
  }, [traceData, t, traceColumns, navigate]);

  const tabItems = useMemo(() => {
    if (!equipment) return [];
    const infoTab = {
      key: 'info',
      label: t('app.kuaizhizao.equipment.detailTabInfo'),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card size="small" title={t('app.uniDetail.sectionBasic')}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div
                style={{
                  flex: '0 0 120px',
                  width: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('app.kuaizhizao.equipment.fieldPhoto')}
                </Typography.Text>
                {equipment.photo_file_uuid ? (
                  <SecureImage
                    fileUuid={equipment.photo_file_uuid}
                    alt={equipment.name || t('app.kuaizhizao.equipment.fieldPhoto')}
                    width={120}
                    height={120}
                    style={{ objectFit: 'cover', borderRadius: 8 }}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('app.kuaizhizao.equipment.noPhoto')}
                    style={{ margin: 0 }}
                    imageStyle={{ height: 48 }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ProDescriptions<EquipmentDetail> dataSource={equipment} column={3} columns={detailColumns} />
              </div>
              {equipment.uuid ? (
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
                    {t('app.kuaizhizao.equipment.qrcodeCardTitle')}
                  </Typography.Text>
                  <QRCodeGenerator
                    qrcodeType="EQ"
                    data={{
                      equipment_uuid: equipment.uuid,
                      equipment_code: equipment.code || '',
                      equipment_name: equipment.name || '',
                    }}
                    autoGenerate
                    size={6}
                    noCard
                  />
                </div>
              ) : null}
            </div>
          </Card>
          {hasCustomFieldsDetailContent(equipmentListCustomFields, equipmentDetailCustomFieldValues) ? (
            <Card size="small" title={t('app.master-data.customFields')}>
              <CustomFieldsDetailSection
                customFields={equipmentListCustomFields}
                customFieldValues={equipmentDetailCustomFieldValues}
              />
            </Card>
          ) : null}
          <Card size="small" title={t('app.kuaizhizao.equipmentOps.schemeBindings.title')}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder={t('app.kuaizhizao.equipmentOps.schemeBindings.selectSchemes')}
              options={schemeSelectOptions}
              value={boundSchemeIds}
              onChange={setBoundSchemeIds}
            />
            <div style={{ marginTop: 12 }}>
              <Button
                type="primary"
                loading={schemeBindingsSaving}
                disabled={equipment.id == null}
                onClick={async () => {
                  if (equipment.id == null) return;
                  setSchemeBindingsSaving(true);
                  try {
                    await schemeBindingsApi.bulkReplace({
                      equipment_id: equipment.id,
                      scheme_type: 'spot_check',
                      scheme_ids: boundSchemeIds,
                    });
                    messageApi.success(t('app.kuaizhizao.equipmentOps.schemeBindings.saveSuccess'));
                  } catch (error: any) {
                    messageApi.error(error?.message || t('common.operationFailed'));
                  } finally {
                    setSchemeBindingsSaving(false);
                  }
                }}
              >
                {t('common.save')}
              </Button>
            </div>
          </Card>
          <Card size="small" title={t('app.uniDetail.sectionTimeline')}>
            {equipmentTracking.loading ? <Spin /> : null}
            {equipmentTracking.error && !equipmentTracking.loading ? (
              <Typography.Text type="danger">{equipmentTracking.error}</Typography.Text>
            ) : null}
            {equipmentTracking.data && !equipmentTracking.loading ? (
              <DocumentTrackingTimelineBody data={equipmentTracking.data} />
            ) : null}
            {!equipmentTracking.loading && !equipmentTracking.data && !equipmentTracking.error ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.equipment.noTimeline')} />
            ) : null}
          </Card>
        </div>
      ),
    };
    return [infoTab, ...(opsTabItems ?? [])];
  }, [
    equipment,
    t,
    detailColumns,
    equipmentListCustomFields,
    equipmentDetailCustomFieldValues,
    schemeSelectOptions,
    boundSchemeIds,
    schemeBindingsSaving,
    equipmentTracking,
    opsTabItems,
    messageApi,
  ]);

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'info' ? {} : { tab: key }, { replace: true });
  };

  const leavePage = () => navigate(KUAIZHIZAO_EQUIPMENT_LIST_PATH);

  const pageTitle = equipment
    ? `${equipment.code ?? ''} ${equipment.name ?? ''}`.trim() || t('app.kuaizhizao.equipment.detail')
    : t('app.kuaizhizao.equipment.detail');
  const statusTag = equipment?.status ? equipmentStatusTag(equipment.status, t) : null;

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
        label: t('app.kuaizhizao.equipment.detailTabInfo'),
        children: (
          <div style={{ padding: 48, textAlign: 'center' }}>
            {loading ? <Spin size="large" /> : <Empty description={t('app.kuaizhizao.equipment.getDetailFailed')} />}
          </div>
        ),
      },
    ],
    [loading, t],
  );

  const tabs = equipment && traceData && tabItems.length > 0 ? tabItems : fallbackTabs;

  if (!uuid) {
    return (
      <MultiTabListPageTemplate
        activeTabKey="info"
        onTabChange={() => undefined}
        tabs={[
          {
            key: 'info',
            label: t('app.kuaizhizao.equipment.detailTabInfo'),
            children: <Empty description={t('app.kuaizhizao.equipment.uuidNotFound')} />,
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
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                aria-label={t('common.back')}
                onClick={leavePage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {pageTitle}
              </Typography.Title>
              {statusTag ? <Tag color={statusTag.color}>{statusTag.text}</Tag> : null}
            </Space>
            <Space wrap>
              <Button onClick={leavePage}>{t('common.back')}</Button>
              {equipmentPerms.canPrint && equipment?.uuid ? (
                <Button
                  icon={<QrcodeOutlined />}
                  onClick={() =>
                    openPrint({
                      documentType: 'equipment_card',
                      documentId: equipment.id ?? 1,
                      printApiPath: `/apps/kuaizhizao/equipment/${equipment.uuid}/print`,
                      pdfDownloadFilename: `equipment-card-${equipment.code || equipment.uuid}.pdf`,
                    })
                  }
                >
                  {t('app.kuaizhizao.equipment.printEquipmentCards')}
                </Button>
              ) : null}
              {equipment?.uuid ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() =>
                    navigate(KUAIZHIZAO_EQUIPMENT_LIST_PATH, { state: { openEditUuid: equipment.uuid } })
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
        title={t('app.kuaizhizao.equipment.createCalibration')}
        open={calibModalVisible}
        onOk={handleSubmitCalibration}
        okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT}
        onCancel={() => setCalibModalVisible(false)}
        destroyOnHidden
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="calibration_date" label={t('app.kuaizhizao.equipment.calibrationDate')} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t('app.kuaizhizao.equipment.calibrationResult')} rules={[{ required: true }]}>
            <Select options={calibrationResultOptions} />
          </Form.Item>
          <Form.Item name="certificate_no" label={t('app.kuaizhizao.equipment.certificateNo')}>
            <Input placeholder={t('app.kuaizhizao.equipment.phCertificateNo')} />
          </Form.Item>
          <Form.Item name="expiry_date" label={t('app.kuaizhizao.equipment.expiryDate')}>
            <FutureDatePicker getForm={() => calibForm} baseFieldName="calibration_date" t={t} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="attachments"
            label={t('app.kuaizhizao.equipment.attachments')}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              multiple
              customRequest={async (options) => {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: 'equipment_calibration_attachments',
                });
                options.onSuccess?.(res[0], options.file as any);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('app.kuaizhizao.equipment.upload')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label={t('app.kuaizhizao.equipment.traceColRemark')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.equipment.phRemark')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default EquipmentDetailPage;
