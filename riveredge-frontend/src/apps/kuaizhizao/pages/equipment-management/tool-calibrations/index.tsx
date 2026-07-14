/**
 * 工装校准记录页面
 *
 * 展示全量工装校准记录，支持新建校准记录。
 */

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
import { toolApi } from '../../../services/equipment';
import { calibrationsApi } from '../../../services/toolOps';
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
  合格: 'app.kuaizhizao.toolCalibration.resultPass',
  不合格: 'app.kuaizhizao.toolCalibration.resultFail',
  准用: 'app.kuaizhizao.toolCalibration.resultConditional',
};

const ToolCalibrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
      messageApi.success(t('app.kuaizhizao.toolCalibration.saveSuccess'));
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.toolCalibration.saveFailed'));
      throw e;
    }
  };

  const resultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.toolCalibration.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.toolCalibration.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.toolCalibration.resultConditional'), value: '准用' },
    ],
    [t],
  );

  const columns: ProColumns<ToolCalibration>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolCalibration.colCalibrationDate'),
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
        title: t('app.kuaizhizao.toolCalibration.colToolCode'),
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
      { title: t('app.kuaizhizao.toolCalibration.colToolName'), dataIndex: 'tool_name', width: 180, ellipsis: true, sorter: true, hideInSearch: true },
      {
        title: t('app.kuaizhizao.toolCalibration.colCalibrationDate'),
        dataIndex: 'calibration_date',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.calibration_date ? formatDateTime(r.calibration_date, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.toolCalibration.colResult'),
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
        title: t('app.kuaizhizao.toolCalibration.colCertificateNo'),
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
        title: t('app.kuaizhizao.toolCalibration.colExpiryDate'),
        dataIndex: 'expiry_date',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.expiry_date ? formatDateTime(r.expiry_date, 'YYYY-MM-DD') : '-'),
      },
      { title: t('app.kuaizhizao.toolCalibration.colCalibrationOrg'), dataIndex: 'calibration_org', width: 140, sorter: true, hideInSearch: true },
      {
        title: t('app.kuaizhizao.toolCalibration.colLifecycle'),
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
      { title: t('app.kuaizhizao.toolCalibration.formRemark'), dataIndex: 'remark', ellipsis: true, hideInSearch: true },
      ...buildDocumentAuditColumns<ToolCalibration>(t),
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ToolCalibration>
        headerTitle={t('app.kuaizhizao.toolCalibration.title')}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-calibrations"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="uuid"
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
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
                  {t('app.kuaizhizao.toolCalibration.createCalibration') + NEW_SHORTCUT_HINT}
                </Button>,
              ]
            : []
        }
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1500 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t('app.kuaizhizao.toolCalibration.createModalTitle')}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="tool_uuid"
          label={t('app.kuaizhizao.toolCalibration.formTool')}
          options={toolOptions}
          placeholder={t('app.kuaizhizao.toolCalibration.formSelectTool')}
          rules={[{ required: true, message: t('app.kuaizhizao.toolCalibration.formSelectToolRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="calibration_date"
          label={t('app.kuaizhizao.toolCalibration.formCalibrationDate')}
          rules={[{ required: true, message: t('app.kuaizhizao.toolCalibration.formSelectCalibrationDateRequired') }]}
          colProps={{ span: 12 }}
          fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
        />
        <ProFormSelect
          name="result"
          label={t('app.kuaizhizao.toolCalibration.formResult')}
          options={resultOptions}
          rules={[{ required: true, message: t('app.kuaizhizao.toolCalibration.formSelectResultRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="certificate_no" label={t('app.kuaizhizao.toolCalibration.formCertificateNo')} colProps={{ span: 12 }} />
        <ProFormDatePicker
          name="expiry_date"
          label={t('app.kuaizhizao.toolCalibration.formExpiryDate')}
          colProps={{ span: 12 }}
          fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
        />
        <ProFormText name="calibration_org" label={t('app.kuaizhizao.toolCalibration.formCalibrationOrg')} colProps={{ span: 12 }} />
        <DocumentAttachmentsField category="tool_calibration_attachments" />
        <ProFormText name="remark" label={t('app.kuaizhizao.toolCalibration.formRemark')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ToolCalibrationsPage;
