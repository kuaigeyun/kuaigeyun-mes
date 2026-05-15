/**
 * 好力 GO — 隐患治理（列表 + 治理 Modal，字段 05～08）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Descriptions, Space, Tag } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { EyeOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import {
  getHazardReport,
  listHazardReports,
  updateHazardReport,
  type HazardRow,
} from '../../../services/haoligo';
import { getUserList } from '../../../../../services/user';
import { RemediationFormBody } from '../shared/RemediationFormBody';
import { normUploadUuids, uuidsToUploadFileList } from '../shared/uploadHelpers';

const statusColors: Record<string, string> = {
  检查中: 'processing',
  维修中: 'warning',
  已完成: 'success',
};

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
  const [afterFiles, setAfterFiles] = useState<UploadFile[]>([]);
  const [contextRow, setContextRow] = useState<HazardRow | null>(null);

  useEffect(() => {
    void getUserList({ page: 1, page_size: 500, is_active: true })
      .then((res) =>
        setUserOptions(
          (res.items || []).map((u) => {
            const name = (u.full_name || '').trim() || u.username;
            return { label: name, value: name };
          }),
        ),
      )
      .catch(() => setUserOptions([]));
  }, []);

  const openRemediate = async (record: HazardRow, detailOnly: boolean) => {
    try {
      const detail = await getHazardReport(record.id);
      setContextRow(detail);
      setIsDetailView(detailOnly);
      setEditId(detail.id);
      setFormInitialValues({
        solution_note: detail.solution_note ?? undefined,
        handled_at: detail.handled_at ? dayjs(detail.handled_at) : undefined,
        handler_name: detail.handler_name ?? undefined,
      });
      const ids = (detail.after_image_file_ids as string[] | undefined) ?? [];
      setAfterFiles(uuidsToUploadFileList(ids));
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载失败');
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editId == null) return;
    setFormLoading(true);
    try {
      const afterIds = normUploadUuids(afterFiles);
      const handlerName = String(values.handler_name ?? '').trim();
      const handledAt = values.handled_at as dayjs.Dayjs | undefined;
      const solution = String(values.solution_note ?? '').trim();
      if (handledAt && handlerName) {
        if (!solution) {
          messageApi.warning('办结请填写解决方案（05）');
          throw new Error('validation');
        }
        if (afterIds.length === 0) {
          messageApi.warning('办结请上传至少一张处理后照片（06）');
          throw new Error('validation');
        }
      }
      await updateHazardReport(editId, {
        solution_note: solution || undefined,
        after_image_file_ids: afterIds.length ? afterIds : undefined,
        handled_at: handledAt?.toISOString(),
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
        pending: { text: '待治理（检查中/维修中）' },
        all: { text: '全部记录' },
      },
      initialValue: 'pending',
      fieldProps: { allowClear: false },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      valueType: 'select',
      valueEnum: {
        检查中: { text: '检查中' },
        维修中: { text: '维修中' },
        已完成: { text: '已完成' },
      },
      fieldProps: { allowClear: true },
      render: (_, r) => <Tag color={statusColors[r.status] || 'default'}>{r.status}</Tag>,
    },
    { title: '车间', dataIndex: 'workshop_name', width: 120, ellipsis: true, hideInSearch: true },
    { title: '巡查区域', dataIndex: 'workshop_area', width: 120, ellipsis: true, hideInSearch: true },
    { title: '问题类型', dataIndex: 'issue_type_code', width: 140, ellipsis: true, hideInSearch: true },
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
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openRemediate(record, true)}>
            详情
          </Button>
          {record.status !== '已完成' && (
            <Button type="link" size="small" icon={<ToolOutlined />} onClick={() => void openRemediate(record, false)}>
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
              const status =
                typeof searchFormValues?.status === 'string' && searchFormValues.status
                  ? searchFormValues.status
                  : undefined;
              const scopeAll = searchFormValues?.remediation_scope === 'all';
              const res = await listHazardReports({
                skip,
                limit: pageSize,
                status: status || undefined,
                for_remediation: !status && !scopeAll ? true : undefined,
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
          setAfterFiles([]);
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
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="车间">{contextRow.workshop_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="巡查区域">{contextRow.workshop_area ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="巡查时间">
              {contextRow.reported_at ? dayjs(contextRow.reported_at).format('YYYY-MM-DD HH:mm') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="问题类型">{contextRow.issue_type_code ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="登记人">{contextRow.registrant_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="责任人">{contextRow.responsible_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="问题描述" span={2}>
              {contextRow.problem_summary?.trim() ? contextRow.problem_summary : '—'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <RemediationFormBody
          userOptions={userOptions}
          afterFiles={afterFiles}
          onAfterFilesChange={setAfterFiles}
          readOnly={isDetailView}
        />
      </FormModalTemplate>
    </>
  );
};

export default PatrolHazardsPage;
