/**
 * 模具校准记录页面
 *
 * 展示全量模具校准记录，支持新建校准记录。
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
import { moldApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface MoldCalibration {
  uuid?: string;
  mold_uuid?: string;
  mold_code?: string;
  mold_name?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
}

const CALIBRATION_RESULT_LABEL_KEYS: Record<string, string> = {
  合格: 'app.kuaizhizao.moldCalibration.resultPass',
  不合格: 'app.kuaizhizao.moldCalibration.resultFail',
  准用: 'app.kuaizhizao.moldCalibration.resultConditional',
};

const MoldCalibrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [moldOptions, setMoldOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    moldApi.list({ limit: 500 }).then((res: any) => {
      setMoldOptions((res.items || []).map((m: any) => ({ label: `${m.code} - ${m.name}`, value: m.uuid })));
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
      await moldApi.createCalibration({
        mold_uuid: values.mold_uuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.moldCalibration.saveSuccess'));
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.moldCalibration.saveFailed'));
      throw e;
    }
  };

  const resultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.moldCalibration.resultPass'), value: '合格' },
      { label: t('app.kuaizhizao.moldCalibration.resultFail'), value: '不合格' },
      { label: t('app.kuaizhizao.moldCalibration.resultConditional'), value: '准用' },
    ],
    [t],
  );

  const columns: ProColumns<MoldCalibration>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.moldCalibration.colMoldCode'),
        dataIndex: 'mold_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.mold_code ?? '') }} ellipsis>
            {r.mold_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.moldCalibration.colMoldName'), dataIndex: 'mold_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.moldCalibration.colCalibrationDate'), dataIndex: 'calibration_date', valueType: 'date', width: 120 },
      {
        title: t('app.kuaizhizao.moldCalibration.colResult'),
        dataIndex: 'result',
        width: 100,
        render: (_, r) => {
          const color = r.result === '合格' ? 'success' : r.result === '不合格' ? 'error' : 'warning';
          const labelKey = r.result ? CALIBRATION_RESULT_LABEL_KEYS[r.result] : undefined;
          return <Tag color={color}>{labelKey ? t(labelKey) : r.result || '-'}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.moldCalibration.colCertificateNo'),
        dataIndex: 'certificate_no',
        width: 140,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.certificate_no ?? '') }} ellipsis>
            {r.certificate_no ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.moldCalibration.colExpiryDate'), dataIndex: 'expiry_date', valueType: 'date', width: 120 },
      {
        title: t('app.kuaizhizao.moldCalibration.colLifecycle'),
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
      { title: t('app.kuaizhizao.moldCalibration.colRemark'), dataIndex: 'remark', ellipsis: true, hideInSearch: true },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<MoldCalibration>
        headerTitle={t('app.kuaizhizao.moldCalibration.title')}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-calibrations"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await moldApi.listCalibrations({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            mold_uuid: params.mold_uuid,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('app.kuaizhizao.moldCalibration.createCalibration') + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1500 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t('app.kuaizhizao.moldCalibration.createModalTitle')}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="mold_uuid"
          label={t('app.kuaizhizao.moldCalibration.formMold')}
          options={moldOptions}
          placeholder={t('app.kuaizhizao.moldCalibration.formSelectMold')}
          rules={[{ required: true, message: t('app.kuaizhizao.moldCalibration.formSelectMoldRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="calibration_date"
          label={t('app.kuaizhizao.moldCalibration.formCalibrationDate')}
          rules={[{ required: true, message: t('app.kuaizhizao.moldCalibration.formSelectCalibrationDateRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="result"
          label={t('app.kuaizhizao.moldCalibration.formResult')}
          options={resultOptions}
          rules={[{ required: true, message: t('app.kuaizhizao.moldCalibration.formSelectResultRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="certificate_no" label={t('app.kuaizhizao.moldCalibration.formCertificateNo')} colProps={{ span: 12 }} />
        <ProFormDatePicker name="expiry_date" label={t('app.kuaizhizao.moldCalibration.formExpiryDate')} colProps={{ span: 12 }} />
        <DocumentAttachmentsField category="mold_calibration_attachments" />
        <ProFormText name="remark" label={t('app.kuaizhizao.moldCalibration.formRemark')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default MoldCalibrationsPage;
