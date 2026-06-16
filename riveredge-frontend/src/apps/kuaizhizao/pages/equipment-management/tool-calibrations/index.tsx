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
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

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
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    toolApi.list({ limit: 500 }).then((res: any) => {
      setToolOptions((res.items || []).map((t: any) => ({ label: `${t.code} - ${t.name}`, value: t.uuid })));
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
      await toolApi.recordCalibration({
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
        title: t('app.kuaizhizao.toolCalibration.colToolCode'),
        dataIndex: 'tool_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.tool_code ?? '') }} ellipsis>
            {r.tool_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.toolCalibration.colToolName'), dataIndex: 'tool_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.toolCalibration.colCalibrationDate'), dataIndex: 'calibration_date', valueType: 'date', width: 120 },
      {
        title: t('app.kuaizhizao.toolCalibration.colResult'),
        dataIndex: 'result',
        width: 100,
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
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.certificate_no ?? '') }} ellipsis>
            {r.certificate_no ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.toolCalibration.colExpiryDate'), dataIndex: 'expiry_date', valueType: 'date', width: 120 },
      { title: t('app.kuaizhizao.toolCalibration.colCalibrationOrg'), dataIndex: 'calibration_org', width: 140, hideInSearch: true },
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
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listAllCalibrations({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            tool_uuid: params.tool_uuid,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('app.kuaizhizao.toolCalibration.createCalibration') + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
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
        />
        <ProFormSelect
          name="result"
          label={t('app.kuaizhizao.toolCalibration.formResult')}
          options={resultOptions}
          rules={[{ required: true, message: t('app.kuaizhizao.toolCalibration.formSelectResultRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="certificate_no" label={t('app.kuaizhizao.toolCalibration.formCertificateNo')} colProps={{ span: 12 }} />
        <ProFormDatePicker name="expiry_date" label={t('app.kuaizhizao.toolCalibration.formExpiryDate')} colProps={{ span: 12 }} />
        <ProFormText name="calibration_org" label={t('app.kuaizhizao.toolCalibration.formCalibrationOrg')} colProps={{ span: 12 }} />
        <DocumentAttachmentsField category="tool_calibration_attachments" />
        <ProFormText name="remark" label={t('app.kuaizhizao.toolCalibration.formRemark')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ToolCalibrationsPage;
