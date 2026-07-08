import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Tag, Typography } from 'antd';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getCalibrationResultLifecycle } from '../../../utils/equipmentLifecycle';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { equipmentApi } from '../../../services/equipment';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
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
      messageApi.error(e?.message || t(`${P}.saveFailed`));
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
        dataIndex: 'result',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => {
          const color = r.result === '合格' ? 'success' : r.result === '不合格' ? 'error' : 'warning';
          const labelKey = r.result ? CALIBRATION_RESULT_LABEL_KEYS[r.result] : undefined;
          return <Tag color={color}>{labelKey ? t(labelKey) : r.result || '-'}</Tag>;
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
      {
        title: t(`${P}.colLifecycle`),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getCalibrationResultLifecycle(record as Record<string, unknown>);
          return (
            <UniLifecycle
              percent={lifecycle.percent}
              stageName={lifecycle.stageName}
              status={lifecycle.status}
              subStages={lifecycle.subStages}
              showLabel
              size="small"
              showCircleTooltip={false}
            />
          );
        },
      },
      { title: t(`${P}.formRemark`), dataIndex: 'remark', ellipsis: true, hideInSearch: true },
    ],
    [t],
  );

  if (!perms.canRead) return null;

  return (
    <ListPageTemplate>
      <UniTable<EquipmentCalibration>
        headerTitle={t(`${P}.title`)}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-calibrations"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="uuid"
        columns={columns}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
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
        scroll={{ x: 1500 }}
      />

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
        <ProFormText name="remark" label={t(`${P}.formRemark`)} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default EquipmentCalibrationsPage;
