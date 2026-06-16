/**
 * 工装维保记录页面
 *
 * 展示全量工装维保记录，支持新建维保记录。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Typography } from 'antd';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getToolMaintenanceLifecycle } from '../../../utils/equipmentLifecycle';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface ToolMaintenance {
  uuid?: string;
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  maintenance_type?: string;
  maintenance_date?: string;
  executor?: string;
  content?: string;
  result?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
}

const MAINTENANCE_TYPE_LABEL_KEYS: Record<string, string> = {
  日常保养: 'app.kuaizhizao.toolMaintenance.maintenanceTypeDaily',
  定期保养: 'app.kuaizhizao.toolMaintenance.maintenanceTypePeriodic',
  故障维修: 'app.kuaizhizao.toolMaintenance.maintenanceTypeRepair',
};

const MAINTENANCE_RESULT_LABEL_KEYS: Record<string, string> = {
  完成: 'app.kuaizhizao.toolMaintenance.resultCompleted',
  待跟进: 'app.kuaizhizao.toolMaintenance.resultFollowUp',
};

const ToolMaintenancesPage: React.FC = () => {
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
    formRef.current?.setFieldsValue({ maintenance_date: dayjs(), result: '完成' });
  };

  useNewShortcut(handleCreate);

  const handleSubmit = async (values: any) => {
    try {
      await toolApi.recordMaintenance({
        tool_uuid: values.tool_uuid,
        maintenance_type: values.maintenance_type,
        maintenance_date: values.maintenance_date?.format?.('YYYY-MM-DD') || values.maintenance_date,
        executor: values.executor,
        content: values.content,
        result: values.result || '完成',
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.toolMaintenance.saveSuccess'));
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.toolMaintenance.saveFailed'));
      throw e;
    }
  };

  const maintenanceTypeOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.toolMaintenance.maintenanceTypeDaily'), value: '日常保养' },
      { label: t('app.kuaizhizao.toolMaintenance.maintenanceTypePeriodic'), value: '定期保养' },
      { label: t('app.kuaizhizao.toolMaintenance.maintenanceTypeRepair'), value: '故障维修' },
    ],
    [t],
  );

  const resultOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.toolMaintenance.resultCompleted'), value: '完成' },
      { label: t('app.kuaizhizao.toolMaintenance.resultFollowUp'), value: '待跟进' },
    ],
    [t],
  );

  const columns: ProColumns<ToolMaintenance>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolMaintenance.colToolCode'),
        dataIndex: 'tool_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.tool_code ?? '') }} ellipsis>
            {r.tool_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.toolMaintenance.colToolName'), dataIndex: 'tool_name', width: 180, ellipsis: true },
      {
        title: t('app.kuaizhizao.toolMaintenance.colMaintenanceType'),
        dataIndex: 'maintenance_type',
        width: 120,
        render: (_, r) => {
          const labelKey = r.maintenance_type ? MAINTENANCE_TYPE_LABEL_KEYS[r.maintenance_type] : undefined;
          return labelKey ? t(labelKey) : r.maintenance_type;
        },
      },
      { title: t('app.kuaizhizao.toolMaintenance.colMaintenanceDate'), dataIndex: 'maintenance_date', valueType: 'date', width: 120 },
      { title: t('app.kuaizhizao.toolMaintenance.colExecutor'), dataIndex: 'executor', width: 100 },
      {
        title: t('app.kuaizhizao.toolMaintenance.colResult'),
        dataIndex: 'result',
        width: 90,
        render: (_, r) => {
          const labelKey = r.result ? MAINTENANCE_RESULT_LABEL_KEYS[r.result] : undefined;
          return labelKey ? t(labelKey) : r.result;
        },
      },
      {
        title: t('app.kuaizhizao.toolMaintenance.colLifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getToolMaintenanceLifecycle(record as Record<string, unknown>);
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
      { title: t('app.kuaizhizao.toolMaintenance.colMaintenanceContent'), dataIndex: 'content', ellipsis: true, hideInSearch: true },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ToolMaintenance>
        headerTitle={t('app.kuaizhizao.toolMaintenance.title')}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenances"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listAllMaintenances({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            tool_uuid: params.tool_uuid,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('app.kuaizhizao.toolMaintenance.createMaintenance') + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1500 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t('app.kuaizhizao.toolMaintenance.createModalTitle')}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="tool_uuid"
          label={t('app.kuaizhizao.toolMaintenance.formTool')}
          options={toolOptions}
          placeholder={t('app.kuaizhizao.toolMaintenance.formSelectTool')}
          rules={[{ required: true, message: t('app.kuaizhizao.toolMaintenance.formSelectToolRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="maintenance_type"
          label={t('app.kuaizhizao.toolMaintenance.formMaintenanceType')}
          options={maintenanceTypeOptions}
          rules={[{ required: true, message: t('app.kuaizhizao.toolMaintenance.formSelectMaintenanceTypeRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="maintenance_date"
          label={t('app.kuaizhizao.toolMaintenance.formMaintenanceDate')}
          rules={[{ required: true, message: t('app.kuaizhizao.toolMaintenance.formSelectMaintenanceDateRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="executor" label={t('app.kuaizhizao.toolMaintenance.formExecutor')} colProps={{ span: 12 }} />
        <ProFormSelect
          name="result"
          label={t('app.kuaizhizao.toolMaintenance.formResult')}
          options={resultOptions}
          colProps={{ span: 12 }}
        />
        <DocumentAttachmentsField category="tool_maintenance_attachments" />
        <ProFormText name="content" label={t('app.kuaizhizao.toolMaintenance.formMaintenanceContent')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ToolMaintenancesPage;
