/**
 * 好力 GO — 隐患治理（列表 + 治理 Modal，字段 05～08）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Descriptions, Space, Tag, Typography } from 'antd';
import { EyeOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  getHazardReport,
  listEquipments,
  listHazardReports,
  updateHazardReport,
  type HazardRow,
} from '../../../services/haoligo';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { searchUserNameOptions } from '../../../../../utils/userDisplay';
import { formDateTimeToIso } from '../shared/datetimeHelpers';
import { PatrolImagePreview } from '../shared/PatrolImagePreview';
import { RemediationFormBody } from '../shared/RemediationFormBody';
import { hazardIssueTypeCodes } from '../shared/patrolIssueHelpers';
import { formatDateTime } from '../../../../../utils/format';

const statusColors: Record<string, string> = {
  已登记: 'processing',
  已治理: 'success',
};

function currentUserDisplayName(): string | undefined {
  const cu = useGlobalStore.getState().currentUser;
  if (!cu) return undefined;
  return (cu.full_name || '').trim() || cu.username || undefined;
}

const PatrolHazardsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>();
  const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([]);
  const [afterUuids, setAfterUuids] = useState<string[]>([]);
  const [contextRow, setContextRow] = useState<HazardRow | null>(null);
  const currentUser = useGlobalStore((s) => s.currentUser);

  useEffect(() => {
    void searchUserNameOptions({
      pageSize: 200,
      selectedName: currentUserDisplayName(),
      currentUser,
    })
      .then(setUserOptions)
      .catch(() => setUserOptions([]));
  }, [currentUser]);

  const openRemediate = async (record: HazardRow, detailOnly: boolean) => {
    try {
      const detail = await getHazardReport(record.id);
      setContextRow(detail);
      setIsDetailView(detailOnly);
      setEditId(detail.id);
      const savedHandler = detail.handler_name?.trim();
      setFormInitialValues({
        solution_note: detail.solution_note ?? undefined,
        handled_at: detail.handled_at ? dayjs(detail.handled_at) : detailOnly ? undefined : dayjs(),
        handler_name:
          savedHandler || (detailOnly ? undefined : currentUserDisplayName()),
      });
      const ids = (detail.after_image_file_ids as string[] | undefined) ?? [];
      setAfterUuids(ids);
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载失败');
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editId == null) return;
    setFormLoading(true);
    try {
      const afterIds = afterUuids.filter((u) => typeof u === 'string' && u.trim());
      const handlerName = String(values.handler_name ?? '').trim();
      const handledAtIso = formDateTimeToIso(values.handled_at);
      const solution = String(values.solution_note ?? '').trim();
      if (handledAtIso && handlerName && !solution) {
        messageApi.warning('办结请填写解决方案（05）');
        throw new Error('validation');
      }
      await updateHazardReport(editId, {
        solution_note: solution || undefined,
        after_image_file_ids: afterIds.length ? afterIds : undefined,
        handled_at: handledAtIso,
        handler_name: handlerName || undefined,
      });
      messageApi.success('治理信息已保存');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      if ((e as Error).message === 'validation') {
        return;
      }
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<HazardRow>[] = [
    {
      title: '列表范围',
      dataIndex: 'remediation_scope',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        all: { text: '全部记录' },
        pending: { text: '待治理（已登记）' },
      },
      initialValue: 'all',
      fieldProps: { allowClear: false },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      valueType: 'select',
      valueEnum: {
        all: { text: '全部' },
        已登记: { text: '已登记' },
        已治理: { text: '已治理' },
      },
      initialValue: 'all',
      fieldProps: {
        allowClear: false,
        optionType: 'button',
        buttonStyle: 'solid',
      },
      render: (_, r) => <Tag color={statusColors[r.status] || 'default'}>{r.status}</Tag>,
    },
    { title: '单号', dataIndex: 'sheet_no', width: 140, ellipsis: true, hideInSearch: true },
    { title: '车间', dataIndex: 'workshop_name', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '关联设备',
      key: 'equipment_display',
      dataIndex: 'equipment_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) =>
        r.equipment_id
          ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim() || `ID ${r.equipment_id}`
          : '—',
    },
    {
      title: '关联设备',
      dataIndex: 'equipment_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        filterOption: false,
        allowClear: true,
        placeholder: '全部',
      },
      request: async ({ keyWords }) => {
        const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
        return (res.items || []).map((e) => ({ label: `${e.asset_code} ${e.name}`, value: e.id }));
      },
    },
    { title: '巡查区域', dataIndex: 'workshop_area', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '问题类型',
      dataIndex: 'issue_type_codes',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => hazardIssueTypeCodes(r).join('、') || '—',
    },
    { title: '解决方案', dataIndex: 'solution_note', ellipsis: true, hideInSearch: true },
    { title: '处理人', dataIndex: 'handler_name', width: 100, ellipsis: true, hideInSearch: true },
    {
      title: '巡查时间',
      dataIndex: 'reported_at',
      width: 168,
      hideInSearch: true,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')} onClick={() => void openRemediate(record, true)}>
            详情
          </Button>
          {record.status !== '已治理' && (
            <Button
              key="remediate"
              {...rowActionKind('update')}
              {...rowActionLabelKeep()}
              onClick={() => void openRemediate(record, false)}
            >
              治理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<HazardRow>
          headerTitle="隐患治理"
          columnPersistenceId="apps.haoligo.pages.patrol.hazards"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const statusRaw = searchFormValues?.status;
              const status =
                typeof statusRaw === 'string' && statusRaw && statusRaw !== 'all' ? statusRaw : undefined;
              const scopePending = searchFormValues?.remediation_scope === 'pending';
              const res = await listHazardReports({
                skip,
                limit: pageSize,
                status: status || undefined,
                equipment_id:
                  searchFormValues?.equipment_id != null && searchFormValues?.equipment_id !== ''
                    ? Number(searchFormValues.equipment_id)
                    : undefined,
                for_remediation: !status && scopePending ? true : undefined,
              });
              return { data: res.items, success: true, total: res.total };
            } catch (e) {
              messageApi.error((e as Error).message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isDetailView ? '治理详情' : '隐患治理'}
        open={modalVisible}
        readOnly={isDetailView}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
          setAfterUuids([]);
          setContextRow(null);
        }}
        onFinish={handleSubmit}
        isEdit
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        {contextRow && (
          <>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              治理前（登记信息）
            </Typography.Title>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="单号">{contextRow.sheet_no?.trim() || `#${contextRow.id}`}</Descriptions.Item>
            <Descriptions.Item label="关联设备">
              {contextRow.equipment_id
                ? `${contextRow.equipment_asset_code || ''} ${contextRow.equipment_name || ''}`.trim() ||
                  `ID ${contextRow.equipment_id}`
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="车间">{contextRow.workshop_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="巡查区域">{contextRow.workshop_area ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="巡查时间">
              {contextRow.reported_at ? formatDateTime(contextRow.reported_at, 'YYYY-MM-DD HH:mm') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="问题类型">
              {hazardIssueTypeCodes(contextRow).join('、') || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="登记人">{contextRow.registrant_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="责任人">{contextRow.responsible_name?.trim() || '—'}</Descriptions.Item>
            <Descriptions.Item label="问题描述" span={2}>
              {contextRow.problem_summary?.trim() ? contextRow.problem_summary : '—'}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              登记现场照片
            </Typography.Text>
            <PatrolImagePreview
              uuids={(contextRow.before_image_file_ids as string[] | undefined) ?? []}
              emptyText="无"
            />
          </div>
          </>
        )}
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          治理记录（05～08）
        </Typography.Title>
        <RemediationFormBody
          userOptions={userOptions}
          afterUuids={afterUuids}
          onAfterUuidsChange={setAfterUuids}
          readOnly={isDetailView}
        />
      </FormModalTemplate>
    </>
  );
};

export default PatrolHazardsPage;
