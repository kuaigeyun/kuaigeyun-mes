/**
 * 员工绩效配置页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, theme as AntdTheme } from 'antd';
import dayjs from 'dayjs';
import { ProFormSelect, ProFormDigit, ProFormSwitch, ProFormDatePicker, ProFormField } from '@ant-design/pro-components';
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
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { employeePerformanceApi } from '../../../services/performance';
import type { EmployeePerformanceConfig } from '../../../types/performance';
import {
  modalDateFieldProps,
  modalFieldLayoutFromColSpan,
  PERFORMANCE_FORM_MODAL_CLASS,
} from '../../../utils/performanceFormLayout';
import {
  getCalcModeOptions,
  getCalcModeText,
  getPerformanceYesNoValueEnum,
  getPieceRateModeOptions,
  getPieceRateModeText,
  renderActiveTag,
  renderPerformanceTypeMarker,
} from '../components/performanceMeta';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_IS_ACTIVE_FIELD,
  resolveEmployeeConfigListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const CONFIG_RESOURCE = 'kuaizhizao:performance-employee-configs';

const EmployeeConfigsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const detailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const configPerms = useResourcePermissions(CONFIG_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<EmployeePerformanceConfig | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  const calcModeOptions = useMemo(() => getCalcModeOptions(t), [t]);
  const pieceRateModeOptions = useMemo(() => getPieceRateModeOptions(t), [t]);

  useEffect(() => {
    employeePerformanceApi.listEmployees({ limit: 500 }).then((r) => {
      setEmployees(r.items.map((e) => ({ id: e.id, full_name: e.full_name || e.username })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ calc_mode: 'time', is_active: true });
      return;
    }
    employeePerformanceApi.getConfig(editId).then((c) => {
      formRef.current?.setFieldsValue({
        employee_id: c.employee_id,
        calc_mode: c.calc_mode || 'time',
        piece_rate_mode: c.piece_rate_mode || 'operation',
        hourly_rate: c.hourly_rate,
        default_piece_rate: c.default_piece_rate,
        base_salary: c.base_salary,
        effective_from: c.effective_from ? dayjs(c.effective_from) : undefined,
        effective_to: c.effective_to ? dayjs(c.effective_to) : undefined,
        is_active: c.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || t('common.loadFailed')));
  }, [modalVisible, editId, messageApi, t]);

  const detailColumns: ProDescriptionsItemProps<EmployeePerformanceConfig>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.common.columns.employee'), dataIndex: 'employee_name' },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcMode'),
        dataIndex: 'calc_mode',
        render: (_, r) => renderPerformanceTypeMarker(getCalcModeText(t, r?.calc_mode)),
      },
      {
        title: t('app.kuaizhizao.performance.employeeConfigs.form.pieceRateMode'),
        dataIndex: 'piece_rate_mode',
        render: (_, r) => renderPerformanceTypeMarker(getPieceRateModeText(t, r?.piece_rate_mode)),
      },
      { title: t('app.kuaizhizao.performance.employeeConfigs.columns.hourlyRate'), dataIndex: 'hourly_rate' },
      { title: t('app.kuaizhizao.performance.employeeConfigs.columns.defaultPieceRate'), dataIndex: 'default_piece_rate' },
      { title: t('app.kuaizhizao.performance.employeeConfigs.columns.baseSalary'), dataIndex: 'base_salary' },
      {
        title: t('app.kuaizhizao.performance.employeeConfigs.form.effectiveFrom'),
        dataIndex: 'effective_from',
        valueType: 'date',
      },
      {
        title: t('app.kuaizhizao.performance.employeeConfigs.form.effectiveTo'),
        dataIndex: 'effective_to',
        valueType: 'date',
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
  const handleEdit = (record: EmployeePerformanceConfig) => {
    setEditId(record.id);
    setModalVisible(true);
  };
  const handleDelete = async (record: EmployeePerformanceConfig) => {
    try {
      await employeePerformanceApi.deleteConfig(record.id);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.deleteFailed'));
    }
  };
  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await employeePerformanceApi.getConfig(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: EmployeePerformanceConfig) => {
    detailRetryIdRef.current = record.id;
    setDrawerVisible(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(record.id);
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setDetail(null);
    setDetailError(null);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditId(null);
    actionRef.current?.reload();
  };

  const columns: ProColumns<EmployeePerformanceConfig>[] = useMemo(
    () => alignProColumns<EmployeePerformanceConfig>([
      {
        // 列稀疏：业务列不堆叠（表单序：员工 → 计薪模式 → 单价/底薪 → 启用）；审计叠列保留
        title: t('app.kuaizhizao.performance.common.columns.employee'),
        key: 'performance_employee_name',
        dataIndex: 'employee_name',
        minWidth: 140,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcMode'),
        dataIndex: 'calc_mode',
        hideInTable: true,
        valueType: 'select',
        valueEnum: Object.fromEntries(calcModeOptions.map((o) => [o.value, { text: o.label }])),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcMode'),
        dataIndex: 'calc_mode',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => renderPerformanceTypeMarker(getCalcModeText(t, r.calc_mode)),
      },
      {
        title: t('app.kuaizhizao.performance.employeeConfigs.columns.hourlyRate'),
        dataIndex: 'hourly_rate',
        // 表头「工时单价（元/时）」+ 排序钮，勿按单元格数字估宽
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.performance.employeeConfigs.columns.defaultPieceRate'),
        dataIndex: 'default_piece_rate',
        // 表头「默认计件单价（元/件）」+ 排序钮
        width: 200,
        minWidth: 200,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.performance.employeeConfigs.columns.baseSalary'),
        dataIndex: 'base_salary',
        // 表头「月保障工资（元）」+ 排序钮
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        hideInTable: true,
        valueEnum: getPerformanceYesNoValueEnum(t),
      },
      ...buildDocumentAuditColumns<EmployeePerformanceConfig>(t),
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
          if (configPerms.canRead) {
            parts.push(
              <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)} />,
            );
          }
          if (configPerms.canUpdate) {
            parts.push(
              <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)} />,
            );
          }
          if (configPerms.canDelete) {
            parts.push(
              <Popconfirm
                key="delete"
                title={t('app.kuaizhizao.performance.employeeConfigs.messages.deleteConfirm')}
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
    [t, calcModeOptions, configPerms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<EmployeePerformanceConfig>
          headerTitle={t('app.kuaizhizao.performance.employeeConfigs.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.employee-configs.v4"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.employeeConfigs')}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_PINNED_IS_ACTIVE_FIELD}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const listParams = resolveEmployeeConfigListParams(searchFormValues, sort);
              const response = await employeePerformanceApi.listConfigs({
                skip,
                limit: pageSize,
                ...listParams,
              });
              const { data, total } = normalizePerformanceListResponse(response);
              return { data: data as EmployeePerformanceConfig[], success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={configPerms.canDelete}
          showDeleteButton={configPerms.canDelete}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await employeePerformanceApi.deleteConfig(Number(id));
              }
              messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
    actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t('common.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.employeeConfigs.messages.deleteBatchConfirm', { count })}
          showCreateButton={configPerms.canCreate}
          createButtonText={t('app.kuaizhizao.performance.employeeConfigs.createButton')}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? t('app.kuaizhizao.performance.employeeConfigs.modal.editTitle') : t('app.kuaizhizao.performance.employeeConfigs.modal.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          let calcMode = values.calc_mode || 'time';
          // 填了默认计件单价却仍为「计时」时，自动改为混合，避免计件金额算成 0
          if (
            calcMode === 'time' &&
            values.default_piece_rate != null &&
            Number(values.default_piece_rate) > 0
          ) {
            calcMode = 'mixed';
          }
          const payload = {
            employee_id: values.employee_id,
            employee_name: employees.find((e) => e.id === values.employee_id)?.full_name,
            calc_mode: calcMode,
            piece_rate_mode: values.piece_rate_mode || (calcMode === 'time' ? undefined : 'default'),
            hourly_rate: values.hourly_rate,
            default_piece_rate: values.default_piece_rate,
            base_salary: values.base_salary,
            effective_from: values.effective_from?.format?.('YYYY-MM-DD') ?? values.effective_from,
            effective_to: values.effective_to?.format?.('YYYY-MM-DD') ?? values.effective_to,
            is_active: values.is_active !== false,
          };
          if (editId) {
            await employeePerformanceApi.updateConfig(editId, payload);
            messageApi.success(t('common.updateSuccess'));
          } else {
            await employeePerformanceApi.createConfig(payload);
            messageApi.success(t('common.createSuccess'));
          }
          handleModalSuccess();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        className={PERFORMANCE_FORM_MODAL_CLASS}
        layout="vertical"
        grid={false}
      >
        <ProFormSelect
          name="employee_id"
          label={t('app.kuaizhizao.performance.common.columns.employee')}
          rules={[{ required: true }]}
          options={employees.map((e) => ({ label: e.full_name, value: e.id }))}
          formItemProps={modalFieldLayoutFromColSpan(12)}
          disabled={!!editId}
        />
        <ProFormField
          name="calc_mode"
          label={t('app.kuaizhizao.performance.common.columns.calcMode')}
          formItemProps={modalFieldLayoutFromColSpan(12)}
          renderFormItem={(_, { value, onChange }) => (
            <ThemedSegmented
              block
              className="form-field-segmented"
              value={value ?? 'time'}
              onChange={(v) => onChange?.(v)}
              options={calcModeOptions}
            />
          )}
        />
        <ProFormSelect name="piece_rate_mode" label={t('app.kuaizhizao.performance.employeeConfigs.form.pieceRateMode')} options={pieceRateModeOptions} formItemProps={modalFieldLayoutFromColSpan(12)} />
        <ProFormDigit name="hourly_rate" label={t('app.kuaizhizao.performance.employeeConfigs.form.hourlyRate')} min={0} fieldProps={{ precision: 2 }} formItemProps={modalFieldLayoutFromColSpan(12)} />
        <ProFormDigit name="default_piece_rate" label={t('app.kuaizhizao.performance.employeeConfigs.form.defaultPieceRate')} min={0} fieldProps={{ precision: 4 }} formItemProps={modalFieldLayoutFromColSpan(12)} />
        <ProFormDigit name="base_salary" label={t('app.kuaizhizao.performance.employeeConfigs.form.baseSalary')} min={0} fieldProps={{ precision: 2 }} formItemProps={modalFieldLayoutFromColSpan(12)} />
        <ProFormDatePicker name="effective_from" label={t('app.kuaizhizao.performance.employeeConfigs.form.effectiveFrom')} {...modalDateFieldProps()} />
        <ProFormDatePicker name="effective_to" label={t('app.kuaizhizao.performance.employeeConfigs.form.effectiveTo')} {...modalDateFieldProps()} />
        <ProFormSwitch name="is_active" label={t('common.enabled')} formItemProps={modalFieldLayoutFromColSpan(12)} />
      </FormModalTemplate>

      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.employeeConfigs.detailTitle')}
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
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && configPerms.canUpdate), () => {
          if (!detail) return;
          setEditId(detail.id);
          setModalVisible(true);
        })}
      />
    </>
  );
};

export default EmployeeConfigsPage;
