/**
 * 模具使用记录页面
 *
 * 展示全量模具使用记录，支持新建使用记录。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Typography } from 'antd';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getCheckoutUsageLifecycle } from '../../../utils/equipmentLifecycle';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { moldApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface MoldUsage {
  uuid?: string;
  usage_no?: string;
  mold_uuid?: string;
  mold_code?: string;
  mold_name?: string;
  source_type?: string;
  source_no?: string;
  usage_date?: string;
  usage_count?: number;
  operator_name?: string;
  status?: string;
  return_date?: string;
  remark?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
}

const MoldUsagesPage: React.FC = () => {
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
    formRef.current?.setFieldsValue({ usage_date: dayjs(), usage_count: 1, status: '使用中' });
  };

  useNewShortcut(handleCreate);

  const handleSubmit = async (values: any) => {
    try {
      await moldApi.createUsage({
        mold_uuid: values.mold_uuid,
        source_type: values.source_type,
        source_no: values.source_no,
        usage_date: values.usage_date?.format?.('YYYY-MM-DD HH:mm:ss') || values.usage_date,
        usage_count: values.usage_count ?? 1,
        operator_name: values.operator_name,
        status: values.status || '使用中',
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.moldUsage.saveSuccess'));
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.moldUsage.saveFailed'));
      throw e;
    }
  };

  const statusOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.moldUsage.statusInUse'), value: '使用中' },
      { label: t('app.kuaizhizao.moldUsage.statusReturned'), value: '已归还' },
      { label: t('app.kuaizhizao.moldUsage.statusScrapped'), value: '已报废' },
    ],
    [t],
  );

  const columns: ProColumns<MoldUsage>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.moldUsage.colUsageNo'),
        dataIndex: 'usage_no',
        width: 150,
        fixed: 'left',
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.usage_no ?? '') }} ellipsis>
            {r.usage_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.moldUsage.colMoldCode'),
        dataIndex: 'mold_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.mold_code ?? '') }} ellipsis>
            {r.mold_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.moldUsage.colMoldName'), dataIndex: 'mold_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.moldUsage.colUsageDate'), dataIndex: 'usage_date', valueType: 'dateTime', width: 170 },
      { title: t('app.kuaizhizao.moldUsage.colUsageCount'), dataIndex: 'usage_count', width: 100, align: 'right' },
      { title: t('app.kuaizhizao.moldUsage.colSourceType'), dataIndex: 'source_type', width: 100 },
      {
        title: t('app.kuaizhizao.moldUsage.colSourceNo'),
        dataIndex: 'source_no',
        width: 140,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.source_no ?? '') }} ellipsis>
            {r.source_no ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.moldUsage.colOperator'), dataIndex: 'operator_name', width: 100 },
      {
        title: t('app.kuaizhizao.moldUsage.colLifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getCheckoutUsageLifecycle(record as Record<string, unknown>);
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
      { title: t('app.kuaizhizao.moldUsage.colRemark'), dataIndex: 'remark', ellipsis: true, hideInSearch: true },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<MoldUsage>
        headerTitle={t('app.kuaizhizao.moldUsage.title')}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-usages"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await moldApi.listUsages({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            mold_uuid: params.mold_uuid,
            status: params.status,
            search: params.usage_no,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('app.kuaizhizao.moldUsage.createUsage') + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1700 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t('app.kuaizhizao.moldUsage.createModalTitle')}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="mold_uuid"
          label={t('app.kuaizhizao.moldUsage.formMold')}
          options={moldOptions}
          placeholder={t('app.kuaizhizao.moldUsage.formSelectMold')}
          rules={[{ required: true, message: t('app.kuaizhizao.moldUsage.formSelectMoldRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="usage_date"
          label={t('app.kuaizhizao.moldUsage.formUsageDate')}
          fieldProps={{ showTime: true }}
          rules={[{ required: true, message: t('app.kuaizhizao.moldUsage.formSelectUsageDateRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormDigit name="usage_count" label={t('app.kuaizhizao.moldUsage.formUsageCount')} min={1} initialValue={1} colProps={{ span: 12 }} />
        <ProFormSelect
          name="status"
          label={t('app.kuaizhizao.moldUsage.formStatus')}
          options={statusOptions}
          colProps={{ span: 12 }}
        />
        <ProFormText name="source_type" label={t('app.kuaizhizao.moldUsage.formSourceType')} placeholder={t('app.kuaizhizao.moldUsage.formSourceTypePlaceholder')} colProps={{ span: 12 }} />
        <ProFormText name="source_no" label={t('app.kuaizhizao.moldUsage.formSourceNo')} colProps={{ span: 12 }} />
        <ProFormText name="operator_name" label={t('app.kuaizhizao.moldUsage.formOperator')} colProps={{ span: 12 }} />
        <DocumentAttachmentsField category="mold_usage_attachments" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default MoldUsagesPage;
