/**
 * 实验判定规则主数据（R-02）
 */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Row } from 'antd';
import { UniTable } from '../../../../components/uni-table';
import { UniTableStackedPrimaryCell } from '../../../../components/uni-table/stackedPrimaryColumn';
import { rowActionCopyCreate, rowActionKind } from '../../../../components/uni-action';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../components/layout-templates';
import { MasterDataDetailDrawer } from '../../../master-data/pages/shared/masterDataDetailDrawer';
import {
  buildDetailDrawerEditExtra,
  renderIsActiveTag,
} from '../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { MarkerTag } from '../../../../constants/statusBadges';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  labJudgmentRuleApi,
  type LabJudgmentRule,
} from '../../services/lab-judgment-rule';

const RESOURCE = 'kuaiplm:lab-judgment-rule';

const COMPARE_OPTIONS = [
  { value: 'range', labelKey: 'range' },
  { value: 'eq', labelKey: 'eq' },
  { value: 'gte', labelKey: 'gte' },
  { value: 'lte', labelKey: 'lte' },
  { value: 'na', labelKey: 'na' },
] as const;

const LabJudgmentRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const formRef = useRef<any>(null);
  const tableRowsRef = useRef<LabJudgmentRule[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LabJudgmentRule | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<LabJudgmentRule | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const id of keys) {
      await labJudgmentRuleApi.delete(Number(id));
    }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
  };

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const row = await labJudgmentRuleApi.get(id);
      setDetail(row);
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaiplm.labJudgmentRule.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = (record: LabJudgmentRule) => {
    if (record.id == null) return;
    detailRetryIdRef.current = record.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(record.id);
  };

  const openEdit = async (record: LabJudgmentRule) => {
    try {
      const row = await labJudgmentRuleApi.get(record.id!);
      setEditing(row);
      setModalOpen(true);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaiplm.labJudgmentRule.loadFailed')));
    }
  };

  const columns = useMemo<ProColumns<LabJudgmentRule>[]>(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaiplm.labJudgmentRule.colRule'),
            dataIndex: 'rule_name',
            key: 'rule_name',
            minWidth: 160,
            uniTablePrimaryFlex: true,
            uniTableRemainderFlex: true,
            ellipsis: true,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.rule_name}
                secondary={record.rule_code}
              />
            ),
          },
          {
            title: t('app.kuaiplm.labJudgmentRule.colVersion'),
            dataIndex: 'version',
            key: 'version',
            width: 88,
            minWidth: 88,
            search: false,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t('app.kuaiplm.labJudgmentRule.colCompareType'),
            dataIndex: 'compare_type',
            key: 'compare_type',
            width: 100,
            minWidth: 100,
            search: false,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, record) =>
              t(`app.kuaiplm.labRequest.compare.${record.compare_type || 'range'}`),
          },
          {
            title: t('app.kuaiplm.labJudgmentRule.colStandard'),
            dataIndex: 'standard_value',
            key: 'standard_value',
            width: 160,
            minWidth: 160,
            search: false,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            render: (_, record) => {
              if (record.compare_type === 'eq') return record.standard_value || '-';
              if (record.compare_type === 'gte') return `≥ ${record.standard_min || '-'}`;
              if (record.compare_type === 'lte') return `≤ ${record.standard_max || '-'}`;
              if (record.compare_type === 'na') return '-';
              return `${record.standard_min || '-'} ~ ${record.standard_max || '-'}`;
            },
          },
          {
            title: t('app.kuaiplm.labJudgmentRule.colUnit'),
            dataIndex: 'unit',
            key: 'unit',
            width: 72,
            search: false,
            uniTableKeepWidth: true,
          },
          {
            title: t('app.kuaiplm.labJudgmentRule.colActive'),
            dataIndex: 'is_active',
            key: 'is_active',
            valueType: 'select',
            valueEnum: {
              true: { text: t('app.kuaiplm.labJudgmentRule.activeYes') },
              false: { text: t('app.kuaiplm.labJudgmentRule.activeNo') },
            },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) =>
              record.is_active ? (
                <MarkerTag color="success" variant="filled">
                  {t('app.kuaiplm.labJudgmentRule.activeYes')}
                </MarkerTag>
              ) : (
                <MarkerTag color="default" variant="filled">
                  {t('app.kuaiplm.labJudgmentRule.activeNo')}
                </MarkerTag>
              ),
          },
          ...buildDocumentAuditColumns<LabJudgmentRule>(t),
          {
            title: t('common.action'),
            valueType: 'option',
            key: 'option',
            fixed: 'right',
            render: (_, record) =>
              [
                {
                  key: 'detail',
                  ...rowActionKind('read'),
                  onClick: () => openDetail(record),
                },
                perms.canUpdate
                  ? {
                      key: 'edit',
                      ...rowActionKind('update'),
                      onClick: () => void openEdit(record),
                    }
                  : null,
                perms.canCreate
                  ? {
                      key: 'revise',
                      ...rowActionCopyCreate('create'),
                      text: t('app.kuaiplm.labJudgmentRule.actions.revise'),
                      confirm: {
                        title: t('app.kuaiplm.labJudgmentRule.reviseConfirm'),
                        onConfirm: async () => {
                          try {
                            await labJudgmentRuleApi.revise(record.id!);
                            messageApi.success(t('app.kuaiplm.labJudgmentRule.reviseSuccess'));
                            actionRef.current?.reload();
                          } catch (error) {
                            messageApi.error(getApiErrorMessage(error));
                          }
                        },
                      },
                    }
                  : null,
                perms.canDelete
                  ? {
                      key: 'delete',
                      ...rowActionKind('delete'),
                      confirm: {
                        title: t('app.kuaiplm.labJudgmentRule.deleteConfirm'),
                        onConfirm: async () => {
                          try {
                            await labJudgmentRuleApi.delete(record.id!);
                            messageApi.success(t('app.kuaiplm.labJudgmentRule.deleteSuccess'));
                            actionRef.current?.reload();
                          } catch (error) {
                            messageApi.error(getApiErrorMessage(error));
                          }
                        },
                      },
                    }
                  : null,
              ].filter(Boolean),
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, perms.canUpdate, perms.canCreate, perms.canDelete, messageApi],
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<LabJudgmentRule>[]>(
    () => [
      {
        title: t('app.kuaiplm.labJudgmentRule.colCode'),
        dataIndex: 'rule_code',
        key: 'rule_code',
      },
      {
        title: t('app.kuaiplm.labJudgmentRule.colName'),
        dataIndex: 'rule_name',
        key: 'rule_name',
      },
      {
        title: t('app.kuaiplm.labJudgmentRule.colVersion'),
        dataIndex: 'version',
        key: 'version',
      },
      {
        title: t('app.kuaiplm.labJudgmentRule.colCompareType'),
        dataIndex: 'compare_type',
        key: 'compare_type',
        render: (_, record) =>
          t(`app.kuaiplm.labRequest.compare.${record.compare_type || 'range'}`),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.standardMin'),
        dataIndex: 'standard_min',
        key: 'standard_min',
      },
      {
        title: t('app.kuaiplm.labRequest.measure.standardMax'),
        dataIndex: 'standard_max',
        key: 'standard_max',
      },
      {
        title: t('app.kuaiplm.labRequest.measure.standardValue'),
        dataIndex: 'standard_value',
        key: 'standard_value',
      },
      {
        title: t('app.kuaiplm.labJudgmentRule.colUnit'),
        dataIndex: 'unit',
        key: 'unit',
      },
      {
        title: t('app.kuaiplm.labJudgmentRule.colItemName'),
        dataIndex: 'item_name',
        key: 'item_name',
      },
      {
        title: t('app.kuaiplm.labJudgmentRule.colActive'),
        dataIndex: 'is_active',
        key: 'is_active',
        render: (_, record) => renderIsActiveTag(t, record.is_active),
      },
      {
        title: t('common.remarks'),
        dataIndex: 'remarks',
        key: 'remarks',
        span: 2,
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<LabJudgmentRule>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        headerTitle={t('app.kuaiplm.menu.lab-judgment-rules')}
        columnPersistenceId="apps.kuaiplm.pages.lab-judgment-rules.width-v2"
        createButtonText={
          perms.canCreate ? t('app.kuaiplm.labJudgmentRule.createButton') : undefined
        }
        onCreate={perms.canCreate ? openCreate : undefined}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        deleteConfirmTitle={t('common.batchDeleteTitle')}
        deleteConfirmDescription={(count) => t('common.batchDeleteContent', { count })}
        onDelete={handleBatchDelete}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        request={async (params) => {
          const res = await labJudgmentRuleApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            keyword: params.keyword || params.rule_name,
            is_active:
              params.is_active === true || params.is_active === 'true'
                ? true
                : params.is_active === false || params.is_active === 'false'
                  ? false
                  : undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
      />

      <FormModalTemplate
        title={
          editing
            ? t('app.kuaiplm.labJudgmentRule.editTitle')
            : t('app.kuaiplm.labJudgmentRule.createTitle')
        }
        open={modalOpen}
        onOpenChange={setModalOpen}
        formRef={formRef}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        grid={false}
        initialValues={
          editing
            ? {
                rule_code: editing.rule_code,
                rule_name: editing.rule_name,
                version: editing.version,
                compare_type: editing.compare_type || 'range',
                standard_min: editing.standard_min,
                standard_max: editing.standard_max,
                standard_value: editing.standard_value,
                unit: editing.unit,
                item_name: editing.item_name,
                remarks: editing.remarks,
                is_active: editing.is_active !== false,
              }
            : {
                version: '1',
                compare_type: 'range',
                is_active: true,
              }
        }
        onFinish={async (values) => {
          try {
            const payload = {
              rule_code: values.rule_code,
              rule_name: values.rule_name,
              version: values.version || '1',
              compare_type: values.compare_type || 'range',
              standard_min: values.standard_min,
              standard_max: values.standard_max,
              standard_value: values.standard_value,
              unit: values.unit,
              item_name: values.item_name,
              remarks: values.remarks,
              is_active: values.is_active !== false,
            };
            if (editing?.id != null) {
              const { rule_code: _c, version: _v, ...updatePayload } = payload;
              await labJudgmentRuleApi.update(editing.id, updatePayload);
            } else {
              await labJudgmentRuleApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (error) {
            messageApi.error(getApiErrorMessage(error));
            return false;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="rule_code"
              label={t('app.kuaiplm.labJudgmentRule.colCode')}
              disabled={!!editing}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.autoGenerate')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="rule_name"
              label={t('app.kuaiplm.labJudgmentRule.colName')}
              rules={[{ required: true, message: t('common.required') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="version"
              label={t('app.kuaiplm.labJudgmentRule.colVersion')}
              disabled={!!editing}
              rules={[{ required: true, message: t('common.required') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="compare_type"
              label={t('app.kuaiplm.labJudgmentRule.colCompareType')}
              options={COMPARE_OPTIONS.map((o) => ({
                value: o.value,
                label: t(`app.kuaiplm.labRequest.compare.${o.labelKey}`),
              }))}
              rules={[{ required: true, message: t('common.required') }]}
            />
          </Col>
          <Col span={8}>
            <ProFormText
              name="standard_min"
              label={t('app.kuaiplm.labRequest.measure.standardMin')}
            />
          </Col>
          <Col span={8}>
            <ProFormText
              name="standard_max"
              label={t('app.kuaiplm.labRequest.measure.standardMax')}
            />
          </Col>
          <Col span={8}>
            <ProFormText
              name="standard_value"
              label={t('app.kuaiplm.labRequest.measure.standardValue')}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="unit" label={t('app.kuaiplm.labJudgmentRule.colUnit')} />
          </Col>
          <Col span={12}>
            <ProFormText
              name="item_name"
              label={t('app.kuaiplm.labJudgmentRule.colItemName')}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remarks" label={t('common.remarks')} />
          </Col>
          <Col span={12}>
            <ProFormSwitch
              name="is_active"
              label={t('app.kuaiplm.labJudgmentRule.colActive')}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      <MasterDataDetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          if (detailRetryIdRef.current != null) void loadDetail(detailRetryIdRef.current);
        }}
        title={detail?.rule_name || t('app.kuaiplm.menu.lab-judgment-rules')}
        detail={detail}
        detailColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail) && perms.canUpdate, () => {
          if (!detail) return;
          setDetailOpen(false);
          void openEdit(detail);
        })}
      />
    </ListPageTemplate>
  );
};

export default LabJudgmentRulesPage;
