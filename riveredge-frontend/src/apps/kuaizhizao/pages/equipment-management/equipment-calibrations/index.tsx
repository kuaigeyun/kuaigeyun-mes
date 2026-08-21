import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, Typography } from 'antd';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { equipmentApi } from '../../../services/equipment';
import { useEquipmentDetailDrawer } from '../shared/equipmentMasterDataDetail';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  normalizeEquipmentListResponse,
  resolveAssetWorkflowListParams,
} from '../../../utils/equipmentListCore';

const RESOURCE = 'kuaizhizao:equipment-calibration';
const P = 'app.kuaizhizao.equipmentCalibration';

interface EquipmentCalibration {
  uuid?: string;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

const CALIBRATION_RESULT_LABEL_KEYS: Record<string, string> = {
  合格: `${P}.resultPass`,
  不合格: `${P}.resultFail`,
  限制使用: `${P}.resultConditional`,
};

const EquipmentCalibrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { open: drawerVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<EquipmentCalibration>();
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    equipmentApi.list({ limit: 500, needs_calibration: true }).then((res: any) => {
      setEquipmentOptions((res.items || []).map((item: any) => ({ label: `${item.code} - ${item.name}`, value: item.uuid })));
    }).catch(() => {});
  }, []);

  const handleCreate = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
  };

  useNewShortcut(handleCreate);

  const handleDetail = useCallback(
    (record: EquipmentCalibration) => {
      if (!record.uuid) return;
      void openDetail(async () => record as EquipmentCalibration);
    },
    [openDetail],
  );

  const handleSubmit = async (values: any) => {
    try {
      await equipmentApi.createCalibrationRecord({
        equipment_uuid: values.equipment_uuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t(`${P}.saveSuccess`));
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.saveFailed'));
      throw e;
    }
  };

  const resultOptions = useMemo(
    () => [
      { label: t(`${P}.resultPass`), value: '合格' },
      { label: t(`${P}.resultFail`), value: '不合格' },
      { label: t(`${P}.resultConditional`), value: '限制使用' },
    ],
    [t],
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<EquipmentCalibration>[]>(
    () => [
      { title: t(`${P}.colEquipmentCode`), dataIndex: 'equipment_code' },
      { title: t(`${P}.colEquipmentName`), dataIndex: 'equipment_name' },
      {
        title: t(`${P}.colCalibrationDate`),
        dataIndex: 'calibration_date',
        render: (_, r) => (r.calibration_date ? formatDateTime(r.calibration_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${P}.colResult`),
        dataIndex: 'result',
        render: (_, r) => {
          const color = r.result === '合格' ? 'success' : r.result === '不合格' ? 'error' : 'warning';
          const labelKey = r.result ? CALIBRATION_RESULT_LABEL_KEYS[r.result] : undefined;
          return <MarkerTag color={color}>{labelKey ? t(labelKey) : r.result || '-'}</MarkerTag>;
        },
      },
      { title: t(`${P}.colCertificateNo`), dataIndex: 'certificate_no' },
      {
        title: t(`${P}.colExpiryDate`),
        dataIndex: 'expiry_date',
        render: (_, r) => (r.expiry_date ? formatDateTime(r.expiry_date, 'YYYY-MM-DD') : '-'),
      },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<EquipmentCalibration>[] = useMemo(
    () => [
      {
        title: t(`${P}.colCalibrationDate`),
        dataIndex: 'calibration_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t(`${P}.colEquipmentCode`),
        dataIndex: 'equipment_code',
        width: 120,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }} ellipsis>
            {r.equipment_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t(`${P}.colEquipmentName`), dataIndex: 'equipment_name', width: 180, ellipsis: true, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.colCalibrationDate`),
        dataIndex: 'calibration_date',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.calibration_date ? formatDateTime(r.calibration_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t(`${P}.colResult`),
        key: 'equipment_calibration_result',
        dataIndex: 'result',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => {
          const color = r.result === '合格' ? 'success' : r.result === '不合格' ? 'error' : 'warning';
          const labelKey = r.result ? CALIBRATION_RESULT_LABEL_KEYS[r.result] : undefined;
          return <MarkerTag color={color}>{labelKey ? t(labelKey) : r.result || '-'}</MarkerTag>;
        },
      },
      {
        title: t(`${P}.colCertificateNo`),
        dataIndex: 'certificate_no',
        width: 140,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.certificate_no ?? '') }} ellipsis>
            {r.certificate_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t(`${P}.colExpiryDate`),
        dataIndex: 'expiry_date',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.expiry_date ? formatDateTime(r.expiry_date, 'YYYY-MM-DD') : '-'),
      },
      { title: t('common.remark'), dataIndex: 'remark', ellipsis: true, hideInSearch: true },
      ...buildDocumentAuditColumns<EquipmentCalibration>(t),
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          perms.canRead
            ? [
                <Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
                  {t('common.detail')}
                </Button>,
              ]
            : null,
      },
    ],
    [t, perms.canRead, handleDetail],
  );

  if (!perms.canRead) return null;

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns,
    detail,
    'equipment_calibration',
  );

  return (
    <>
    <ListPageTemplate>
      <UniTable<EquipmentCalibration>
        headerTitle={t(`${P}.title`)}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-calibrations-equip-rank-v1"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="uuid"
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        onRow={(record) => ({
          onClick: () => perms.canRead && handleDetail(record),
          style: { cursor: perms.canRead ? 'pointer' : undefined },
        })}
        request={async (params, sort, _filter, searchFormValues) => {
          const listParams = resolveAssetWorkflowListParams(searchFormValues, sort, {
            docDateRangeKeys: ['calibration_date_range', 'calibrationDateRange'],
            docDateParamPrefix: 'calibration',
          });
          const res = await equipmentApi.listCalibrations({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            equipment_uuid: params.equipment_uuid as string | undefined,
            ...listParams,
          });
          const { data, total } = normalizeEquipmentListResponse(res);
          return { data: data as EquipmentCalibration[], success: true, total };
        }}
        toolBarRender={() =>
          perms.canCreate
            ? [
                <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  {t(`${P}.createCalibration`) + NEW_SHORTCUT_HINT}
                </Button>,
              ]
            : []
        }
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
      />
    </ListPageTemplate>

      <FormModalTemplate
        title={t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <ProFormSelect
          name="equipment_uuid"
          label={t(`${P}.formEquipment`)}
          options={equipmentOptions}
          showSearch
          rules={[{ required: true, message: t(`${P}.formEquipmentPlaceholder`) }]}
        />
        <ProFormDatePicker name="calibration_date" label={t(`${P}.formCalibrationDate`)} {...EQUIPMENT_DATE_FIELD_PROPS} rules={[{ required: true }]} />
        <ProFormSelect name="result" label={t(`${P}.formResult`)} options={resultOptions} rules={[{ required: true }]} />
        <ProFormText name="certificate_no" label={t(`${P}.formCertificateNo`)} />
        <ProFormDatePicker name="expiry_date" label={t(`${P}.formExpiryDate`)} {...EQUIPMENT_DATE_FIELD_PROPS} />
        <DocumentAttachmentsField category="equipment_calibration_attachments" />
        <ProFormText name="remark" label={t('common.remark')} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${t(`${P}.detailTitle`, { defaultValue: t('common.detail') })}${detail?.equipment_code ? ` - ${detail.equipment_code}` : ''}`}
        open={drawerVisible}
        loading={detailLoading}
        onClose={closeDetail}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detail ? (
            <Descriptions
              column={2}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        supplementary={
          detail?.attachments?.length ? (
            <LineAttachmentsUpload
              category="equipment_calibration_attachments"
              value={detail.attachments}
              readOnly
            />
          ) : undefined
        }
        supplementaryTitle={t(`${P}.formAttachments`, { defaultValue: '附件' })}
      />
    </>
  );
};

export default EquipmentCalibrationsPage;
