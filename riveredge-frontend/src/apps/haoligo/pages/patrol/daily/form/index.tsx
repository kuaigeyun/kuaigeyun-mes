/**
 * 好力 GO — 问题登记（列表 + 新建/编辑问题 Modal，字段 01～04）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import {
  createHazardReport,
  deleteHazardReport,
  getHazardReport,
  listHazardReports,
  listWorkshops,
  updateHazardReport,
  type HazardRow,
  type WorkshopRow,
} from '../../../../services/haoligo';
import { getDataDictionaryByCode, getDictionaryItemList, type DictionaryItem } from '../../../../../../services/dataDictionary';
import { getUserList } from '../../../../../../services/user';
import { useGlobalStore } from '../../../../../../stores/globalStore';
import { formDateTimeToIso } from '../../shared/datetimeHelpers';
import { IssueRegisterFormBody } from '../../shared/IssueRegisterFormBody';

const ISSUE_TYPE_DICT_CODE = 'HAOLIGO_PATROL_ISSUE_TYPE';

const statusColors: Record<string, string> = {
  检查中: 'processing',
  维修中: 'warning',
  已完成: 'success',
};

const PatrolIssueRegisterPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>();

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [issueTypes, setIssueTypes] = useState<DictionaryItem[]>([]);
  const [dictLoading, setDictLoading] = useState(true);
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([]);

  const loadIssueTypes = useCallback(async () => {
    setDictLoading(true);
    try {
      const dict = await getDataDictionaryByCode(ISSUE_TYPE_DICT_CODE);
      const items = await getDictionaryItemList(dict.uuid, true);
      setIssueTypes(items.sort((a, b) => a.sort_order - b.sort_order));
    } catch {
      setIssueTypes([]);
    } finally {
      setDictLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIssueTypes();
    void listWorkshops()
      .then(setWorkshops)
      .catch(() => setWorkshops([]));
    void getUserList({ page: 1, page_size: 500, is_active: true })
      .then((res) => {
        const opts = (res.items || []).map((u) => ({
          label: (u.full_name || '').trim() || u.username,
          value: u.id,
        }));
        const cu = useGlobalStore.getState().currentUser;
        if (cu?.id != null && !opts.some((o) => o.value === cu.id)) {
          opts.unshift({
            label: (cu.full_name || '').trim() || cu.username || `用户#${cu.id}`,
            value: cu.id,
          });
        }
        setUserOptions(opts);
      })
      .catch(() => setUserOptions([]));
  }, [loadIssueTypes]);

  const openCreate = () => {
    const cu = useGlobalStore.getState().currentUser;
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({
      reported_at: dayjs(),
      registrant_user_id: cu?.id,
    });
    setModalVisible(true);
  };

  useNewShortcut(openCreate);

  const openForm = async (record: HazardRow, detailOnly: boolean) => {
    try {
      const detail = await getHazardReport(record.id);
      setIsDetailView(detailOnly);
      setIsEdit(!detailOnly);
      setEditId(detail.id);
      setFormInitialValues({
        workshop_id: detail.workshop_id ?? undefined,
        reported_at: detail.reported_at ? dayjs(detail.reported_at) : undefined,
        workshop_area: detail.workshop_area ?? undefined,
        issue_type_code: detail.issue_type_code ?? undefined,
        registrant_user_id: detail.registrant_user_id ?? undefined,
        responsible_user_id: detail.responsible_user_id ?? undefined,
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载失败');
    }
  };

  const handleDeleteOne = (record: HazardRow) => {
    modal.confirm({
      title: '确认删除',
      content: `确定删除该巡查问题记录吗？`,
      okType: 'danger',
      onOk: async () => {
        await deleteHazardReport(record.id);
        messageApi.success('已删除');
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      const registrantUserId = values.registrant_user_id as number | undefined;
      const responsibleUserId = values.responsible_user_id as number | undefined;
      const payload = {
        workshop_id: values.workshop_id as number | undefined,
        workshop_area: String(values.workshop_area ?? '').trim() || undefined,
        reported_at: formDateTimeToIso(values.reported_at),
        issue_type_code: String(values.issue_type_code ?? '').trim() || undefined,
        status: '检查中' as const,
        registrant_user_id: registrantUserId,
        responsible_user_id: responsibleUserId ?? null,
      };
      if (isEdit && editId != null) {
        await updateHazardReport(editId, payload);
        messageApi.success('已保存');
      } else {
        await createHazardReport(payload);
        messageApi.success('问题已登记，并同步至「隐患治理」台账，请在该页补充处理记录（05～08）。');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<HazardRow>[] = [
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
    { title: '问题类型', dataIndex: 'issue_type_code', width: 160, ellipsis: true, hideInSearch: true },
    { title: '登记人', dataIndex: 'registrant_name', width: 100, ellipsis: true, hideInSearch: true },
    { title: '责任人', dataIndex: 'responsible_name', width: 100, ellipsis: true, hideInSearch: true },
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
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openForm(record, true)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={record.status === '已完成'}
            onClick={() => void openForm(record, false)}
          >
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<HazardRow>
          headerTitle="问题登记"
          columnPersistenceId="apps.haoligo.pages.patrol.daily.form"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新建问题"
          onCreate={openCreate}
          request={async (params, _sort, _filter, searchFormValues) => {
            const current = params.current ?? 1;
            const pageSize = params.pageSize ?? 20;
            const skip = (current - 1) * pageSize;
            try {
              const res = await listHazardReports({
                skip,
                limit: pageSize,
                status:
                  typeof searchFormValues?.status === 'string' && searchFormValues.status
                    ? searchFormValues.status
                    : undefined,
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
        title={isDetailView ? '问题详情' : isEdit ? '编辑问题' : '新建问题'}
        open={modalVisible}
        readOnly={isDetailView}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
          setIsDetailView(false);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        grid={false}
      >
        <IssueRegisterFormBody
          workshops={workshops}
          issueTypes={issueTypes}
          dictLoading={dictLoading}
          userOptions={userOptions}
          readOnly={isDetailView}
        />
      </FormModalTemplate>
    </>
  );
};

export default PatrolIssueRegisterPage;
