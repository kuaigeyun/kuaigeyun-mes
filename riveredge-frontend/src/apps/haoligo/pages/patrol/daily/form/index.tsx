/**
 * 好力 GO — 问题登记（列表 + 新建/编辑问题 Modal，字段 01～04）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../../components/uni-action';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Modal, Space, Tag } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
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
import { searchHaoligoUserIdOptions } from '../../../../utils/haoligoUserPicker';
import { useGlobalStore } from '../../../../../../stores/globalStore';
import { formDateTimeToIso } from '../../shared/datetimeHelpers';
import { IssueRegisterFormBody } from '../../shared/IssueRegisterFormBody';
import {
  finalizePatrolIssueTypesForSubmit,
  formatIssueTypeLabels,
  hazardIssueTypeCodes,
  splitHazardIssueTypesForForm,
  type PatrolCustomIssueItem,
  PATROL_ISSUE_TYPE_DICT_CODE,
} from '../../shared/patrolIssueHelpers';
import { normUploadUuids, uuidsToSecureUploadFileList } from '../../shared/uploadHelpers';

const ISSUE_TYPE_DICT_CODE = PATROL_ISSUE_TYPE_DICT_CODE;

const statusColors: Record<string, string> = {
  已登记: 'processing',
  已治理: 'success',
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
  const [issueTypeDictUuid, setIssueTypeDictUuid] = useState<string | null>(null);
  const [dictLoading, setDictLoading] = useState(true);
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([]);
  const [beforeFiles, setBeforeFiles] = useState<UploadFile[]>([]);

  const loadIssueTypes = useCallback(async () => {
    setDictLoading(true);
    try {
      const dict = await getDataDictionaryByCode(ISSUE_TYPE_DICT_CODE);
      setIssueTypeDictUuid(dict.uuid);
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
    const cu = useGlobalStore.getState().currentUser;
    void searchHaoligoUserIdOptions({ pageSize: 200, selectedIds: cu?.id ? [cu.id] : [] })
      .then(setUserOptions)
      .catch(() => setUserOptions([]));
  }, [loadIssueTypes]);

  const openCreate = () => {
    const cu = useGlobalStore.getState().currentUser;
    setIsDetailView(false);
    setIsEdit(false);
    setEditId(null);
    setBeforeFiles([]);
    setFormInitialValues({
      reported_at: dayjs(),
      registrant_user_id: cu?.id,
      issue_type_codes: [],
      custom_issue_items: [],
      report_enabled: false,
      report_notify_user_ids: [],
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
      const beforeIds = (detail.before_image_file_ids as string[] | undefined) ?? [];
      setBeforeFiles(await uuidsToSecureUploadFileList(beforeIds));
      const codes = hazardIssueTypeCodes(detail);
      const { dictCodes, customIssueItems } = splitHazardIssueTypesForForm(
        codes,
        issueTypes,
        detail.problem_summary,
      );
      setFormInitialValues({
        workshop_id: detail.workshop_id ?? undefined,
        equipment_id: detail.equipment_id ?? undefined,
        reported_at: detail.reported_at ? dayjs(detail.reported_at) : undefined,
        workshop_area: detail.workshop_area ?? undefined,
        issue_type_codes: dictCodes,
        custom_issue_items: customIssueItems,
        registrant_user_id: detail.registrant_user_id ?? undefined,
        report_enabled: detail.report_enabled ?? false,
        report_notify_user_ids: detail.report_notify_user_ids ?? [],
      });
      setModalVisible(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载失败');
    }
  };

  const handleDeleteOne = (record: HazardRow) => {
    modal.confirm({
      title: '确认删除',
      content: `确定删除巡查单 ${record.sheet_no?.trim() || `#${record.id}`} 吗？`,
      okType: 'danger',
      onOk: async () => {
        await deleteHazardReport(record.id);
        messageApi.success('已删除');
        actionRef.current?.reload();
      },
    });
  };

  const parseReportNotifyUserIds = (raw: unknown): number[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => Number(x)).filter((id) => Number.isFinite(id) && id > 0);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const reportEnabled = Boolean(values.report_enabled);
    const reportNotifyIds = parseReportNotifyUserIds(values.report_notify_user_ids);
    if (reportEnabled && !reportNotifyIds.length) {
      messageApi.warning('开启上报时请至少选择一名责任人');
      throw new Error('validation');
    }
    const issueTypeCodes = Array.isArray(values.issue_type_codes)
      ? (values.issue_type_codes as string[]).map((c) => String(c).trim()).filter(Boolean)
      : [];
    const customIssueItems = Array.isArray(values.custom_issue_items)
      ? (values.custom_issue_items as PatrolCustomIssueItem[])
      : [];
    if (!issueTypeCodes.length && !customIssueItems.length) {
      messageApi.warning('请至少选择一种问题类型，或添加其他问题');
      throw new Error('validation');
    }
    if (!issueTypeDictUuid) {
      messageApi.error('问题类型字典未加载，请刷新后重试');
      throw new Error('validation');
    }

    let finalizedIssueTypes = issueTypeCodes;
    let issueTypesChanged = false;
    try {
      const finalized = await finalizePatrolIssueTypesForSubmit({
        issueTypeCodes,
        customIssueItems,
        issueTypes,
        issueTypeDictUuid,
      });
      finalizedIssueTypes = finalized.issueTypeCodes;
      issueTypesChanged = finalized.issueTypesChanged;
    } catch (e) {
      if (e instanceof Error && e.message === 'ISSUE_TYPE_REQUIRED') {
        messageApi.warning('请至少选择一种问题类型，或添加其他问题');
        throw new Error('validation');
      }
      throw e;
    }

    setFormLoading(true);
    try {
      const registrantUserId = values.registrant_user_id as number | undefined;
      const beforeIds = normUploadUuids(beforeFiles);
      const payload = {
        workshop_id: values.workshop_id as number | undefined,
        equipment_id: (values.equipment_id as number | undefined) ?? null,
        workshop_area: String(values.workshop_area ?? '').trim() || undefined,
        reported_at: formDateTimeToIso(values.reported_at),
        issue_type_codes: finalizedIssueTypes,
        status: '已登记' as const,
        before_image_file_ids: beforeIds.length ? beforeIds : undefined,
        registrant_user_id: registrantUserId,
        report_enabled: reportEnabled,
        report_notify_user_ids: reportNotifyIds,
      };
      if (isEdit && editId != null) {
        await updateHazardReport(editId, payload);
        messageApi.success('已保存');
      } else {
        await createHazardReport(payload);
        messageApi.success('问题已登记，并同步至「隐患治理」台账，请在该页补充处理记录（05～08）。');
      }
      if (issueTypesChanged) {
        await loadIssueTypes();
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
        已登记: { text: '已登记' },
        已治理: { text: '已治理' },
      },
      fieldProps: { allowClear: true },
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
    { title: '巡查区域', dataIndex: 'workshop_area', width: 120, ellipsis: true, hideInSearch: true },
    {
      title: '问题类型',
      dataIndex: 'issue_type_codes',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => formatIssueTypeLabels(hazardIssueTypeCodes(r), issueTypes, r.problem_summary),
    },
    { title: '登记人', dataIndex: 'registrant_name', width: 100, ellipsis: true, hideInSearch: true },
    {
      title: '责任人',
      dataIndex: 'responsible_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.responsible_name?.trim() || '—',
    },
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
          <Button key="view" {...rowActionKind('read')} onClick={() => void openForm(record, true)}>
            详情
          </Button>
          <Button key="remediate" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            disabled={record.status === '已治理'}
            onClick={() => void openForm(record, false)}
          >
            编辑
          </Button>
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)}>
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
          setBeforeFiles([]);
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
          formRef={formRef}
          workshops={workshops}
          issueTypes={issueTypes}
          dictLoading={dictLoading}
          userOptions={userOptions}
          beforeFiles={beforeFiles}
          onBeforeFilesChange={setBeforeFiles}
          readOnly={isDetailView}
        />
      </FormModalTemplate>
    </>
  );
};

export default PatrolIssueRegisterPage;
