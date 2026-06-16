/**
 * 序列号规则管理页面
 *
 * 提供序列号规则的 CRUD 功能，用于配置序列号生成规则。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import CodeRuleComponentBuilder from '../../../../../components/code-rule-component-builder';
import { serialRuleApi } from '../../../services/batchSerialRules';
import { SERIAL_RULE_AVAILABLE_FIELDS, DEFAULT_SERIAL_RULE_COMPONENTS } from '../../../constants/serialRuleConstants';
import type { SerialRule, SerialRuleCreate, SerialRuleUpdate } from '../../../services/batchSerialRules';
import type { CodeRuleComponent } from '../../../../../types/codeRuleComponent';

const SerialRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const seqResetOptions = useMemo(() => [
    { label: t('app.master-data.seqRules.seqResetNever'), value: 'never' },
    { label: t('app.master-data.seqRules.seqResetDaily'), value: 'daily' },
    { label: t('app.master-data.seqRules.seqResetMonthly'), value: 'monthly' },
    { label: t('app.master-data.seqRules.seqResetYearly'), value: 'yearly' },
  ], [t]);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [ruleComponents, setRuleComponents] = useState<CodeRuleComponent[]>([]);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ seqStart: 1, seqStep: 1, isActive: true });
    setRuleComponents([...DEFAULT_SERIAL_RULE_COMPONENTS]);
  };

  useNewShortcut(handleCreate);

  const handleEdit = async (record: SerialRule) => {
    setIsEdit(true);
    setCurrentUuid(record.uuid);
    setModalVisible(true);
    try {
      const detail = await serialRuleApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        seqStart: detail.seqStart,
        seqStep: detail.seqStep,
        seqResetRule: detail.seqResetRule,
        isActive: detail.isActive,
      });
      setRuleComponents(
        detail.ruleComponents && Array.isArray(detail.ruleComponents) && detail.ruleComponents.length > 0
          ? (detail.ruleComponents as unknown as CodeRuleComponent[])
          : [...DEFAULT_SERIAL_RULE_COMPONENTS]
      );
    } catch (e: any) {
      messageApi.error(e?.message || t('app.master-data.seqRules.getDetailFailed'));
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      const basePayload = {
        name: values.name as string,
        code: values.code as string,
        description: values.description as string,
        seqStart: (values.seqStart as number) ?? 1,
        seqStep: (values.seqStep as number) ?? 1,
        seqResetRule: values.seqResetRule as string,
        isActive: (values.isActive as boolean) ?? true,
      };
      const payload = ruleComponents.length > 0
        ? { ...basePayload, ruleComponents: ruleComponents as unknown as Record<string, unknown>[] }
        : basePayload;

      if (isEdit && currentUuid) {
        await serialRuleApi.update(currentUuid, payload as SerialRuleUpdate);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await serialRuleApi.create(payload as SerialRuleCreate);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.operationFailed'));
      throw e;
    }
  };

  const ruleSortFieldMap: Record<string, string> = {
    name: 'name',
    code: 'code',
    description: 'description',
    seqResetRule: 'seq_reset_rule',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const handleDelete = async (record: SerialRule) => {
    try {
      await serialRuleApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await serialRuleApi.delete(String(key));
    }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleBatchSetActive = async (keys: React.Key[], isActive: boolean) => {
    for (const key of keys) {
      await serialRuleApi.update(String(key), { isActive });
    }
    messageApi.success(
      t('app.master-data.seqRules.serialRuleSetActiveSuccess', {
        count: keys.length,
        status: isActive ? t('app.master-data.seqRules.enabled') : t('app.master-data.seqRules.disabled'),
      }),
    );
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const columns: ProColumns<SerialRule>[] = [
    {
      title: t('app.master-data.seqRules.ruleName'),
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
    },
    { title: t('app.master-data.seqRules.ruleCode'), dataIndex: 'code', copyable: true, width: 120, sorter: true },
    {
      title: t('app.master-data.seqRules.description'),
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      sorter: true,
    },
    {
      title: t('app.master-data.seqRules.seqReset'),
      dataIndex: 'seqResetRule',
      width: 100,
      sorter: true,
      render: (_, r) => seqResetOptions.find((o) => o.value === r.seqResetRule)?.label || r.seqResetRule || '-',
    },
    {
      title: t('app.master-data.seqRules.status'),
      dataIndex: 'isActive',
      width: 80,
      sorter: true,
      render: (_, r) => (
        <Tag color={r.isActive ? 'success' : 'default'}>{r.isActive ? t('app.master-data.seqRules.enabled') : t('app.master-data.seqRules.disabled')}</Tag>
      ),
    },
    {
      title: t('common.actions'),
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.isSystem}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm
            title={t('app.master-data.seqRules.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
            disabled={record.isSystem}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={record.isSystem}>
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<SerialRule>
        columnPersistenceId="apps.master-data.pages.materials.serial-rules"
        headerTitle={t('app.master-data.serialRules.headerTitle')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20 } = params;
          const { sortBy: raw, sortOrder } = extractProTableSort(sort);
          const sortBy = raw ? ruleSortFieldMap[raw] : undefined;
          const res = await serialRuleApi.list({
            page: current,
            pageSize,
            keyword: searchFormValues?.keyword?.trim() || undefined,
            sortBy,
            sortOrder,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        showCreateButton
        createButtonText={t('app.master-data.serialRules.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="serial-rule-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('components.uniBatch.batchActions')}
            menuItems={[
              {
                key: 'batch-enable',
                label: t('app.master-data.seqRules.enabled'),
                onClick: (keys) => handleBatchSetActive(keys, true),
              },
              {
                key: 'batch-disable',
                label: t('app.master-data.seqRules.disabled'),
                onClick: (keys) => handleBatchSetActive(keys, false),
              },
            ]}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
      />

      <FormModalTemplate
        title={isEdit ? t('app.master-data.serialRules.editTitle') : t('app.master-data.serialRules.createTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={true}
      >
        <ProFormText name="name" label={t('app.master-data.seqRules.ruleName')} rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormText name="code" label={t('app.master-data.seqRules.ruleCode')} rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormDigit name="seqStart" label={t('app.master-data.seqRules.seqStart')} initialValue={1} colProps={{ span: 8 }} />
        <ProFormDigit name="seqStep" label={t('app.master-data.seqRules.seqStep')} initialValue={1} colProps={{ span: 8 }} />
        <ProFormSelect
          name="seqResetRule"
          label={t('app.master-data.seqRules.seqResetRule')}
          options={seqResetOptions}
          colProps={{ span: 8 }}
        />
        <ProForm.Item label={null} colon={false} colProps={{ span: 24 }} style={{ width: '100%', marginBottom: 24 }}>
          <div style={{ width: '100%', paddingLeft: 8, paddingRight: 8 }}>
            <CodeRuleComponentBuilder
              title={t('app.master-data.serialRules.builderTitle')}
              value={ruleComponents}
              onChange={setRuleComponents}
              availableFields={[...SERIAL_RULE_AVAILABLE_FIELDS]}
              defaultComponents={DEFAULT_SERIAL_RULE_COMPONENTS}
            />
          </div>
        </ProForm.Item>
        <ProFormTextArea name="description" label={t('app.master-data.seqRules.description')} colProps={{ span: 24 }} fieldProps={{ rows: 2 }} />
        <ProFormSwitch name="isActive" label={t('app.master-data.seqRules.status')} colProps={{ span: 12 }} initialValue={true} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SerialRulesPage;
