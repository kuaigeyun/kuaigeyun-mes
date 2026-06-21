/**
 * 员工绩效配置页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProFormSelect, ProFormDigit, ProFormSwitch, ProFormDatePicker, ProFormField } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { employeePerformanceApi } from '../../../services/performance';
import type { EmployeePerformanceConfig } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';
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
} from '../components/performanceMeta';
import { formatDateTime } from '../../../../../utils/format';

const EmployeeConfigsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);

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
    }).catch((e: any) => messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed')));
  }, [modalVisible, editId, messageApi, t]);

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
      messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
    }
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditId(null);
    actionRef.current?.reload();
  };

  const columns: ProColumns<EmployeePerformanceConfig>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.performance.common.columns.employee'),
        dataIndex: 'employee_name',
        width: 120,
        ellipsis: true,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.employee_name ?? '') }} ellipsis>
            {r.employee_name ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcMode'),
        dataIndex: 'calc_mode',
        width: 100,
        render: (_, r) => <Tag>{getCalcModeText(t, r.calc_mode)}</Tag>,
      },
      { title: t('app.kuaizhizao.performance.employeeConfigs.columns.hourlyRate'), dataIndex: 'hourly_rate', width: 120, align: 'right' },
      { title: t('app.kuaizhizao.performance.employeeConfigs.columns.defaultPieceRate'), dataIndex: 'default_piece_rate', width: 140, align: 'right' },
      { title: t('app.kuaizhizao.performance.employeeConfigs.columns.baseSalary'), dataIndex: 'base_salary', width: 120, align: 'right' },
      {
        title: t('app.kuaizhizao.performance.common.form.active'),
        dataIndex: 'is_active',
        hideInTable: true,
        valueEnum: getPerformanceYesNoValueEnum(t),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getPerformanceConfigActiveLifecycle(record as unknown as Record<string, unknown>);
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
        title: t('app.kuaizhizao.performance.common.columns.actions'),
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              {t('app.kuaizhizao.performance.common.actions.edit')}
            </Button>
            <Popconfirm title={t('app.kuaizhizao.performance.employeeConfigs.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('app.kuaizhizao.performance.common.actions.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<EmployeePerformanceConfig>
          headerTitle={t('app.kuaizhizao.performance.employeeConfigs.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.employee-configs"
          showAdvancedSearch
          request={async (params) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const result = await employeePerformanceApi.listConfigs({
                skip,
                limit: pageSize,
              });
              const rows = Array.isArray(result) ? result : [];
              const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
              return { data: rows, success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1500 }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await employeePerformanceApi.deleteConfig(Number(id));
              }
              messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.employeeConfigs.messages.deleteBatchConfirm', { count })}
          showCreateButton
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
          const payload = {
            employee_id: values.employee_id,
            employee_name: employees.find((e) => e.id === values.employee_id)?.full_name,
            calc_mode: values.calc_mode || 'time',
            piece_rate_mode: values.piece_rate_mode,
            hourly_rate: values.hourly_rate,
            default_piece_rate: values.default_piece_rate,
            base_salary: values.base_salary,
            effective_from: values.effective_from?.format?.('YYYY-MM-DD') ?? values.effective_from,
            effective_to: values.effective_to?.format?.('YYYY-MM-DD') ?? values.effective_to,
            is_active: values.is_active !== false,
          };
          if (editId) {
            await employeePerformanceApi.updateConfig(editId, payload);
            messageApi.success(t('app.kuaizhizao.performance.common.messages.updateSuccess'));
          } else {
            await employeePerformanceApi.createConfig(payload);
            messageApi.success(t('app.kuaizhizao.performance.common.messages.createSuccess'));
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
        <ProFormSwitch name="is_active" label={t('app.kuaizhizao.performance.common.form.active')} formItemProps={modalFieldLayoutFromColSpan(12)} />
      </FormModalTemplate>
    </>
  );
};

export default EmployeeConfigsPage;
