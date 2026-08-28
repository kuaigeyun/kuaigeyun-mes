/**
 * 序列号规则管理页面
 *
 * 提供序列号规则的 CRUD 功能，用于配置序列号生成规则。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { App, Popconfirm, Button } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  buildMasterCrudActiveValueEnum,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  masterCrudCreatedUpdatedColumns,
  masterRuleCodeNameSearchColumns,
  resolveRuleListParams,
} from '../../../utils/materialListCore';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import CodeRuleComponentBuilder from '../../../../../components/code-rule-component-builder';
import { serialRuleApi } from '../../../services/batchSerialRules';
import { SERIAL_RULE_AVAILABLE_FIELDS, DEFAULT_SERIAL_RULE_COMPONENTS } from '../../../constants/serialRuleConstants';
import type { SerialRule, SerialRuleCreate, SerialRuleUpdate } from '../../../services/batchSerialRules';
import type { CodeRuleComponent } from '../../../../../types/codeRuleComponent';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  renderMasterActiveTag,
  renderMasterYesNoTag,
  renderMasterTypeMarker,
} from '../../../utils/masterListPresentation';

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
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [ruleComponents, setRuleComponents] = useState<CodeRuleComponent[]>([]);

  const ruleActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'app.master-data.seqRules.disabled'),
    [t],
  );

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
        status: isActive ? t('common.enabled') : t('app.master-data.seqRules.disabled'),
      }),
    );
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const columns: ProColumns<SerialRule>[] = useMemo(() => [
    ...masterRuleCodeNameSearchColumns({
      code: t('app.master-data.seqRules.ruleCode'),
      name: t('app.master-data.seqRules.ruleName'),
    }),
    {
      title: t('app.master-data.seqRules.ruleCode'),
      dataIndex: 'code',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      copyable: true,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.seqRules.ruleName'),
      dataIndex: 'name',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.seqRules.seqReset'),
      dataIndex: 'seqResetRule',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => {
        const label = seqResetOptions.find((o) => o.value === r.seqResetRule)?.label || r.seqResetRule;
        return label ? renderMasterTypeMarker(String(label)) : '—';
      },
    },
    {
      // 备注长短不一：唯一 RemainderFlex（稀疏不叠）
      title: t('common.remark'),
      dataIndex: 'description',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.description || '—',
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      hideInTable: true,
      order: 20,
      valueType: 'select',
      valueEnum: ruleActiveValueEnum,
      fieldProps: { allowClear: true },
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      valueEnum: ruleActiveValueEnum,
      render: (_, r) => renderMasterActiveTag(t, r.isActive, 'common.enabled', 'app.master-data.seqRules.disabled'),
    },
    ...masterCrudCreatedUpdatedColumns<SerialRule>(t),
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
        <Button
          key="edit"
          type="link"
          size="small"
          {...rowActionKind('update')}
          onClick={() => handleEdit(record)}
          disabled={record.isSystem}
        />,
        <Popconfirm
          key="delete"
          title={t('app.master-data.seqRules.deleteConfirm')}
          onConfirm={() => handleDelete(record)}
          disabled={record.isSystem}
        >
          <Button
            type="link"
            size="small"
            {...rowActionKind('delete')}
            disabled={record.isSystem}
          />
        </Popconfirm>,
      ],
    },
  ], [t, seqResetOptions, ruleActiveValueEnum]);

  return (
    <ListPageTemplate>
      <UniTable<SerialRule>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.serialRules')}
        columnPersistenceId="apps.master-data.pages.materials.serial-rules.list-v2"
        headerTitle={t('app.master-data.serialRules.headerTitle')}
        actionRef={actionRef}
        rowKey="uuid"
        columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current = 1, pageSize = 20 } = params;
          const listParams = resolveRuleListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          const res = await serialRuleApi.list({
            page: current,
            pageSize,
            isActive: listParams.is_active as boolean | undefined,
            keyword: listParams.keyword as string | undefined,
            code: listParams.code as string | undefined,
            name: listParams.name as string | undefined,
            created_start_date: listParams.created_start_date as string | undefined,
            created_end_date: listParams.created_end_date as string | undefined,
            updated_start_date: listParams.updated_start_date as string | undefined,
            updated_end_date: listParams.updated_end_date as string | undefined,
            sortBy: listParams.sort_by as string | undefined,
            sortOrder: listParams.sort_order as 'asc' | 'desc' | undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={MASTER_CRUD_PINNED_ACTIVE_FIELD}
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
                label: t('common.enabled'),
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
        <ProFormText
          name="code"
          label={t('app.master-data.seqRules.ruleCode')}
          colProps={{ span: 12 }}
          placeholder={t('app.master-data.seqRules.ruleCodePlaceholder')}
          rules={[
            { required: true },
            {
              validator: async (_, value) => {
                const code = String(value ?? '').trim();
                if (code === 'SERIAL_DEFAULT') {
                  return Promise.reject(
                    new Error(t('app.master-data.seqRules.serialDefaultCodeReserved')),
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        />
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
        <ProFormTextArea name="description" label={t('common.remark')} colProps={{ span: 24 }} fieldProps={{ rows: 2 }} />
        <ProFormSwitch name="isActive" label={t('common.status')} colProps={{ span: 12 }} initialValue={true} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SerialRulesPage;
