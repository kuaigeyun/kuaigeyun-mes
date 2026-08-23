/**
 * 图档借阅：借阅单列表 + 密级授权
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDateTimePicker,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form, Row, Select, Space, Table } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniTableStackedPrimaryCell, UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  DetailDrawerSection,
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { detailDrawerDescriptionItems } from '../../../../../components/layout-templates/detailDrawerDescriptionItems';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { detailDrawerBasicColumn } from '../../../../../components/layout-templates/constants';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../../../kuaizhizao/pages/shared/documentAuditColumns';
import { drawingApi, type EngineeringDrawing } from '../../../services/drawing';
import {
  drawingLoanApi,
  type DrawingClearance,
  type DrawingLoan,
  type DrawingLoanStatus,
  type DrawingSecurityLevel,
} from '../../../services/drawingLoan';
import { getUserList } from '../../../../../services/user';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const RESOURCE = 'master-data:process:drawing-loan';

const STATUS_COLOR: Record<DrawingLoanStatus, string> = {
  Draft: 'default',
  Pending: 'processing',
  Borrowed: 'success',
  Returned: 'default',
};

const SECURITY_LEVELS: DrawingSecurityLevel[] = ['public', 'internal', 'secret', 'confidential'];

type FormLine = { drawingUuid?: string };

function dueAtPayload(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'format' in value) {
    return (value as { format: (fmt: string) => string }).format('YYYY-MM-DD HH:mm:ss');
  }
  return '';
}

const DrawingLoansPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<DrawingLoan[]>([]);
  const formRef = useRef<ProFormInstance>(undefined);
  const clearanceFormRef = useRef<ProFormInstance>(undefined);
  const perms = useResourcePermissions(RESOURCE);
  const canSubmit = !!perms.canAction?.('submit');
  const canApprove = !!perms.canAction?.('approve');
  const canReject = !!perms.canAction?.('reject');
  const canRevoke = !!perms.canAction?.('revoke');
  const canComplete = !!perms.canAction?.('complete');

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DrawingLoan | null>(null);
  const [detail, setDetail] = useState<DrawingLoan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [releasedDrawings, setReleasedDrawings] = useState<EngineeringDrawing[]>([]);
  const [clearanceOpen, setClearanceOpen] = useState(false);
  const [clearances, setClearances] = useState<DrawingClearance[]>([]);
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: number }>>([]);

  useEffect(() => {
    void drawingApi.list({ status: 'Released', limit: 200 }).then((res) => setReleasedDrawings(res.data ?? []));
  }, []);

  const reload = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);
  useNewShortcut(openCreate);

  const securityLabel = useCallback(
    (level?: string) => (level ? t(`app.master-data.drawings.securityLevel.${level}`) : '-'),
    [t],
  );

  const loadClearances = useCallback(async () => {
    const [clearanceRes, userRes] = await Promise.all([
      drawingLoanApi.listClearances(),
      getUserList({ page: 1, page_size: 200, is_active: true }),
    ]);
    setClearances(clearanceRes.data ?? []);
    setUserOptions(
      (userRes.items ?? []).map((user) => ({
        value: user.id,
        label: `${user.full_name || user.username}`.trim(),
      })),
    );
  }, []);

  const openDetail = useCallback(async (row: DrawingLoan) => {
    setDetail(row);
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await drawingLoanApi.get(row.uuid));
    } catch (e) {
      setDetailError(getApiErrorMessage(e) || t('common.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const runAction = useCallback(
    async (fn: () => Promise<unknown>, successKey: string) => {
      try {
        await fn();
        messageApi.success(t(successKey));
        reload();
        if (detail?.uuid) {
          setDetail(await drawingLoanApi.get(detail.uuid));
        }
      } catch (e) {
        messageApi.error(getApiErrorMessage(e) || t('common.operationFailed'));
      }
    },
    [detail?.uuid, messageApi, reload, t],
  );

  const handleComplete = useCallback(
    (row: DrawingLoan) => {
      modalApi.confirm({
        title: t('app.master-data.drawingLoans.completeConfirm'),
        onOk: () => runAction(() => drawingLoanApi.complete(row.uuid), 'app.master-data.drawingLoans.completeSuccess'),
      });
    },
    [modalApi, runAction, t],
  );

  const columns: ProColumns<DrawingLoan>[] = useMemo(
    () => [
      {
        title: t('app.master-data.drawingLoans.name'),
        dataIndex: 'name',
        key: 'name_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, row) => (
          <UniTableStackedPrimaryCell primary={row.name} secondary={row.code} />
        ),
      },
      {
        title: t('app.master-data.drawingLoans.code'),
        dataIndex: 'code',
        hideInTable: true,
      },
      {
        title: t('app.master-data.drawingLoans.purpose'),
        dataIndex: 'purpose',
        hideInSearch: true,
        ellipsis: true,
        width: 160,
      },
      {
        title: t('app.master-data.drawingLoans.dueAt'),
        dataIndex: 'dueAt',
        hideInSearch: true,
        width: 160,
        render: (_, row) => (row.dueAt ? formatDateTimeBySiteSetting(row.dueAt) : '-'),
      },
      ...buildDocumentAuditColumns<DrawingLoan>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        fixed: 'right',
        valueEnum: {
          Draft: { text: t('app.master-data.drawingLoans.status.Draft') },
          Pending: { text: t('app.master-data.drawingLoans.status.Pending') },
          Borrowed: { text: t('app.master-data.drawingLoans.status.Borrowed') },
          Returned: { text: t('app.master-data.drawingLoans.status.Returned') },
        },
        render: (_, row) => (
          <StatusTag color={STATUS_COLOR[row.status] ?? 'default'}>
            {t(`app.master-data.drawingLoans.status.${row.status}`)}
          </StatusTag>
        ),
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 220,
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => [
          <Button key="detail" {...rowActionKind('read')} type="link" size="small" onClick={() => void openDetail(row)}>
            {t('common.detail')}
          </Button>,
          row.status === 'Draft' && perms.canUpdate ? (
            <Button
              key="edit"
              {...rowActionKind('update')}
              type="link"
              size="small"
              onClick={() => {
                void drawingLoanApi.get(row.uuid).then((full) => {
                  setEditing(full);
                  setModalOpen(true);
                });
              }}
            >
              {t('common.edit')}
            </Button>
          ) : null,
          row.status === 'Draft' && canSubmit ? (
            <Button key="submit" {...rowActionKind('submit')} type="link" size="small" onClick={() => void runAction(() => drawingLoanApi.submit(row.uuid), 'app.master-data.drawingLoans.submitSuccess')}>
              {t('common.submit')}
            </Button>
          ) : null,
          row.status === 'Pending' && canApprove ? (
            <Button key="approve" {...rowActionKind('approve')} type="link" size="small" onClick={() => void runAction(() => drawingLoanApi.approve(row.uuid), 'app.master-data.drawingLoans.approveSuccess')}>
              {t('app.master-data.drawingLoans.approve')}
            </Button>
          ) : null,
          row.status === 'Pending' && canReject ? (
            <Button key="reject" {...rowActionKind('reject')} type="link" size="small" onClick={() => void runAction(() => drawingLoanApi.reject(row.uuid), 'app.master-data.drawingLoans.rejectSuccess')}>
              {t('app.master-data.drawingLoans.reject')}
            </Button>
          ) : null,
          row.status === 'Pending' && canRevoke ? (
            <Button key="revoke" {...rowActionKind('revoke')} type="link" size="small" onClick={() => void runAction(() => drawingLoanApi.revoke(row.uuid), 'app.master-data.drawingLoans.revokeSuccess')}>
              {t('app.master-data.drawingLoans.revoke')}
            </Button>
          ) : null,
          row.status === 'Borrowed' && canComplete ? (
            <Button key="complete" {...rowActionKind('complete')} type="link" size="small" onClick={() => handleComplete(row)}>
              {t('app.master-data.drawingLoans.complete')}
            </Button>
          ) : null,
        ].filter(Boolean),
      },
    ],
    [canApprove, canComplete, canReject, canRevoke, canSubmit, handleComplete, openDetail, perms.canUpdate, runAction, t],
  );

  const basicItems = useMemo(() => {
    if (!detail) return [];
    return detailDrawerDescriptionItems(
      alignDescriptionColumns(
        [
          { title: t('app.master-data.drawingLoans.code'), dataIndex: 'code' },
          { title: t('app.master-data.drawingLoans.name'), dataIndex: 'name' },
          { title: t('app.master-data.drawingLoans.purpose'), dataIndex: 'purpose' },
          {
            title: t('app.master-data.drawingLoans.dueAt'),
            dataIndex: 'dueAt',
            render: (_, row) => (row.dueAt ? formatDateTimeBySiteSetting(row.dueAt) : '-'),
          },
          {
            title: t('app.master-data.drawingLoans.returnedAt'),
            dataIndex: 'returnedAt',
            render: (_, row) => (row.returnedAt ? formatDateTimeBySiteSetting(row.returnedAt) : '-'),
          },
          { title: t('app.master-data.drawingLoans.returnedBy'), dataIndex: 'returnedByName' },
        ],
        GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
      ),
      detail,
    );
  }, [detail, t]);

  return (
    <ListPageTemplate>
      <UniTable<DrawingLoan>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.drawingLoans')}
        headerTitle={t('app.master-data.menu.process.drawing-loans')}
        actionRef={actionRef}
        rowKey="uuid"
        permissionResource={RESOURCE}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.master-data.pages.process.drawing-loans.v1"
        showCreateButton={perms.canCreate}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((row) => keys.includes(row.uuid));
          const deletable = rows.filter((row) => row.status === 'Draft');
          if (!deletable.length) {
            messageApi.warning(t('app.master-data.drawingLoans.deleteOnlyDraft'));
            return;
          }
          await Promise.all(deletable.map((row) => drawingLoanApi.delete(row.uuid)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async ({ selectedRowKeys: keys }) => {
          const items = keys?.length
            ? tableRowsRef.current.filter((row) => keys.includes(row.uuid))
            : tableRowsRef.current;
          if (!items.length) {
            messageApi.warning(t('common.exportNoData'));
            return;
          }
          await downloadRecordsAsXlsx(items as Array<Record<string, unknown>>, `drawing-loans-${todaySiteDateString()}.xlsx`);
          messageApi.success(t('common.exportSuccess', { count: items.length }));
        }}
        toolBarRender={() => [
          perms.canUpdate ? (
            <Button
              key="clearance"
              onClick={() => {
                setClearanceOpen(true);
                void loadClearances();
              }}
            >
              {t('app.master-data.drawingLoans.clearance')}
            </Button>
          ) : null,
        ]}
        request={async (params) => {
          const res = await drawingLoanApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: params.status,
            keyword: params.keyword || params.name || params.code,
          });
          return { data: res.data ?? [], total: res.total ?? 0, success: true };
        }}
      />

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={editing ? t('common.edit') : t('common.create')}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          formRef.current?.resetFields();
        }}
        isEdit={!!editing}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={
          editing
            ? {
                name: editing.name,
                purpose: editing.purpose,
                dueAt: editing.dueAt,
                lines: editing.lines?.map((line) => ({ drawingUuid: line.drawingUuid })) ?? [],
              }
            : { lines: [{}] }
        }
        onFinish={async (values) => {
          const lines = ((values.lines as FormLine[]) || []).filter((line) => line.drawingUuid);
          const dueAt = dueAtPayload(values.dueAt);
          if (!dueAt) {
            messageApi.error(t('app.master-data.drawingLoans.dueAtRequired'));
            return;
          }
          const payload = { name: values.name, purpose: values.purpose, dueAt, lines };
          if (editing) {
            await drawingLoanApi.update(editing.uuid, payload);
          } else {
            await drawingLoanApi.create(payload);
          }
          messageApi.success(t('common.saveSuccess'));
          setModalOpen(false);
          setEditing(null);
          reload();
        }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormText
              name="name"
              label={t('app.master-data.drawingLoans.name')}
              rules={[{ required: true, message: t('app.master-data.drawingLoans.nameRequired') }]}
            />
          </Col>
          <Col span={8}>
            <ProFormText name="purpose" label={t('app.master-data.drawingLoans.purpose')} />
          </Col>
          <Col span={8}>
            <ProFormDateTimePicker
              name="dueAt"
              label={t('app.master-data.drawingLoans.dueAt')}
              rules={[{ required: true, message: t('app.master-data.drawingLoans.dueAtRequired') }]}
            />
          </Col>
        </Row>
        <UniTableDetail
          name="lines"
          title={t('app.master-data.drawingLoans.lines')}
          required
          requiredMessage={t('app.master-data.drawingLoans.linesRequired')}
          initialValue={{ drawingUuid: undefined }}
          columns={[
            {
              title: t('app.master-data.drawings.code'),
              dataIndex: 'drawingUuid',
              render: (_: unknown, __: unknown, index: number) => (
                <Form.Item name={[index, 'drawingUuid']} rules={[{ required: true }]} style={{ margin: 0 }}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={releasedDrawings.map((row) => ({
                      value: row.uuid,
                      label: `${row.code} ${row.name} ${row.revision} ${securityLabel(row.securityLevel)}`.trim(),
                    }))}
                  />
                </Form.Item>
              ),
            },
          ]}
          tableProps={{ size: 'small', style: { width: '100%', margin: 0 } }}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.master-data.drawingLoans.clearance')}
        open={clearanceOpen}
        onClose={() => {
          setClearanceOpen(false);
          clearanceFormRef.current?.resetFields();
        }}
        formRef={clearanceFormRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        grid={false}
        onFinish={async (values) => {
          await drawingLoanApi.upsertClearance({
            userId: values.userId,
            securityLevel: values.securityLevel,
          });
          messageApi.success(t('app.master-data.drawingLoans.clearanceSaved'));
          clearanceFormRef.current?.resetFields();
          await loadClearances();
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="userId"
              label={t('app.master-data.drawingLoans.clearanceUser')}
              options={userOptions}
              showSearch
              fieldProps={{ optionFilterProp: 'label' }}
              rules={[{ required: true, message: t('app.master-data.drawingLoans.clearanceUserRequired') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="securityLevel"
              label={t('app.master-data.drawingLoans.clearanceLevel')}
              options={SECURITY_LEVELS.map((level) => ({
                value: level,
                label: t(`app.master-data.drawings.securityLevel.${level}`),
              }))}
              rules={[{ required: true }]}
            />
          </Col>
        </Row>
        <Table
          rowKey="userId"
          size="small"
          pagination={false}
          style={{ width: '100%', margin: 0 }}
          dataSource={clearances}
          columns={[
            { title: t('app.master-data.drawingLoans.clearanceUser'), dataIndex: 'userName' },
            {
              title: t('app.master-data.drawingLoans.clearanceLevel'),
              dataIndex: 'securityLevel',
              render: (level: DrawingSecurityLevel) => (
                <MarkerTag color="geekblue">{securityLabel(level)}</MarkerTag>
              ),
            },
            {
              title: t('common.actions'),
              width: 80,
              render: (_, row) =>
                perms.canDelete ? (
                  <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() => {
                      void drawingLoanApi.deleteClearance(row.userId).then(async () => {
                        messageApi.success(t('app.master-data.drawingLoans.clearanceDeleted'));
                        await loadClearances();
                      });
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                ) : null,
            },
          ]}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={t('app.master-data.drawingLoans.detailTitle')}
        loading={detailLoading}
        extra={
          detail ? (
            <Space>
              {detail.status === 'Draft' && canSubmit ? (
                <Button type="primary" size="small" onClick={() => void runAction(() => drawingLoanApi.submit(detail.uuid), 'app.master-data.drawingLoans.submitSuccess')}>
                  {t('common.submit')}
                </Button>
              ) : null}
              {detail.status === 'Pending' && canApprove ? (
                <Button type="primary" size="small" onClick={() => void runAction(() => drawingLoanApi.approve(detail.uuid), 'app.master-data.drawingLoans.approveSuccess')}>
                  {t('app.master-data.drawingLoans.approve')}
                </Button>
              ) : null}
              {detail.status === 'Borrowed' && canComplete ? (
                <Button size="small" onClick={() => handleComplete(detail)}>
                  {t('app.master-data.drawingLoans.complete')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
        basic={
          detailError ? (
            <div>
              <p>{detailError}</p>
              <Button onClick={() => detail && void openDetail(detail)}>{t('common.retry')}</Button>
            </div>
          ) : detail ? (
            <DetailDrawerSection title={t('app.master-data.drawingLoans.basicInfo')}>
              <Descriptions column={detailDrawerBasicColumn(false)} size="small" items={basicItems} />
            </DetailDrawerSection>
          ) : null
        }
        lines={
          detail && !detailError ? (
            <DetailDrawerSection title={t('app.master-data.drawingLoans.lines')}>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.lines ?? []}
                columns={[
                  { title: t('app.master-data.drawings.code'), dataIndex: 'drawingCode' },
                  { title: t('app.master-data.drawings.name'), dataIndex: 'drawingName' },
                  { title: t('app.master-data.drawings.revision'), dataIndex: 'drawingRevision', width: 80 },
                  {
                    title: t('app.master-data.drawings.securityLevel'),
                    dataIndex: 'securityLevel',
                    width: 88,
                    render: (level: DrawingSecurityLevel) => securityLabel(level),
                  },
                ]}
              />
            </DetailDrawerSection>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default DrawingLoansPage;
