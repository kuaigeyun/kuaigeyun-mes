/**
 * 生产日报录入（R-13）
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProFormDatePicker,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormDigit,
} from '@ant-design/pro-components';
import { App, Button } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { StatusTag } from '../../../../../constants/statusBadges';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import {
  productionDailyReportApi,
  productionDailyTemplateApi,
  type ProductionDailyFieldDef,
  type ProductionDailyReport,
  type ProductionDailyTemplate,
} from '../../../services/production-daily';

const RESOURCE = 'kuaizhizao:production-daily';

const ProductionDailyReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<ProductionDailyReport[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionDailyReport | null>(null);
  const [templates, setTemplates] = useState<ProductionDailyTemplate[]>([]);
  const [activeSchema, setActiveSchema] = useState<ProductionDailyFieldDef[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await productionDailyTemplateApi.list({ active_only: true });
        setTemplates(res.items);
      } catch (error) {
        setTemplates([]);
        message.error(getApiErrorMessage(error, t('common.loadFailed')));
      }
    })();
  }, [message, t]);

  const templateOptions = useMemo(
    () => templates.map((tpl) => ({ label: tpl.template_name, value: tpl.id })),
    [templates],
  );

  const openCreate = () => {
    setEditing(null);
    const first = templates[0];
    setActiveSchema(first?.field_schema || []);
    setModalOpen(true);
  };

  const openEdit = async (record: ProductionDailyReport) => {
    try {
      const row = await productionDailyReportApi.get(record.id);
      setEditing(row);
      const tpl = templates.find((x) => x.id === row.template_id);
      setActiveSchema(tpl?.field_schema || []);
      setModalOpen(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, t('common.loadFailed')));
    }
  };

  const columns = useMemo<ProColumns<ProductionDailyReport>[]>(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaizhizao.productionDaily.reportCode'),
            dataIndex: 'code',
            width: 150,
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.template_name}
                secondary={record.code}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.productionDaily.reportDate'),
            dataIndex: 'report_date',
            valueType: 'date',
            width: 120,
          },
          {
            title: t('app.kuaizhizao.productionDaily.teamName'),
            dataIndex: 'team_name',
            width: 120,
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.productionDaily.templateName'),
            dataIndex: 'template_name',
            width: 140,
            ellipsis: true,
            hideInTable: true,
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'lifecycle',
            fixed: 'right',
            width: 100,
            render: (_, record) => (
              <StatusTag color={record.status === 'submitted' ? 'success' : 'default'}>
                {record.status === 'submitted'
                  ? t('app.kuaizhizao.productionDaily.status.submitted')
                  : t('app.kuaizhizao.productionDaily.status.draft')}
              </StatusTag>
            ),
          },
          ...buildDocumentAuditColumns(t),
          {
            title: t('common.action'),
            valueType: 'option',
            fixed: 'right',
            render: (_, record) => {
              const actions =
                record.status === 'draft' && perms.canUpdate
                  ? [
                      <Button
                        key="edit"
                        {...rowActionKind('update')}
                        onClick={() => void openEdit(record)}
                      />,
                    ]
                  : [
                      <Button
                        key="read"
                        {...rowActionKind('read')}
                        onClick={() => void openEdit(record)}
                      />,
                    ];
              if (record.status === 'draft' && perms.canUpdate) {
                actions.push(
                  <Button
                    key="submit"
                    {...rowActionKind('submit')}
                    onClick={async () => {
                      try {
                        await productionDailyReportApi.submit(record.id);
                        message.success(t('common.success'));
                        actionRef.current?.reload();
                      } catch (error) {
                        message.error(getApiErrorMessage(error, t('common.failed')));
                      }
                    }}
                  />,
                );
              }
              return actions;
            },
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [perms.canUpdate, t],
  );

  const submittedLocked = editing?.status === 'submitted';

  const renderDynamicFields = () =>
    activeSchema.map((field) => {
      const name = ['field_values', field.key];
      const label = field.label;
      const required = !!field.required && !submittedLocked;
      if (field.type === 'number') {
        return (
          <ProFormDigit
            key={field.key}
            name={name}
            label={label}
            rules={required ? [{ required: true }] : undefined}
            colProps={{ span: 12 }}
            disabled={submittedLocked}
          />
        );
      }
      if (field.type === 'textarea') {
        return (
          <ProFormTextArea
            key={field.key}
            name={name}
            label={label}
            rules={required ? [{ required: true }] : undefined}
            colProps={{ span: 24 }}
            disabled={submittedLocked}
          />
        );
      }
      if (field.type === 'select') {
        return (
          <ProFormSelect
            key={field.key}
            name={name}
            label={label}
            rules={required ? [{ required: true }] : undefined}
            options={(field.options || []).map((o) => ({ label: o, value: o }))}
            colProps={{ span: 12 }}
            disabled={submittedLocked}
          />
        );
      }
      return (
        <ProFormText
          key={field.key}
          name={name}
          label={label}
          rules={required ? [{ required: true }] : undefined}
          colProps={{ span: 12 }}
          disabled={submittedLocked}
        />
      );
    });

  return (
    <ListPageTemplate>
      <UniTable<ProductionDailyReport>
        actionRef={actionRef}
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.production-execution.production-daily-reports')}
        permissionResource={RESOURCE}
        columnPersistenceId="apps.kuaizhizao.production-daily-report.list-v1"
        columns={columns}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        toolBarRender={() => [
          perms.canCreate ? (
            <Button key="create" type="primary" onClick={openCreate}>
              {t('app.kuaizhizao.productionDaily.createReportButton')}
            </Button>
          ) : null,
        ]}
        request={async (params) => {
          const res = await productionDailyReportApi.list({
            keyword: params.keyword,
            template_code: params.template_code,
            team_name: params.team_name,
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        rowActionKind={rowActionKind}
      />

      <FormModalTemplate
        open={modalOpen}
        title={
          editing?.status === 'submitted'
            ? t('common.detail')
            : editing
              ? t('app.kuaizhizao.productionDaily.editReportTitle')
              : t('app.kuaizhizao.productionDaily.createReportButton')
        }
        readOnly={editing?.status === 'submitted'}
        submitHidden={editing?.status === 'submitted'}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        grid
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        initialValues={
          editing
            ? {
                ...editing,
                report_date: editing.report_date ? dayjs(editing.report_date) : undefined,
                field_values: editing.field_values || {},
              }
            : {
                template_id: templates[0]?.id,
                report_date: dayjs(),
                field_values: {},
              }
        }
        onFinish={async (values) => {
          const payload = {
            template_id: values.template_id,
            report_date: values.report_date
              ? dayjs(values.report_date).format('YYYY-MM-DD')
              : undefined,
            team_name: values.team_name,
            shift_name: values.shift_name,
            workshop_name: values.workshop_name,
            plant_name: values.plant_name,
            field_values: values.field_values || {},
            remarks: values.remarks,
            submit: false,
          };
          try {
            if (editing) {
              await productionDailyReportApi.update(editing.id, payload);
            } else {
              await productionDailyReportApi.create(payload);
            }
            message.success(t('common.saveSuccess'));
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (error) {
            message.error(getApiErrorMessage(error, t('common.saveFailed')));
            return false;
          }
        }}
      >
        <ProFormSelect
          name="template_id"
          label={t('app.kuaizhizao.productionDaily.templateName')}
          options={templateOptions}
          rules={[{ required: true }]}
          disabled={!!editing}
          colProps={{ span: 12 }}
          fieldProps={{
            onChange: (value: number) => {
              const tpl = templates.find((x) => x.id === value);
              setActiveSchema(tpl?.field_schema || []);
            },
          }}
        />
        <ProFormDatePicker
          name="report_date"
          label={t('app.kuaizhizao.productionDaily.reportDate')}
          rules={[{ required: true }]}
          colProps={{ span: 12 }}
          disabled={submittedLocked}
        />
        <ProFormText
          name="team_name"
          label={t('app.kuaizhizao.productionDaily.teamName')}
          colProps={{ span: 12 }}
          disabled={submittedLocked}
        />
        <ProFormText
          name="shift_name"
          label={t('app.kuaizhizao.productionDaily.shiftName')}
          colProps={{ span: 12 }}
          disabled={submittedLocked}
        />
        <ProFormText
          name="workshop_name"
          label={t('app.kuaizhizao.productionDaily.workshopName')}
          colProps={{ span: 12 }}
          disabled={submittedLocked}
        />
        <ProFormText
          name="plant_name"
          label={t('app.kuaizhizao.productionDaily.plantName')}
          colProps={{ span: 12 }}
          disabled={submittedLocked}
        />
        <ProFormDependency name={['template_id']}>
          {() => <>{renderDynamicFields()}</>}
        </ProFormDependency>
        <ProFormTextArea
          name="remarks"
          label={t('common.remark')}
          colProps={{ span: 24 }}
          disabled={submittedLocked}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ProductionDailyReportsPage;
