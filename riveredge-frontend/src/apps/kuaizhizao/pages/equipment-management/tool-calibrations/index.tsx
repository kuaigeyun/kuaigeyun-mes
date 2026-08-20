/**
 * 工装校准记录页面
 *
 * 展示全量工装校准记录，支持新建校准记录。
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, Typography } from 'antd';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { PlusOutlined } from '@ant-design/icons';
import { MarkerTag } from '../../../../../constants/statusBadges';
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
import { toolApi } from '../../../services/equipment';
import { calibrationsApi } from '../../../services/toolOps';
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

const RESOURCE = 'kuaizhizao:tool-calibration';
const P = 'app.kuaizhizao.toolCalibration';

interface ToolCalibration {
  uuid?: string;
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  calibration_org?: string;
  remark?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
}

const CALIBRATION_RESULT_LABEL_KEYS: Record<string, string> = {
  合格: `${P}.resultPass`,
  不合格: `${P}.resultFail`,
  准用: `${P}.resultConditional`,
};

const ToolCalibrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { open: drawerVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<ToolCalibration>();
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    toolApi.list({ limit: 500 }).then((res: any) => {
      setToolOptions((res.items || []).map((item: any) => ({ label: `${item.code} - ${item.name}`, value: item.uuid })));
    }).catch(() => {});
  }, []);

  const handleCreate = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
  };

  useNewShortcut(handleCreate);

  const handleDetail = useCallback(
    (record: ToolCalibration) => {
      if (!record.uuid) return;
      void openDetail(async () => record as ToolCalibration);
    },
    [openDetail],
  );

  const handleSubmit = async (values: any) => {
    try {
      await calibrationsApi.create({
        tool_uuid: values.tool_uuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        calibration_org: values.calibration_org,
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
      { label: t(`${P}.resultConditional`), value: '准用' },
    ],
    [t],
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<ToolCalibration>[]>(
    () => [
      { title: t(`${P}.colToolCode`), dataIndex: 'tool_code' },
      { title: t(`${P}.colToolName`), dataIndex: 'tool_name' },
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
      { title: t(`${P}.colCalibrationOrg`), dataIndex: 'calibration_org' },
      { title: t(`${P}.formRemark`), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<ToolCalibration>[] = useMemo(
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
        title: t(`${P}.colToolCode`),
        dataIndex: 'tool_code',
        width: 120,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.tool_code ?? '') }} ellipsis>
            {r.tool_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t(`${P}.colToolName`), dataIndex: 'tool_name', width: 180, ellipsis: true, sorter: true, hideInSearch: true },
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
      { title: t(`${P}.colCalibrationOrg`), dataIndex: 'calibration_org', width: 140, sorter: true, hideInSearch: true },
      { title: t(`${P}.formRemark`), dataIndex: 'remark', ellipsis: true, hideInSearch: true },
      ...buildDocumentAuditColumns<ToolCalibration>(t),
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
    'tool_calibration',
  );

  return (
    <>
    <ListPageTemplate>
      <UniTable<ToolCalibration>
        headerTitle={t(`${P}.title`)}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-calibrations-equip-rank-v1"
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
          const res = await calibrationsApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            tool_uuid: params.tool_uuid,
            ...listParams,
          });
          const { data, total } = normalizeEquipmentListResponse(res);
          return { data: data as ToolCalibration[], success: true, total };
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
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t(`${P}.createModalTitle`)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="tool_uuid"
          label={t(`${P}.formTool`)}
          options={toolOptions}
          placeholder={t(`${P}.formSelectTool`)}
          rules={[{ required: true, message: t(`${P}.formSelectToolRequired`) }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="calibration_date"
          label={t(`${P}.formCalibrationDate`)}
          rules={[{ required: true, message: t(`${P}.formSelectCalibrationDateRequired`) }]}
          colProps={{ span: 12 }}
          fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
        />
        <ProFormSelect
          name="result"
          label={t(`${P}.formResult`)}
          options={resultOptions}
          rules={[{ required: true, message: t(`${P}.formSelectResultRequired`) }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="certificate_no" label={t(`${P}.formCertificateNo`)} colProps={{ span: 12 }} />
        <ProFormDatePicker
          name="expiry_date"
          label={t(`${P}.formExpiryDate`)}
          colProps={{ span: 12 }}
          fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
        />
        <ProFormText name="calibration_org" label={t(`${P}.formCalibrationOrg`)} colProps={{ span: 12 }} />
        <DocumentAttachmentsField category="tool_calibration_attachments" />
        <ProFormText name="remark" label={t(`${P}.formRemark`)} colProps={{ span: 24 }} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${t(`${P}.detailTitle`, { defaultValue: t('common.detail') })}${detail?.tool_code ? ` - ${detail.tool_code}` : ''}`}
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
              category="tool_calibration_attachments"
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

export default ToolCalibrationsPage;
