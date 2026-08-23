/**
 * 图档发放：发放单列表 + 车间只读已发放版策略
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormInstance, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form, Input, Row, Select, Space, Switch, Table } from 'antd';
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
import { StatusTag } from '../../../../../constants/statusBadges';
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
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  drawingDistributionApi,
  type DrawingDistribution,
  type DrawingDistributionStatus,
} from '../../../services/drawingDistribution';

const RESOURCE = 'master-data:process:drawing-distribution';

const STATUS_COLOR: Record<DrawingDistributionStatus, string> = {
  Draft: 'default',
  Pending: 'processing',
  Issued: 'success',
  Recalled: 'default',
};

type FormLine = { drawingUuid?: string };

const DrawingDistributionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<DrawingDistribution[]>([]);
  const formRef = useRef<ProFormInstance>(undefined);
  const perms = useResourcePermissions(RESOURCE);
  const canSubmit = !!perms.canAction?.('submit');
  const canApprove = !!perms.canAction?.('approve');
  const canReject = !!perms.canAction?.('reject');
  const canRevoke = !!perms.canAction?.('revoke');
  const canRecall = !!perms.canAction?.('recall');

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DrawingDistribution | null>(null);
  const [detail, setDetail] = useState<DrawingDistribution | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [policyEnabled, setPolicyEnabled] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [releasedDrawings, setReleasedDrawings] = useState<EngineeringDrawing[]>([]);

  useEffect(() => {
    void drawingDistributionApi.getPolicy().then((p) => setPolicyEnabled(!!p.isEnabled));
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

  const openDetail = useCallback(async (row: DrawingDistribution) => {
    setDetail(row);
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await drawingDistributionApi.get(row.uuid));
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
          setDetail(await drawingDistributionApi.get(detail.uuid));
        }
      } catch (e) {
        messageApi.error(getApiErrorMessage(e) || t('common.operationFailed'));
      }
    },
    [detail?.uuid, messageApi, reload, t],
  );

  const handleRecall = useCallback(
    (row: DrawingDistribution) => {
      let reason = '';
      modalApi.confirm({
        title: t('app.master-data.drawingDistributions.recallConfirm'),
        content: (
          <Input.TextArea
            rows={3}
            placeholder={t('app.master-data.drawingDistributions.recallReason')}
            onChange={(e) => {
              reason = e.target.value;
            }}
          />
        ),
        onOk: () => runAction(() => drawingDistributionApi.recall(row.uuid, reason), 'app.master-data.drawingDistributions.recallSuccess'),
      });
    },
    [modalApi, runAction, t],
  );

  const columns: ProColumns<DrawingDistribution>[] = useMemo(
    () => [
      {
        title: t('app.master-data.drawingDistributions.name'),
        dataIndex: 'name',
        key: 'name_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, row) => (
          <UniTableStackedPrimaryCell primary={row.name} secondary={row.code} />
        ),
      },
      {
        title: t('app.master-data.drawingDistributions.code'),
        dataIndex: 'code',
        hideInTable: true,
      },
      {
        title: t('app.master-data.drawingDistributions.issuedAt'),
        dataIndex: 'issuedAt',
        hideInSearch: true,
        width: 160,
        render: (_, row) => (row.issuedAt ? formatDateTimeBySiteSetting(row.issuedAt) : '-'),
      },
      {
        title: t('app.master-data.drawingDistributions.issuedBy'),
        dataIndex: 'issuedByName',
        hideInSearch: true,
        width: 100,
        ellipsis: true,
      },
      ...buildDocumentAuditColumns<DrawingDistribution>(t),
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
          Draft: { text: t('app.master-data.drawingDistributions.status.Draft') },
          Pending: { text: t('app.master-data.drawingDistributions.status.Pending') },
          Issued: { text: t('app.master-data.drawingDistributions.status.Issued') },
          Recalled: { text: t('app.master-data.drawingDistributions.status.Recalled') },
        },
        render: (_, row) => (
          <StatusTag color={STATUS_COLOR[row.status] ?? 'default'}>
            {t(`app.master-data.drawingDistributions.status.${row.status}`)}
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
                void drawingDistributionApi.get(row.uuid).then((full) => {
                  setEditing(full);
                  setModalOpen(true);
                });
              }}
            >
              {t('common.edit')}
            </Button>
          ) : null,
          row.status === 'Draft' && canSubmit ? (
            <Button key="submit" {...rowActionKind('submit')} type="link" size="small" onClick={() => void runAction(() => drawingDistributionApi.submit(row.uuid), 'app.master-data.drawingDistributions.submitSuccess')}>
              {t('common.submit')}
            </Button>
          ) : null,
          row.status === 'Pending' && canApprove ? (
            <Button key="approve" {...rowActionKind('approve')} type="link" size="small" onClick={() => void runAction(() => drawingDistributionApi.approve(row.uuid), 'app.master-data.drawingDistributions.approveSuccess')}>
              {t('app.master-data.drawingDistributions.approve')}
            </Button>
          ) : null,
          row.status === 'Pending' && canReject ? (
            <Button key="reject" {...rowActionKind('reject')} type="link" size="small" onClick={() => void runAction(() => drawingDistributionApi.reject(row.uuid), 'app.master-data.drawingDistributions.rejectSuccess')}>
              {t('app.master-data.drawingDistributions.reject')}
            </Button>
          ) : null,
          row.status === 'Pending' && canRevoke ? (
            <Button key="revoke" {...rowActionKind('revoke')} type="link" size="small" onClick={() => void runAction(() => drawingDistributionApi.revoke(row.uuid), 'app.master-data.drawingDistributions.revokeSuccess')}>
              {t('app.master-data.drawingDistributions.revoke')}
            </Button>
          ) : null,
          row.status === 'Issued' && canRecall ? (
            <Button key="recall" {...rowActionKind('recall')} type="link" size="small" onClick={() => handleRecall(row)}>
              {t('app.master-data.drawingDistributions.recall')}
            </Button>
          ) : null,
        ].filter(Boolean),
      },
    ],
    [canApprove, canRecall, canReject, canRevoke, canSubmit, handleRecall, openDetail, perms.canUpdate, runAction, t],
  );

  const basicItems = useMemo(() => {
    if (!detail) return [];
    return detailDrawerDescriptionItems(
      alignDescriptionColumns(
        [
          { title: t('app.master-data.drawingDistributions.code'), dataIndex: 'code' },
          { title: t('app.master-data.drawingDistributions.name'), dataIndex: 'name' },
          {
            title: t('app.master-data.drawingDistributions.issuedAt'),
            dataIndex: 'issuedAt',
            render: (_, row) => (row.issuedAt ? formatDateTimeBySiteSetting(row.issuedAt) : '-'),
          },
          { title: t('app.master-data.drawingDistributions.issuedBy'), dataIndex: 'issuedByName' },
          {
            title: t('app.master-data.drawingDistributions.recalledAt'),
            dataIndex: 'recalledAt',
            render: (_, row) => (row.recalledAt ? formatDateTimeBySiteSetting(row.recalledAt) : '-'),
          },
          { title: t('app.master-data.drawingDistributions.recalledBy'), dataIndex: 'recalledByName' },
          { title: t('app.master-data.drawingDistributions.recallReason'), dataIndex: 'recallReason' },
          { title: t('common.remark'), dataIndex: 'remark' },
        ],
        GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
      ),
      detail,
    );
  }, [detail, t]);

  return (
    <ListPageTemplate>
      <UniTable<DrawingDistribution>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.drawingDistributions')}
        headerTitle={t('app.master-data.menu.process.drawing-distributions')}
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
        columnPersistenceId="apps.master-data.pages.process.drawing-distributions.v1"
        showCreateButton={perms.canCreate}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((row) => keys.includes(row.uuid));
          const deletable = rows.filter((row) => row.status === 'Draft' || row.status === 'Recalled');
          if (!deletable.length) {
            messageApi.warning(t('app.master-data.drawingDistributions.deleteOnlyDraftOrRecalled'));
            return;
          }
          await Promise.all(deletable.map((row) => drawingDistributionApi.delete(row.uuid)));
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
          await downloadRecordsAsXlsx(items as Array<Record<string, unknown>>, `drawing-distributions-${todaySiteDateString()}.xlsx`);
          messageApi.success(t('common.exportSuccess', { count: items.length }));
        }}
        toolBarActionsAfterDelete={[
          <Space key="policy">
            <span>{t('app.master-data.drawingDistributions.policyLabel')}</span>
            <Switch
              checked={policyEnabled}
              loading={policyLoading}
              disabled={!perms.canUpdate}
              onChange={async (checked) => {
                setPolicyLoading(true);
                try {
                  const next = await drawingDistributionApi.updatePolicy(checked);
                  setPolicyEnabled(!!next.isEnabled);
                  messageApi.success(t('app.master-data.drawingDistributions.policyUpdated'));
                } catch (e) {
                  messageApi.error(getApiErrorMessage(e) || t('common.saveFailed'));
                } finally {
                  setPolicyLoading(false);
                }
              }}
            />
          </Space>,
        ]}
        request={async (params) => {
          const res = await drawingDistributionApi.list({
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
            ? { name: editing.name, remark: editing.remark, lines: editing.lines?.map((line) => ({ drawingUuid: line.drawingUuid })) ?? [] }
            : { lines: [{}] }
        }
        onFinish={async (values) => {
          const lines = ((values.lines as FormLine[]) || []).filter((line) => line.drawingUuid);
          const payload = { name: values.name, remark: values.remark, lines };
          if (editing) {
            await drawingDistributionApi.update(editing.uuid, payload);
          } else {
            await drawingDistributionApi.create(payload);
          }
          messageApi.success(t('common.saveSuccess'));
          setModalOpen(false);
          setEditing(null);
          reload();
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="name"
              label={t('app.master-data.drawingDistributions.name')}
              rules={[{ required: true, message: t('app.master-data.drawingDistributions.nameRequired') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 1 }} />
          </Col>
        </Row>
        <UniTableDetail
          name="lines"
          title={t('app.master-data.drawingDistributions.lines')}
          required
          requiredMessage={t('app.master-data.drawingDistributions.linesRequired')}
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
                      label: `${row.code} ${row.name} ${row.revision}`.trim(),
                    }))}
                  />
                </Form.Item>
              ),
            },
          ]}
          tableProps={{ size: 'small', style: { width: '100%', margin: 0 } }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={t('app.master-data.drawingDistributions.detailTitle')}
        loading={detailLoading}
        extra={
          detail ? (
            <Space>
              {detail.status === 'Draft' && canSubmit ? (
                <Button type="primary" size="small" onClick={() => void runAction(() => drawingDistributionApi.submit(detail.uuid), 'app.master-data.drawingDistributions.submitSuccess')}>
                  {t('common.submit')}
                </Button>
              ) : null}
              {detail.status === 'Pending' && canApprove ? (
                <Button type="primary" size="small" onClick={() => void runAction(() => drawingDistributionApi.approve(detail.uuid), 'app.master-data.drawingDistributions.approveSuccess')}>
                  {t('app.master-data.drawingDistributions.approve')}
                </Button>
              ) : null}
              {detail.status === 'Issued' && canRecall ? (
                <Button size="small" onClick={() => handleRecall(detail)}>
                  {t('app.master-data.drawingDistributions.recall')}
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
            <DetailDrawerSection title={t('app.master-data.drawingDistributions.basicInfo')}>
              <Descriptions column={detailDrawerBasicColumn(false)} size="small" items={basicItems} />
            </DetailDrawerSection>
          ) : null
        }
        lines={
          detail && !detailError ? (
            <DetailDrawerSection title={t('app.master-data.drawingDistributions.lines')}>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.lines ?? []}
                columns={[
                  { title: t('app.master-data.drawings.code'), dataIndex: 'drawingCode' },
                  { title: t('app.master-data.drawings.name'), dataIndex: 'drawingName' },
                  { title: t('app.master-data.drawings.revision'), dataIndex: 'drawingRevision', width: 80 },
                ]}
              />
            </DetailDrawerSection>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default DrawingDistributionsPage;
