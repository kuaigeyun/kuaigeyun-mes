/**
 * 成本核算规则管理页面
 *
 * 提供成本核算规则的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持材料成本、人工成本、制造费用等核算规则配置。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { App, Button, Popconfirm } from 'antd';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import {
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { CostRuleDetailDrawer } from './components/CostRuleDetailDrawer';
import { costRuleApi } from '../../../services/cost';
import { getRuleTypeSelectOptions, getRuleTypeTag } from '../../../utils/costUiLabels';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  COST_CRUD_PINNED_ACTIVE_FIELD,
  costDocCreatedUpdatedColumns,
  costRuleSearchColumns,
  resolveCostRuleListParams,
} from '../../../utils/costListCore';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';

interface CostRule {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  rule_type?: string;
  cost_type?: string;
  calculation_method?: string;
  allocation_basis?: string;
  wip_valuation_method?: string;
  source_module?: string;
  calculation_formula?: any;
  rule_parameters?: any;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
}

const CostRulePage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});

  // Modal 相关状态（创建/编辑规则）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentCostRule, setCurrentCostRule] = useState<CostRule | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [costRuleDetail, setCostRuleDetail] = useState<CostRule | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  /**
   * 处理新建规则
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentCostRule(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_active: true,
    });
  };

  /**
   * 处理初始化预置规则
   */
  const handleInitPresets = async () => {
    try {
      await costRuleApi.initPresets();
      messageApi.success(t('app.kuaicaiwu.costRule.initPresetsSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costRule.initPresetsFailed'));
    }
  };

  /**
   * 处理编辑规则
   */
  const handleEdit = async (record: CostRule) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaicaiwu.costRule.uuidMissing'));
        return;
      }
      const detail = await costRuleApi.get(record.uuid);
      setIsEdit(true);
      setCurrentCostRule(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          rule_type: detail.rule_type,
          cost_type: detail.cost_type,
          calculation_method: detail.calculation_method,
          calculation_formula: detail.calculation_formula ? JSON.stringify(detail.calculation_formula, null, 2) : '',
          rule_parameters: detail.rule_parameters ? JSON.stringify(detail.rule_parameters, null, 2) : '',
          is_active: detail.is_active,
          description: detail.description,
        });
      }, 100);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costRule.loadDetailFailed'));
    }
  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setCostRuleDetail(await costRuleApi.get(uuid));
    } catch (error) {
      setCostRuleDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaicaiwu.costRule.loadDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetail = (record: CostRule) => {
    if (!record.uuid) {
      messageApi.error(t('app.kuaicaiwu.costRule.uuidMissing'));
      return;
    }
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setCostRuleDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const closeDetail = () => {
    setDrawerVisible(false);
    setCostRuleDetail(null);
    setDetailError(null);
  };

  /**
   * 处理删除规则
   */
  const handleDelete = async (record: CostRule) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaicaiwu.costRule.uuidMissing'));
        return;
      }
      await costRuleApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
      await costRuleApi.delete(String(key));
      }
      messageApi.success(t('app.kuaicaiwu.costRule.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.costRule.batchDeleteFailed'));
    }
  };

  const handleBatchSetActive = async (keys: React.Key[], isActive: boolean) => {
    try {
      for (const key of keys) {
      await costRuleApi.update(String(key), { is_active: isActive });
      }
      messageApi.success(
        isActive
          ? t('app.kuaicaiwu.costRule.batchEnableSuccess', { count: keys.length })
          : t('app.kuaicaiwu.costRule.batchDisableSuccess', { count: keys.length }),
      );
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.costRule.batchUpdateFailed'));
    }
  };

  /**
   * 处理保存规则
   */
  const handleSave = async (values: any) => {
    try {
      // 处理 JSON 字段
      if (values.calculation_formula) {
        try {
          values.calculation_formula = JSON.parse(values.calculation_formula);
        } catch (e) {
          messageApi.error(t('app.kuaicaiwu.costRule.formulaJsonError'));
          return;
        }
      }
      if (values.rule_parameters) {
        try {
          values.rule_parameters = JSON.parse(values.rule_parameters);
        } catch (e) {
          messageApi.error(t('app.kuaicaiwu.costRule.parametersJsonError'));
          return;
        }
      }

      if (isEdit && currentCostRule?.uuid) {
        await costRuleApi.update(currentCostRule.uuid, values);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await costRuleApi.create(values);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.saveFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CostRule>[] = useMemo(
    () => [
      ...costRuleSearchColumns({
        code: t('app.kuaicaiwu.costRule.col.code'),
        name: t('app.kuaicaiwu.costRule.col.name'),
      }),
      {
        title: t('app.kuaicaiwu.costRule.col.isActive'),
        dataIndex: 'is_active',
        key: 'is_active',
        hideInTable: true,
        order: 12,
        valueType: 'select',
        fieldProps: {
          allowClear: true,
          options: [
            { label: t('common.enabled'), value: true },
            { label: t('common.disabled'), value: false },
          ],
        },
      },
      {
        title: t('app.kuaicaiwu.costRule.col.code'),
        dataIndex: 'code',
        key: 'code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.costRule.col.name'),
        dataIndex: 'name',
        key: 'name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.costRule.col.ruleType'),
        dataIndex: 'rule_type',
        key: 'rule_type',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        sorter: true,
        render: (dom) => getRuleTypeTag(String(dom ?? ''), t),
      },
      {
        title: t('app.kuaicaiwu.costRule.col.costType'),
        dataIndex: 'cost_type',
        key: 'cost_type',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.costRule.col.calculationMethod'),
        dataIndex: 'calculation_method',
        key: 'calculation_method',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.costRule.col.allocationBasis'),
        dataIndex: 'allocation_basis',
        key: 'allocation_basis',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaicaiwu.costRule.col.sourceModule'),
        dataIndex: 'source_module',
        key: 'source_module',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
      },
      {
        // 备注长短不一：唯一 RemainderFlex
        title: t('common.remark'),
        dataIndex: 'description',
        key: 'notes',
        minWidth: 160,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => r.description || '—',
      },
      {
        title: t('app.kuaicaiwu.costRule.col.isActive'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        sorter: true,
        render: (_, r) =>
          r.is_active ? (
            <MarkerTag color="success">{t('common.enabled')}</MarkerTag>
          ) : (
            <MarkerTag color="default">{t('common.disabled')}</MarkerTag>
          ),
      },
      ...costDocCreatedUpdatedColumns<CostRule>(t),
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_: any, record: CostRule) => [
          <Button
            key="view"
            type="link"
            size="small"
            {...rowActionKind('read')}
            onClick={() => handleDetail(record)}
          />,
          <Button
            key="edit"
            type="link"
            size="small"
            {...rowActionKind('update')}
            onClick={() => handleEdit(record)}
          />,
          <Popconfirm
            key="delete"
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" size="small" {...rowActionKind('delete')} />
          </Popconfirm>,
        ],
      },
    ],
    [t],
  );

  const calculationMethodOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.costRule.calculationMethod.byQuantity'), value: '按数量' },
      { label: t('app.kuaicaiwu.costRule.calculationMethod.byHours'), value: '按工时' },
      { label: t('app.kuaicaiwu.costRule.calculationMethod.byRatio'), value: '按比例' },
      { label: t('app.kuaicaiwu.costRule.calculationMethod.byFixed'), value: '按固定值' },
      { label: t('app.kuaicaiwu.costRule.calculationMethod.customFormula'), value: '自定义公式' },
    ],
    [t],
  );

  const allocationBasisOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.costRule.allocationBasis.output'), value: '产量' },
      { label: t('app.kuaicaiwu.costRule.allocationBasis.hours'), value: '工时' },
    ],
    [t],
  );

  const sourceModuleOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.costRule.sourceModule.warehouse'), value: '仓库' },
      { label: t('app.kuaicaiwu.costRule.sourceModule.reporting'), value: '报工' },
      { label: t('app.kuaicaiwu.costRule.sourceModule.payroll'), value: '薪资' },
      { label: t('app.kuaicaiwu.costRule.sourceModule.purchase'), value: '采购' },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<CostRule>
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columnPersistenceId="apps.kuaicaiwu.pages.cost-management.cost-rules.list-v2"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaicaiwu.costRules')}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={COST_CRUD_PINNED_ACTIVE_FIELD}
        request={async (params, sort, _filter, searchFormValues) => {
          const listParams = resolveCostRuleListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          try {
            const response = await costRuleApi.list({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              ...listParams,
            });
            return {
              data: response.items || [],
              success: true,
              total: response.total || 0,
            };
          } catch (error: unknown) {
            const err = error as { message?: string };
            messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        rowKey="uuid"
        showCreateButton
        createButtonText={t('app.kuaicaiwu.costRule.create')}
        onCreate={handleCreate}
        toolBarActionsAfterCreate={[
          <Button key="init-presets" type="default" onClick={handleInitPresets}>
            {t('app.kuaicaiwu.costRule.initPresets')}
          </Button>,
        ]}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.kuaicaiwu.costRule.batchDeleteTitle')}
        deleteConfirmDescription={(count) => t('app.kuaicaiwu.costRule.batchDeleteDesc', { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="cost-rule-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaicaiwu.costCommon.batchActions')}
            menuItems={[
              {
                key: 'batch-enable',
                label: t('app.kuaicaiwu.costRule.batchEnable'),
                onClick: (keys) => handleBatchSetActive(keys, true),
              },
              {
                key: 'batch-disable',
                label: t('app.kuaicaiwu.costRule.batchDisable'),
                onClick: (keys) => handleBatchSetActive(keys, false),
              },
            ]}
          />,
        ]}
        search={{
          labelWidth: 'auto',
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaicaiwu.costRule.edit') : t('app.kuaicaiwu.costRule.create')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSave}
        formRef={formRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText
          name="code"
          label={t('app.kuaicaiwu.costRule.col.code')}
          placeholder={t('app.kuaicaiwu.costRule.field.codePlaceholder')}
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label={t('app.kuaicaiwu.costRule.col.name')}
          placeholder={t('app.kuaicaiwu.costRule.field.namePlaceholder')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costRule.field.nameRequired') }]}
        />
        <ProFormSelect
          name="rule_type"
          label={t('app.kuaicaiwu.costRule.col.ruleType')}
          placeholder={t('app.kuaicaiwu.costRule.field.ruleTypePlaceholder')}
          options={getRuleTypeSelectOptions(t)}
          rules={[{ required: true, message: t('app.kuaicaiwu.costRule.field.ruleTypeRequired') }]}
        />
        <ProFormText
          name="cost_type"
          label={t('app.kuaicaiwu.costRule.col.costType')}
          placeholder={t('app.kuaicaiwu.costRule.field.costTypePlaceholder')}
          rules={[{ required: true, message: t('app.kuaicaiwu.costRule.field.costTypeRequired') }]}
        />
        <ProFormSelect
          name="calculation_method"
          label={t('app.kuaicaiwu.costRule.col.calculationMethod')}
          placeholder={t('app.kuaicaiwu.costRule.field.calculationMethodPlaceholder')}
          options={calculationMethodOptions}
          rules={[{ required: true, message: t('app.kuaicaiwu.costRule.field.calculationMethodRequired') }]}
        />
        <ProFormSelect
          name="allocation_basis"
          label={t('app.kuaicaiwu.costRule.col.allocationBasis')}
          placeholder={t('app.kuaicaiwu.costRule.field.allocationBasisPlaceholder')}
          options={allocationBasisOptions}
        />
        <ProFormSelect
          name="source_module"
          label={t('app.kuaicaiwu.costRule.col.sourceModule')}
          placeholder={t('app.kuaicaiwu.costRule.field.sourceModulePlaceholder')}
          options={sourceModuleOptions}
        />
        <ProFormTextArea
          name="calculation_formula"
          label={t('app.kuaicaiwu.costRule.field.calculationFormulaJson')}
          placeholder={t('app.kuaicaiwu.costRule.field.calculationFormulaPlaceholder')}
          fieldProps={{ rows: 4 }}
        />
        <ProFormTextArea
          name="rule_parameters"
          label={t('app.kuaicaiwu.costRule.field.ruleParametersJson')}
          placeholder={t('app.kuaicaiwu.costRule.field.ruleParametersPlaceholder')}
          fieldProps={{ rows: 4 }}
        />
        <ProFormSwitch name="is_active" label={t('app.kuaicaiwu.costRule.col.isActive')} initialValue={true} />
        <ProFormTextArea
          name="description"
          label={t('common.remark')}
          placeholder={t('app.kuaicaiwu.costCommon.descriptionPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <CostRuleDetailDrawer
        open={drawerVisible}
        onClose={closeDetail}
        detail={costRuleDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        extra={buildDetailDrawerEditExtra(t, Boolean(costRuleDetail), () => {
          if (!costRuleDetail) return;
          void handleEdit(costRuleDetail);
        })}
      />
    </ListPageTemplate>
  );
};

export default CostRulePage;

