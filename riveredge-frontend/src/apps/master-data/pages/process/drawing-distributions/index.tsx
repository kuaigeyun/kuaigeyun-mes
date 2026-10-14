/**
 * 图档发放：发放单列表 + 车间只读已发放版策略
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormInstance,
  ProFormItem,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form, Input, Row, Select, Space, Switch, Table } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
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
import {
  pickListSearchKeywordOrFields,
  pickSearchString,
} from '../../../../../utils/tableQueryKey';
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
import { getDepartmentTree } from '../../../../../services/department';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import {
  flattenDepartmentTreeOptions,
  type DepartmentPickerOption,
} from '../../../utils/flattenDepartmentTreeOptions';

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
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentPickerOption[]>([]);
  const [issueDepartmentUuid, setIssueDepartmentUuid] = useState<string | undefined>();

  useEffect(() => {
    void drawingDistributionApi.getPolicy().then((p) => setPolicyEnabled(!!p.isEnabled));
    void drawingApi.list({ status: 'Released', limit: 200 }).then((res) => setReleasedDrawings(res.data ?? []));
    void getDepartmentTree({ is_active: true })
      .then((res) => setDepartmentOptions(flattenDepartmentTreeOptions(res?.items ?? [])))
      .catch(() => setDepartmentOptions([]));
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      setIssueDepartmentUuid(undefined);
      return;
    }
    if (editing?.issueDepartmentId != null) {
      const match = departmentOptions.find((item) => item.value === editing.issueDepartmentId);
      setIssueDepartmentUuid(match?.uuid);
    }
  }, [modalOpen, editing, departmentOptions]);

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
        // 稀疏：业务列不叠（单号 → 名称 → 发放时间/人）；审计叠列保留
        title: t('app.master-data.drawingDistributions.code'),
        dataIndex: 'code',
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        fixed: 'left',
        ellipsis: true,
        copyable: true,
      },
      {
        // 发放单名称长短不一：唯一 RemainderFlex
        title: t('app.master-data.drawingDistributions.name'),
        dataIndex: 'name',
        minWidth: 160,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.master-data.drawingDistributions.issueDepartment'),
        dataIndex: 'issueDepartmentName',
        hideInSearch: true,
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.master-data.drawingDistributions.recipientUser'),
        dataIndex: 'recipientUserName',
        hideInSearch: true,
        width: 96,
        minWidth: 96,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.master-data.drawingDistributions.issuedAt'),
        dataIndex: 'issuedAt',
        hideInSearch: true,
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, row) => (row.issuedAt ? formatDateTimeBySiteSetting(row.issuedAt) : '-'),
      },
      {
        title: t('app.master-data.drawingDistributions.issuedBy'),
        key: 'drawing_dist_issued_by',
        dataIndex: 'issuedByName',
        hideInSearch: true,
        width: 112,
        minWidth: 112,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      ...buildDocumentAuditColumns<DrawingDistribution>(t),
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        valueType: 'select',
        valueEnum: {
          Draft: { text: t('app.master-data.drawingDistributions.status.Draft') },
          Pending: { text: t('app.master-data.drawingDistributions.status.Pending') },
          Issued: { text: t('app.master-data.drawingDistributions.status.Issued') },
          Recalled: { text: t('app.master-data.drawingDistributions.status.Recalled') },
        },
      },
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        fixed: 'right',
        hideInSearch: true,
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
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => {
          const parts: React.ReactNode[] = [
            <Button key="detail" {...rowActionKind('read')} onClick={() => void openDetail(row)} />,
          ];
          if (row.status === 'Draft' && perms.canUpdate) {
            parts.push(
              <Button
                key="edit"
                {...rowActionKind('update')}
                onClick={() => {
                  void drawingDistributionApi.get(row.uuid).then((full) => {
                    setEditing(full);
                    setModalOpen(true);
                  });
                }}
              />,
            );
          }
          if (row.status === 'Draft' && canSubmit) {
            parts.push(
              <Button
                key="submit"
                {...rowActionKind('submit')}
                onClick={() =>
                  void runAction(
                    () => drawingDistributionApi.submit(row.uuid),
                    'app.master-data.drawingDistributions.submitSuccess',
                  )
                }
              />,
            );
          }
          if (row.status === 'Pending' && canApprove) {
            parts.push(
              <Button
                key="approve"
                {...rowActionKind('approve')}
                {...rowActionLabelKeep()}
                onClick={() =>
                  void runAction(
                    () => drawingDistributionApi.approve(row.uuid),
                    'app.master-data.drawingDistributions.approveSuccess',
                  )
                }
              >
                {t('app.master-data.drawingDistributions.approve')}
              </Button>,
            );
          }
          if (row.status === 'Pending' && canReject) {
            parts.push(
              <Button
                key="reject"
                {...rowActionKind('reject')}
                {...rowActionLabelKeep()}
                onClick={() =>
                  void runAction(
                    () => drawingDistributionApi.reject(row.uuid),
                    'app.master-data.drawingDistributions.rejectSuccess',
                  )
                }
              >
                {t('app.master-data.drawingDistributions.reject')}
              </Button>,
            );
          }
          if (row.status === 'Pending' && canRevoke) {
            parts.push(
              <Button
                key="revoke"
                {...rowActionKind('revoke')}
                {...rowActionLabelKeep()}
                onClick={() =>
                  void runAction(
                    () => drawingDistributionApi.revoke(row.uuid),
                    'app.master-data.drawingDistributions.revokeSuccess',
                  )
                }
              >
                {t('app.master-data.drawingDistributions.revoke')}
              </Button>,
            );
          }
          if (row.status === 'Issued' && canRecall) {
            parts.push(
              <Button
                key="recall"
                {...rowActionKind('recall')}
                {...rowActionLabelKeep()}
                onClick={() => handleRecall(row)}
              >
                {t('app.master-data.drawingDistributions.recall')}
              </Button>,
            );
          }
          return parts;
        },
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
            title: t('app.master-data.drawingDistributions.issueDepartment'),
            dataIndex: 'issueDepartmentName',
          },
          {
            title: t('app.master-data.drawingDistributions.recipientUser'),
            dataIndex: 'recipientUserName',
          },
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
        columnPersistenceId="apps.master-data.pages.process.drawing-distributions.v5"
        showAdvancedSearch
        pinnedTabsField="status"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.master-data.drawingDistributions.create')}
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
        skipFuzzyPinyinClientFilter
        request={async (params, _sort, _filter, searchFormValues) => {
          const res = await drawingDistributionApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: pickSearchString(searchFormValues, 'status'),
            keyword: pickListSearchKeywordOrFields(searchFormValues, 'name', 'code'),
          });
          return { data: res.data ?? [], total: res.total ?? 0, success: true };
        }}
      />

      <FormModalTemplate
        key={editing?.uuid ?? 'create'}
        title={
          editing
            ? t('app.master-data.drawingDistributions.editTitle')
            : t('app.master-data.drawingDistributions.createTitle')
        }
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setIssueDepartmentUuid(undefined);
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
                issueDepartmentId: editing.issueDepartmentId,
                recipientUserUuid: editing.recipientUserUuid,
                recipientUserId: editing.recipientUserId,
                remark: editing.remark,
                lines: editing.lines?.map((line) => ({ drawingUuid: line.drawingUuid })) ?? [],
              }
            : { lines: [{}] }
        }
        onFinish={async (values) => {
          const lines = ((values.lines as FormLine[]) || []).filter((line) => line.drawingUuid);
          if (!values.issueDepartmentId || !values.recipientUserId) {
            messageApi.error(t('app.master-data.drawingDistributions.partyRequired'));
            return;
          }
          const payload = {
            name: values.name,
            issueDepartmentId: values.issueDepartmentId,
            recipientUserId: values.recipientUserId,
            remark: values.remark,
            lines,
          };
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
          <Col span={8}>
            <ProFormText
              name="name"
              label={t('app.master-data.drawingDistributions.name')}
              rules={[{ required: true, message: t('app.master-data.drawingDistributions.nameRequired') }]}
            />
          </Col>
          <Col span={8}>
            <ProFormItem
              name="issueDepartmentId"
              label={t('app.master-data.drawingDistributions.issueDepartment')}
              rules={[{ required: true, message: t('app.master-data.drawingDistributions.issueDepartmentRequired') }]}
            >
              <UniDropdown
                placeholder={t('app.master-data.drawingDistributions.issueDepartmentPlaceholder')}
                options={departmentOptions.map((item) => ({ label: item.label, value: item.value }))}
                showSearch
                optionFilterProp="label"
                onChange={(value) => {
                  const match = departmentOptions.find((item) => item.value === value);
                  setIssueDepartmentUuid(match?.uuid);
                  formRef.current?.setFieldsValue({ recipientUserUuid: undefined, recipientUserId: undefined });
                }}
              />
            </ProFormItem>
          </Col>
          <Col span={8}>
            <UniUserSelect
              name="recipientUserUuid"
              label={t('app.master-data.drawingDistributions.recipientUser')}
              placeholder={t('app.master-data.drawingDistributions.recipientUserPlaceholder')}
              required
              departmentUuid={issueDepartmentUuid}
              onChange={(_value: unknown, user: unknown) => {
                const picked = Array.isArray(user) ? user[0] : user;
                const id = picked && typeof picked === 'object' && 'id' in picked ? (picked as { id: number }).id : undefined;
                formRef.current?.setFieldsValue({ recipientUserId: id });
              }}
            />
            <Form.Item name="recipientUserId" hidden>
              <Input />
            </Form.Item>
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
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
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
