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
import { App, Button, Tag, Space, Descriptions, Typography, Timeline } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getPerformanceConfigActiveLifecycle } from '../../../../kuaizhizao/utils/performanceLifecycle';
import { buildMasterDetailDescriptionItems } from '../../../utils/buildMasterDetailDescriptionItems';
import { costRuleApi } from '../../../services/cost';
import { getRuleTypeSelectOptions, getRuleTypeTag } from '../../../utils/costUiLabels';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

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

  // Modal 相关状态（创建/编辑规则）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentCostRule, setCurrentCostRule] = useState<CostRule | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [costRuleDetail, setCostRuleDetail] = useState<CostRule | null>(null);

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

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: CostRule) => {
    try {
      if (!record.uuid) {
        messageApi.error(t('app.kuaicaiwu.costRule.uuidMissing'));
        return;
      }
      const detail = await costRuleApi.get(record.uuid);
      setCostRuleDetail(detail);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costRule.loadDetailFailed'));
    }
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
      messageApi.success(t('app.kuaicaiwu.costCommon.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costCommon.deleteFailed'));
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
        messageApi.success(t('app.kuaicaiwu.costCommon.updateSuccess'));
      } else {
        await costRuleApi.create(values);
        messageApi.success(t('app.kuaicaiwu.costCommon.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costRule.saveFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CostRule>[] = useMemo(
    () => [
      {
        title: t('app.kuaicaiwu.costRule.col.isActive'),
        dataIndex: 'is_active',
        key: 'is_active',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          allowClear: true,
          options: [
            { label: t('app.kuaicaiwu.costRule.status.enabled'), value: true },
            { label: t('app.kuaicaiwu.costRule.status.disabled'), value: false },
          ],
        },
      },
      {
        title: t('app.kuaicaiwu.costRule.col.code'),
        dataIndex: 'code',
        key: 'code',
        width: 150,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
            {r.code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaicaiwu.costRule.col.name'), dataIndex: 'name', key: 'name', width: 200 },
      {
        title: t('app.kuaicaiwu.costRule.col.ruleType'),
        dataIndex: 'rule_type',
        key: 'rule_type',
        width: 120,
        render: (dom) => getRuleTypeTag(String(dom ?? ''), t),
      },
      { title: t('app.kuaicaiwu.costRule.col.costType'), dataIndex: 'cost_type', key: 'cost_type', width: 120 },
      { title: t('app.kuaicaiwu.costRule.col.calculationMethod'), dataIndex: 'calculation_method', key: 'calculation_method', width: 120 },
      { title: t('app.kuaicaiwu.costRule.col.allocationBasis'), dataIndex: 'allocation_basis', key: 'allocation_basis', width: 120 },
      { title: t('app.kuaicaiwu.costRule.col.sourceModule'), dataIndex: 'source_module', key: 'source_module', width: 120 },
      {
        title: t('app.kuaicaiwu.costCommon.col.createdAt'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        search: false,
        render: (dom) => (dom ? formatDateTime(dom as string, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaicaiwu.costCommon.col.updatedAt'),
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 180,
        search: false,
        render: (dom) => (dom ? formatDateTime(dom as string, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaicaiwu.costCommon.section.lifecycle'),
        dataIndex: 'lifecycle_stage',
        key: 'lifecycle',
        width: 200,
        fixed: 'right',
        align: 'left',
        search: false,
        render: (_, record) => (
          <UniLifecycle {...getPerformanceConfigActiveLifecycle(record as unknown as Record<string, unknown>)} showCircleTooltip={false} />
        ),
      },
      {
        title: t('app.kuaicaiwu.costCommon.action'),
        key: 'action',
        width: 200,
        fixed: 'right',
        render: (_: any, record: CostRule) => (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
              {t('app.kuaicaiwu.costCommon.detail')}
            </Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              {t('app.kuaicaiwu.costCommon.edit')}
            </Button>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              {t('app.kuaicaiwu.costCommon.delete')}
            </Button>
          </Space>
        ),
      },
    ],
    [t],
  );

  const detailItems: any[] = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costRule.col.code'), dataIndex: 'code' },
      { title: t('app.kuaicaiwu.costRule.col.name'), dataIndex: 'name' },
      { title: t('app.kuaicaiwu.costRule.col.ruleType'), dataIndex: 'rule_type' },
      { title: t('app.kuaicaiwu.costRule.col.costType'), dataIndex: 'cost_type' },
      { title: t('app.kuaicaiwu.costRule.col.calculationMethod'), dataIndex: 'calculation_method' },
      {
        title: t('app.kuaicaiwu.costRule.col.calculationFormula'),
        dataIndex: 'calculation_formula',
        render: (text: any) => (text ? JSON.stringify(text, null, 2) : '-'),
      },
      {
        title: t('app.kuaicaiwu.costRule.col.ruleParameters'),
        dataIndex: 'rule_parameters',
        render: (text: any) => (text ? JSON.stringify(text, null, 2) : '-'),
      },
      {
        title: t('app.kuaicaiwu.costRule.col.isActive'),
        dataIndex: 'is_active',
        render: (text: boolean) => (
          <Tag color={text ? 'green' : 'red'}>
            {text ? t('app.kuaicaiwu.costRule.status.enabled') : t('app.kuaicaiwu.costRule.status.disabled')}
          </Tag>
        ),
      },
      { title: t('app.kuaicaiwu.costCommon.description'), dataIndex: 'description' },
      { title: t('app.kuaicaiwu.costCommon.col.createdBy'), dataIndex: 'created_by_name' },
      {
        title: t('app.kuaicaiwu.costCommon.col.createdAt'),
        dataIndex: 'created_at',
        render: (text: string) => (text ? formatDateTime(text, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      { title: t('app.kuaicaiwu.costCommon.col.updatedBy'), dataIndex: 'updated_by_name' },
      {
        title: t('app.kuaicaiwu.costCommon.col.updatedAt'),
        dataIndex: 'updated_at',
        render: (text: string) => (text ? formatDateTime(text, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
    ],
    [t],
  );

  const ruleDetailBaseItems = detailItems.filter(
    (d) => !['calculation_formula', 'rule_parameters'].includes(String((d as { dataIndex?: string }).dataIndex)),
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
      { label: t('app.kuaicaiwu.costRule.allocationBasis.machineHours'), value: '机器工时' },
      { label: t('app.kuaicaiwu.costRule.allocationBasis.outputValue'), value: '产值' },
      { label: t('app.kuaicaiwu.costRule.allocationBasis.average'), value: '平均分摊' },
      { label: t('app.kuaicaiwu.costRule.allocationBasis.manual'), value: '手动分摊' },
    ],
    [t],
  );

  const wipValuationOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.costRule.wipValuation.none'), value: '不计算' },
      { label: t('app.kuaicaiwu.costRule.wipValuation.equivalent'), value: '约当产量法' },
      { label: t('app.kuaicaiwu.costRule.wipValuation.standard'), value: '定额成本法' },
      { label: t('app.kuaicaiwu.costRule.wipValuation.materialOnly'), value: '只计材料' },
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
        columnPersistenceId="apps.kuaicaiwu.pages.cost-management.cost-rules"
        scroll={{ x: 'max-content' }}
        request={async (params: any) => {
          // 将 ProTable 的分页参数转换为后端期望的格式
          const queryParams: any = {
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize!,
          };

          // 传递其他搜索参数
          if (params.rule_type) queryParams.rule_type = params.rule_type;
          if (params.cost_type) queryParams.cost_type = params.cost_type;
          if (params.is_active !== undefined && params.is_active !== '') {
            queryParams.is_active = params.is_active;
          }
          if (params.search) queryParams.search = params.search;
          
          const response = await costRuleApi.list(queryParams);
          return {
            data: response.items || [],
            success: true,
            total: response.total || 0,
          };
        }}
        columns={columns}
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
          name="wip_valuation_method"
          label={t('app.kuaicaiwu.costRule.field.wipValuation')}
          placeholder={t('app.kuaicaiwu.costRule.field.wipValuationPlaceholder')}
          options={wipValuationOptions}
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
          label={t('app.kuaicaiwu.costCommon.description')}
          placeholder={t('app.kuaicaiwu.costCommon.descriptionPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaicaiwu.costRule.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setCostRuleDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          costRuleDetail ? (
            <>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.basicInfo')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildMasterDetailDescriptionItems(
                    costRuleDetail as unknown as Record<string, unknown>,
                    ruleDetailBaseItems as any,
                  )}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.lifecycle')}>
                <UniLifecycle
                  {...getPerformanceConfigActiveLifecycle(costRuleDetail as unknown as Record<string, unknown>)}
                  showCircleTooltip={false}
                />
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {t('app.kuaicaiwu.costRule.lifecycleHint')}
                </Typography.Paragraph>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.details')}>
                <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                  <Typography.Text type="secondary">{t('app.kuaicaiwu.costRule.col.calculationFormula')}</Typography.Text>
                  <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
                    {costRuleDetail.calculation_formula ? JSON.stringify(costRuleDetail.calculation_formula, null, 2) : '-'}
                  </pre>
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                    {t('app.kuaicaiwu.costRule.col.ruleParameters')}
                  </Typography.Text>
                  <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
                    {costRuleDetail.rule_parameters ? JSON.stringify(costRuleDetail.rule_parameters, null, 2) : '-'}
                  </pre>
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.operationLog')}>
                <Timeline
                  items={[
                    {
                      color: 'green',
                      children: (
                        <>
                          {t('app.kuaicaiwu.costCommon.log.created')} ·{' '}
                          {costRuleDetail.created_at ? formatDateTime(costRuleDetail.created_at, 'YYYY-MM-DD HH:mm:ss') : '-'}
                          {costRuleDetail.created_by_name ? ` · ${costRuleDetail.created_by_name}` : ''}
                        </>
                      ),
                    },
                    {
                      color: 'blue',
                      children: (
                        <>
                          {t('app.kuaicaiwu.costCommon.log.updated')} ·{' '}
                          {costRuleDetail.updated_at ? formatDateTime(costRuleDetail.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'}
                          {costRuleDetail.updated_by_name ? ` · ${costRuleDetail.updated_by_name}` : ''}
                        </>
                      ),
                    },
                  ]}
                />
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default CostRulePage;

