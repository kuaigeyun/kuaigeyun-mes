import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工装领用归还页面
 *
 * 展示全量工装领用记录，支持领用、归还操作。
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography } from 'antd';
import { PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getCheckoutUsageLifecycle } from '../../../utils/equipmentLifecycle';
import { toolApi } from '../../../services/equipment';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import dayjs from 'dayjs';

interface ToolUsage {
  uuid?: string;
  usage_no?: string;
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  operator_name?: string;
  source_type?: string;
  source_no?: string;
  checkout_date?: string;
  checkin_date?: string;
  status?: string;
  remark?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
}

const ToolUsagesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    toolApi.list({ limit: 500 }).then((res: any) => {
      const items = (res.items || []).filter((t: any) => t.status !== '领用中');
      setToolOptions(items.map((t: any) => ({ label: `${t.code} - ${t.name}`, value: t.uuid })));
    }).catch(() => {});
  }, []);

  const handleCheckout = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ checkout_date: dayjs() });
  };

  const handleCheckin = useCallback(
    async (record: ToolUsage) => {
      if (record.status !== '使用中') {
        messageApi.warning(t('app.kuaizhizao.toolUsage.alreadyReturned'));
        return;
      }
      Modal.confirm({
        title: t('app.kuaizhizao.toolUsage.confirmCheckinTitle'),
        content: t('app.kuaizhizao.toolUsage.confirmCheckinContent', {
          code: record.tool_code,
          name: record.tool_name,
        }),
        onOk: async () => {
          try {
            await toolApi.checkin(record.uuid!);
            messageApi.success(t('app.kuaizhizao.toolUsage.checkinSuccess'));
            actionRef.current?.reload();
          } catch (e: any) {
            messageApi.error(e?.message || t('app.kuaizhizao.toolUsage.checkinFailed'));
          }
        },
      });
    },
    [messageApi, t],
  );

  const handleSubmit = async (values: any) => {
    try {
      await toolApi.checkout({
        tool_uuid: values.tool_uuid,
        operator_name: values.operator_name,
        department_name: values.department_name,
        source_type: values.source_type,
        source_no: values.source_no,
        checkout_date: values.checkout_date?.format?.('YYYY-MM-DD HH:mm:ss') || values.checkout_date,
        remark: values.remark,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.toolUsage.checkoutSuccess'));
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.toolUsage.checkoutFailed'));
      throw e;
    }
  };

  const columns: ProColumns<ToolUsage>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolUsage.colUsageNo'),
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
        title: t('app.kuaizhizao.toolUsage.colToolCode'),
        dataIndex: 'tool_code',
        width: 120,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.tool_code ?? '') }} ellipsis>
            {r.tool_code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.toolUsage.colToolName'), dataIndex: 'tool_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.toolUsage.colCheckoutDate'), dataIndex: 'checkout_date', valueType: 'dateTime', width: 170 },
      { title: t('app.kuaizhizao.toolUsage.colCheckinDate'), dataIndex: 'checkin_date', valueType: 'dateTime', width: 170 },
      { title: t('app.kuaizhizao.toolUsage.colOperator'), dataIndex: 'operator_name', width: 100 },
      { title: t('app.kuaizhizao.toolUsage.colSourceType'), dataIndex: 'source_type', width: 100 },
      {
        title: t('app.kuaizhizao.toolUsage.colSourceNo'),
        dataIndex: 'source_no',
        width: 140,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.source_no ?? '') }} ellipsis>
            {r.source_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.toolUsage.colLifecycle'),
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
      {
        title: t('app.kuaizhizao.toolUsage.colActions'),
        valueType: 'option',
        width: 100,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          record.status === '使用中' ? (
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void handleCheckin(record);
              }}
            >
              {t('app.kuaizhizao.toolUsage.actionCheckin')}
            </Button>
          ) : null,
      },
    ],
    [handleCheckin, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ToolUsage>
        headerTitle={t('app.kuaizhizao.toolUsage.title')}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-usages"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listAllUsages({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            tool_uuid: params.tool_uuid,
            status: params.status,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button
            {...rowActionKind('update')}
            key="checkout"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCheckout}
          >
            {withSingleNewShortcutHint(t('app.kuaizhizao.toolUsage.createCheckout'))}
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1600 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t('app.kuaizhizao.toolUsage.checkoutModalTitle')}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="tool_uuid"
          label={t('app.kuaizhizao.toolUsage.formTool')}
          options={toolOptions}
          placeholder={t('app.kuaizhizao.toolUsage.formSelectTool')}
          rules={[{ required: true, message: t('app.kuaizhizao.toolUsage.formSelectToolRequired') }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="operator_name" label={t('app.kuaizhizao.toolUsage.formBorrower')} colProps={{ span: 12 }} />
        <ProFormText name="department_name" label={t('app.kuaizhizao.toolUsage.formDepartment')} colProps={{ span: 12 }} />
        <ProFormText name="source_type" label={t('app.kuaizhizao.toolUsage.formSourceType')} placeholder={t('app.kuaizhizao.toolUsage.formSourceTypePlaceholder')} colProps={{ span: 12 }} />
        <ProFormText name="source_no" label={t('app.kuaizhizao.toolUsage.formSourceNo')} colProps={{ span: 12 }} />
        <DocumentAttachmentsField category="tool_usage_attachments" />
        <ProFormText name="remark" label={t('app.kuaizhizao.toolUsage.formRemark')} colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ToolUsagesPage;
