/**
 * KPI 指标定义页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, theme as AntdTheme } from 'antd';
import { ProFormText, ProFormDigit, ProFormSelect, ProFormSwitch, ProFormTextArea } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { employeePerformanceApi } from '../../../services/performance';
import type { KPIDefinition } from '../../../types/performance';
import {
  getKpiCalcTypeOptions,
  getKpiCalcTypeText,
  getPerformanceYesNoValueEnum,
  renderActiveTag,
  renderPerformanceTypeMarker,
} from '../components/performanceMeta';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_IS_ACTIVE_FIELD,
  resolveKpiDefinitionListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const KPI_RESOURCE = 'kuaizhizao:performance-kpi-definitions';

const KpiDefinitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const detailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const kpiPerms = useResourcePermissions(KPI_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<KPIDefinition | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  const calcTypeOptions = useMemo(() => getKpiCalcTypeOptions(t), [t]);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true, weight: 1 });
      return;
    }
    employeePerformanceApi.getKpiDefinition(editId).then((r) => {
      formRef.current?.setFieldsValue({
        code: r.code,
        name: r.name,
        weight: r.weight,
        calc_type: r.calc_type,
        is_active: r.is_active !== false,
        formula_json: r.formula_json ? JSON.stringify(r.formula_json, null, 2) : '',
      });
    }).catch((e: any) => messageApi.error(e?.message || t('common.loadFailed')));
  }, [modalVisible, editId, messageApi, t]);

  const detailColumns: ProDescriptionsItemProps<KPIDefinition>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.common.columns.code'), dataIndex: 'code' },
      { title: t('common.name'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.performance.common.columns.weight'), dataIndex: 'weight' },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcType'),
        dataIndex: 'calc_type',
        render: (_, r) => renderPerformanceTypeMarker(getKpiCalcTypeText(t, r?.calc_type)),
      },
      {
        title: t('app.kuaizhizao.performance.kpi.form.formulaJson'),
        dataIndex: 'formula_json',
        span: 2,
        render: (_, r) => (r?.formula_json ? JSON.stringify(r.formula_json) : '-'),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        render: (_, r) => renderActiveTag(t, r?.is_active !== false),
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t],
  );

  const handleCreate = () => {
    setEditId(null);
    setModalVisible(true);
  };
  const handleEdit = (r: KPIDefinition) => {
    setEditId(r.id);
    setModalVisible(true);
  };
  const handleDelete = async (r: KPIDefinition) => {
    try {
      await employeePerformanceApi.deleteKpiDefinition(r.id);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.deleteFailed'));
    }
  };
  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await employeePerformanceApi.getKpiDefinition(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (r: KPIDefinition) => {
    detailRetryIdRef.current = r.id;
    setDrawerVisible(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(r.id);
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setDetail(null);
    setDetailError(null);
  };

  const columns: ProColumns<KPIDefinition>[] = useMemo(
    () => alignProColumns<KPIDefinition>([
      {
        // 列稀疏：业务列不堆叠（表单序：编码 → 名称 → 权重 → 计算类型 → 启用）；审计叠列保留
        title: t('app.kuaizhizao.performance.common.columns.code'),
        dataIndex: 'code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        fixed: 'left',
        sorter: true,
        copyable: true,
      },
      {
        // 名称长短不一：唯一 RemainderFlex
        title: t('common.name'),
        dataIndex: 'name',
        minWidth: 140,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.weight'),
        dataIndex: 'weight',
        // 稀疏：表头「权重」+ 排序钮（勿用 80 裁切）
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcType'),
        dataIndex: 'calc_type',
        hideInTable: true,
        valueType: 'select',
        valueEnum: Object.fromEntries(calcTypeOptions.map((o) => [o.value, { text: o.label }])),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcType'),
        dataIndex: 'calc_type',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => renderPerformanceTypeMarker(getKpiCalcTypeText(t, r.calc_type)),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        hideInTable: true,
        valueEnum: getPerformanceYesNoValueEnum(t),
      },
      ...buildDocumentAuditColumns<KPIDefinition>(t),
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        render: (_, r) => renderActiveTag(t, r.is_active),
      },
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [];
          if (kpiPerms.canRead) {
            parts.push(
              <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)} />,
            );
          }
          if (kpiPerms.canUpdate) {
            parts.push(
              <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)} />,
            );
          }
          if (kpiPerms.canDelete) {
            parts.push(
              <Popconfirm
                key="delete"
                title={t('app.kuaizhizao.performance.kpi.messages.deleteConfirm')}
                onConfirm={() => handleDelete(record)}
              >
                <Button {...rowActionKind('delete')} />
              </Popconfirm>,
            );
          }
          return parts;
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, calcTypeOptions, kpiPerms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<KPIDefinition>
          headerTitle={t('app.kuaizhizao.performance.kpi.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.kpi-definitions.v3"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.kpiDefinitions')}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_PINNED_IS_ACTIVE_FIELD}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const listParams = resolveKpiDefinitionListParams(searchFormValues, sort);
              const response = await employeePerformanceApi.listKpiDefinitions({
                skip,
                limit: pageSize,
                ...listParams,
              });
              const { data, total } = normalizePerformanceListResponse(response);
              return { data: data as KPIDefinition[], success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={kpiPerms.canDelete}
          showDeleteButton={kpiPerms.canDelete}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await employeePerformanceApi.deleteKpiDefinition(Number(id));
              }
              messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t('common.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.kpi.messages.deleteBatchConfirm', { count })}
          showCreateButton={kpiPerms.canCreate}
          createButtonText={t('app.kuaizhizao.performance.kpi.createButton')}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? t('app.kuaizhizao.performance.kpi.modal.editTitle') : t('app.kuaizhizao.performance.kpi.modal.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          let formula_json: Record<string, unknown> | undefined;
          if (values.formula_json) {
            try {
              formula_json = JSON.parse(values.formula_json);
            } catch {
              messageApi.error(t('app.kuaizhizao.performance.common.messages.invalidJson'));
              return;
            }
          }
          const payload = {
            code: values.code,
            name: values.name,
            weight: values.weight || 1,
            calc_type: values.calc_type,
            is_active: values.is_active !== false,
            formula_json,
          };
          if (editId) {
            await employeePerformanceApi.updateKpiDefinition(editId, payload);
            messageApi.success(t('common.updateSuccess'));
          } else {
            await employeePerformanceApi.createKpiDefinition(payload);
            messageApi.success(t('common.createSuccess'));
          }
          setModalVisible(false);
          setEditId(null);
          actionRef.current?.reload();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText name="code" label={t('app.kuaizhizao.performance.common.columns.code')} rules={[{ required: true }]} colProps={{ span: 12 }} disabled={!!editId} />
        <ProFormText name="name" label={t('common.name')} rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormDigit name="weight" label={t('app.kuaizhizao.performance.common.columns.weight')} min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormSelect name="calc_type" label={t('app.kuaizhizao.performance.common.columns.calcType')} rules={[{ required: true }]} options={calcTypeOptions} colProps={{ span: 12 }} />
        <ProFormTextArea
          name="formula_json"
          label={t('app.kuaizhizao.performance.kpi.form.formulaJson')}
          colProps={{ span: 24 }}
          fieldProps={{ rows: 4 }}
          placeholder={t('app.kuaizhizao.performance.kpi.form.formulaPlaceholder')}
        />
        <ProFormSwitch name="is_active" label={t('common.enabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.kpi.detailTitle')}
        open={drawerVisible}
        zIndex={detailDrawerZIndex}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        detail={detail}
        detailColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && kpiPerms.canUpdate), () => {
          if (!detail) return;
          setEditId(detail.id);
          setModalVisible(true);
        })}
      />
    </>
  );
};

export default KpiDefinitionsPage;
