/**
 * 计量器具详情：基本信息 + 校准记录（无点检/巡检/报修/保养）
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
  Table,
  Typography,
  Upload,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { equipmentApi } from '../../../../services/equipment';
import {
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  MultiTabListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../../components/layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { ActionConfirmPopconfirm } from '../../../../../../components/action-confirm';
import { rowActionKind } from '../../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { formatDateBySiteSetting, formatDateTime } from '../../../../../../utils/format';
import { normalizeDocumentAttachments } from '../../../../utils/documentAttachments';
import { DocumentAttachmentsReadonly } from '../../../../components/DocumentAttachmentsReadonly';
import { uploadMultipleFiles } from '../../../../../../services/file';
import { FutureDatePicker } from '../../../../../../utils/futureDatePickerShortcuts';
import { useSubmitShortcut } from '../../../../../../hooks/useSubmitShortcut';
import { useLeaveFormTab, navigateClosingTab, uniTabKey } from '../../../../../../components/uni-tabs/navigateClosingTab';
import {
  KUAIZHIZAO_MEASURING_INSTRUMENT_LIST_PATH,
  buildMeasuringInstrumentDetailPath,
  resolveMeasuringInstrumentDetailTabKey,
} from '../measuringInstrumentPaths';

const P = 'app.kuaizhizao.measuringInstrument';

interface MeasuringInstrumentDetail {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
  model?: string;
  brand?: string;
  category?: string;
  workshop_name?: string;
  work_center_name?: string;
  calibration_period?: number;
  last_calibration_date?: string;
  next_calibration_date?: string;
  measuring_precision?: string;
  measurement_range?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

interface CalibrationRecord {
  uuid?: string;
  plan_type?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_by_name?: string;
}

const MeasuringInstrumentDetailPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions('kuaizhizao:equipment-management-equipment');
  const calibPerms = useResourcePermissions('kuaizhizao:measuring-instrument-calibration');

  const activeTab = resolveMeasuringInstrumentDetailTabKey(searchParams.get('tab'));
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<MeasuringInstrumentDetail | null>(null);
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([]);
  const [calibLoading, setCalibLoading] = useState(false);
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [editingCalib, setEditingCalib] = useState<CalibrationRecord | null>(null);
  const [calibForm] = Form.useForm();
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  const canCreateCalib = calibPerms.canCreate || perms.canUpdate;
  const canUpdateCalib = calibPerms.canUpdate;
  const canDeleteCalib = calibPerms.canDelete;

  const tracking = useDocumentTracking(detail?.id ? 'equipment' : undefined, detail?.id, trackingRefreshKey);

  const loadCalibrations = useCallback(async (equipmentUuid: string) => {
    setCalibLoading(true);
    try {
      const res = await equipmentApi.listCalibrations({ equipment_uuid: equipmentUuid, limit: 200 });
      setCalibrations(res?.items ?? []);
    } catch {
      setCalibrations([]);
    } finally {
      setCalibLoading(false);
    }
  }, []);

  const loadPage = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const loaded = await equipmentApi.get(uuid);
      setDetail(loaded);
      setTrackingRefreshKey((k) => k + 1);
      await loadCalibrations(uuid);
    } catch {
      messageApi.error(t(`${P}.loadFailed`));
    } finally {
      setLoading(false);
    }
  }, [loadCalibrations, messageApi, t, uuid]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useLeaveFormTab(uniTabKey(location.pathname));

  const basicColumns: ProDescriptionsItemProps<MeasuringInstrumentDetail>[] = useMemo(
    () => [
      { title: t(`${P}.fieldCode`), dataIndex: 'code' },
      { title: t(`${P}.fieldName`), dataIndex: 'name' },
      { title: t(`${P}.fieldModel`), dataIndex: 'model' },
      { title: t(`${P}.fieldBrand`), dataIndex: 'brand' },
      { title: t(`${P}.fieldCategory`), dataIndex: 'category' },
      { title: t(`${P}.fieldMeasuringPrecision`), dataIndex: 'measuring_precision' },
      { title: t(`${P}.fieldMeasurementRange`), dataIndex: 'measurement_range' },
      { title: t(`${P}.colWorkshop`), dataIndex: 'workshop_name' },
      { title: t(`${P}.fieldWorkCenter`), dataIndex: 'work_center_name' },
      {
        title: t(`${P}.fieldLastCalibrationDate`),
        dataIndex: 'last_calibration_date',
        render: (_, r) =>
          r.last_calibration_date ? formatDateBySiteSetting(r.last_calibration_date) : '-',
      },
      {
        title: t(`${P}.fieldCalibrationPeriod`),
        dataIndex: 'calibration_period',
        render: (_, r) =>
          r.calibration_period != null ? t(`${P}.periodDays`, { count: r.calibration_period }) : '-',
      },
      {
        title: t(`${P}.colNextCalibrationDate`),
        dataIndex: 'next_calibration_date',
        render: (_, r) =>
          r.next_calibration_date ? formatDateBySiteSetting(r.next_calibration_date) : '-',
      },
      {
        title: t(`${P}.fieldStatus`),
        dataIndex: 'status',
        render: (_, r) => <MarkerTag>{r.status ?? '-'}</MarkerTag>,
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        render: (_, r) => (
          <MarkerTag color={r.is_active ? 'success' : 'default'}>
            {r.is_active ? t('common.enabled') : t('common.disabled')}
          </MarkerTag>
        ),
      },
      { title: t('common.remark'), dataIndex: 'description', span: 2 },
      { title: t('common.createdAt'), dataIndex: 'created_at', render: (_, r) => formatDateTime(r.created_at) },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', render: (_, r) => formatDateTime(r.updated_at) },
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

  const handleOpenCalibrationModal = useCallback(() => {
    setEditingCalib(null);
    calibForm.resetFields();
    calibForm.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  }, [calibForm]);

  const handleEditCalibration = useCallback(
    (record: CalibrationRecord) => {
      setEditingCalib(record);
      calibForm.setFieldsValue({
        calibration_date: record.calibration_date ? dayjs(record.calibration_date) : undefined,
        expiry_date: record.expiry_date ? dayjs(record.expiry_date) : undefined,
        result: record.result,
        certificate_no: record.certificate_no,
        remark: record.remark,
        attachments: record.attachments || [],
      });
      setCalibModalVisible(true);
    },
    [calibForm],
  );

  const handleDeleteCalibration = useCallback(
    async (record: CalibrationRecord) => {
      if (!record.uuid) return;
      try {
        await equipmentApi.deleteCalibrationRecord(record.uuid);
        messageApi.success(t('common.deleteSuccess'));
        await loadPage();
      } catch (e: unknown) {
        const err = e as { message?: string };
        messageApi.error(err?.message || t('common.deleteFailed'));
      }
    },
    [loadPage, messageApi, t],
  );

  const handleSubmitCalibration = async () => {
    try {
      const values = await calibForm.validateFields();
      if (!uuid) return;
      const payload = {
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      if (editingCalib?.uuid) {
        await equipmentApi.updateCalibrationRecord(editingCalib.uuid, payload);
      } else {
        await equipmentApi.createCalibration(uuid, payload);
      }
      messageApi.success(t('app.kuaizhizao.equipment.calibrationSaved'));
      setCalibModalVisible(false);
      setEditingCalib(null);
      await loadPage();
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('common.saveFailed'));
    }
  };

  useSubmitShortcut(handleSubmitCalibration, calibModalVisible);

  const tabItems = useMemo(() => {
    if (!detail) return [];
    return [
      {
        key: 'info',
        label: t(`${P}.detailTabInfo`),
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" title={t('app.uniDetail.sectionBasic')}>
              <ProDescriptions<MeasuringInstrumentDetail>
                dataSource={detail}
                column={3}
                columns={basicColumns}
              />
            </Card>
            <Card size="small" title={t('app.uniDetail.sectionTimeline')}>
              {tracking.loading ? <Spin /> : null}
              {tracking.error && !tracking.loading ? (
                <Typography.Text type="danger">{tracking.error}</Typography.Text>
              ) : null}
              {tracking.data && !tracking.loading ? (
                <DocumentTrackingTimelineBody data={tracking.data} />
              ) : null}
              {!tracking.loading && !tracking.data && !tracking.error ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : null}
            </Card>
          </div>
        ),
      },
      {
        key: 'calibrations',
        label: t(`${P}.detailTabCalibrations`, { count: calibrations.length }),
        children: (
          <Card
            size="small"
            title={t(`${P}.detailTabCalibrationsTitle`)}
            extra={
              canCreateCalib ? (
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleOpenCalibrationModal}>
                  {t(`${P}.addCalibration`)}
                </Button>
              ) : null
            }
          >
            <Table<CalibrationRecord>
              size="small"
              loading={calibLoading}
              rowKey={(r) => r.uuid ?? `${r.calibration_date}-${r.certificate_no}`}
              pagination={false}
              dataSource={calibrations}
              columns={[
                {
                  title: t(`${P}.colCalibrationDate`),
                  dataIndex: 'calibration_date',
                  render: (v) => (v ? formatDateBySiteSetting(String(v)) : '-'),
                },
                { title: t(`${P}.colCalibrationResult`), dataIndex: 'result' },
                { title: t(`${P}.colCertificateNo`), dataIndex: 'certificate_no' },
                {
                  title: t(`${P}.colExpiryDate`),
                  dataIndex: 'expiry_date',
                  render: (v) => (v ? formatDateBySiteSetting(String(v)) : '-'),
                },
                {
                  title: t(`${P}.fieldCertificate`),
                  dataIndex: 'attachments',
                  render: (files: CalibrationRecord['attachments']) => (
                    <DocumentAttachmentsReadonly
                      attachments={files}
                      variant="count"
                      showEmpty
                    />
                  ),
                },
                { title: t('common.remark'), dataIndex: 'remark', ellipsis: true },
                { title: t('common.createdBy'), dataIndex: 'created_by_name' },
                {
                  title: t('common.actions'),
                  key: 'option',
                  width: 160,
                  render: (_, record) => (
                    <Space size={4}>
                      {canUpdateCalib ? (
                        <Button
                          {...rowActionKind('update')}
                          onClick={() => handleEditCalibration(record)}
                        >
                          {t('common.edit')}
                        </Button>
                      ) : null}
                      {canDeleteCalib ? (
                        <ActionConfirmPopconfirm
                          title={t('common.deleteTitle')}
                          onConfirm={() => void handleDeleteCalibration(record)}
                        >
                          <Button {...rowActionKind('delete')} danger>
                            {t('common.delete')}
                          </Button>
                        </ActionConfirmPopconfirm>
                      ) : null}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        ),
      },
    ];
  }, [
    basicColumns,
    calibLoading,
    calibrations,
    canCreateCalib,
    canDeleteCalib,
    canUpdateCalib,
    detail,
    handleDeleteCalibration,
    handleEditCalibration,
    handleOpenCalibrationModal,
    t,
    tracking.data,
    tracking.error,
    tracking.loading,
  ]);

  if (loading || !detail) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <MultiTabListPageTemplate
        header={
          <div style={DOCUMENT_DETAIL_PAGE_HEADER_STYLE}>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigateClosingTab(navigate, KUAIZHIZAO_MEASURING_INSTRUMENT_LIST_PATH)}
              >
                {t('common.back')}
              </Button>
              {perms.canUpdate ? (
                <Button
                  icon={<EditOutlined />}
                  onClick={() =>
                    navigate(KUAIZHIZAO_MEASURING_INSTRUMENT_LIST_PATH, {
                      state: { openEditUuid: detail.uuid },
                    })
                  }
                >
                  {t('common.edit')}
                </Button>
              ) : null}
            </Space>
            <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
              {detail.code} {detail.name}
              <MarkerTag color="success" style={{ marginLeft: 8 }}>
                {detail.status}
              </MarkerTag>
            </Typography.Title>
          </div>
        }
        tabs={tabItems}
        activeTabKey={activeTab}
        onTabChange={(key) => {
          if (!uuid) return;
          setSearchParams(
            key === 'info'
              ? {}
              : { tab: key },
            { replace: true },
          );
          navigate(buildMeasuringInstrumentDetailPath(uuid, key === 'info' ? undefined : key), {
            replace: true,
          });
        }}
      />

      <Modal
        title={
          editingCalib
            ? t('app.kuaizhizao.measuringInstrumentCalibration.editModal')
            : t(`${P}.addCalibration`)
        }
        open={calibModalVisible}
        destroyOnHidden
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        onCancel={() => {
          setCalibModalVisible(false);
          setEditingCalib(null);
        }}
        onOk={() => void handleSubmitCalibration()}
        okText={t('common.save')}
      >
        <Form form={calibForm} layout="vertical">
          <Form.Item name="calibration_date" label={t(`${P}.colCalibrationDate`)} rules={[{ required: true }]}>
            <FutureDatePicker getForm={() => calibForm} baseFieldName="calibration_date" t={t} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label={t(`${P}.colCalibrationResult`)} rules={[{ required: true }]}>
            <Select options={calibrationResultOptions} />
          </Form.Item>
          <Form.Item name="certificate_no" label={t(`${P}.colCertificateNo`)}>
            <Input />
          </Form.Item>
          <Form.Item name="expiry_date" label={t(`${P}.colExpiryDate`)}>
            <FutureDatePicker getForm={() => calibForm} baseFieldName="calibration_date" t={t} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="attachments"
            label={t(`${P}.fieldCertificate`)}
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
          <Form.Item name="remark" label={t('common.remark')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MeasuringInstrumentDetailPage;
