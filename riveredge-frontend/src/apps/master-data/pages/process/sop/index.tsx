/**
 * 标准操作SOP管理页面
 * 
 * 提供标准操作SOP的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptionsItemProps } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Row, Col, List, Typography, Descriptions } from 'antd';
import dayjs from 'dayjs';
import { EditOutlined, DeleteOutlined, PlusOutlined, ApartmentOutlined } from '@ant-design/icons';
import SOPBatchCreateSteps from './SOPBatchCreateSteps';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ROW_ACTIONS_INLINE_GAP } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { downloadFile } from '../../../../../utils';
import { batchImport } from '../../../../../utils/batchOperations';
import { ListPageTemplate, FormModalTemplate, flushDrawerOpen } from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';

import { sopApi, operationApi, processRouteApi, unwrapProcessPagedList } from '../../../services/process';
import { extractProTableSort, mapProcessListSortField } from '../../../../../utils/tableQueryKey';
import { materialApi, materialGroupApi } from '../../../services/material';
import type { MaterialListResponse } from '../../../types/material';
import type { SOP, SOPCreate, SOPUpdate, Operation } from '../../../types/process';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';

/**
 * 标准操作SOP管理列表页面组件
 */
const SOPPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSOPUuid, setCurrentSOPUuid] = useState<string | null>(null);
  const [sopDetail, setSopDetail] = useState<SOP | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑SOP；作业指导与报工采集在图形化设计页管理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // 新建 Modal 状态（仅批量创建时使用）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  
  // 工序列表（用于下拉选择）
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  // 物料组/物料/工艺路线（绑定与载入用）
  const [materialGroups, setMaterialGroups] = useState<{ uuid: string; code: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ uuid: string; code: string; name: string }[]>([]);
  const [routes, setRoutes] = useState<{ uuid: string; code: string; name: string }[]>([]);
  const sopDetailReqRef = useRef(0);

  /**
   * 从 URL 参数打开编辑弹窗（editUuid）、设计页（editUuid+tab=workflow/formConfig）或新建弹窗（create=1）
   */
  useEffect(() => {
    const editUuid = searchParams.get('editUuid');
    const tab = searchParams.get('tab');
    const create = searchParams.get('create');
    if (editUuid) {
      if (tab === 'workflow' || tab === 'formConfig') {
        navigate(`/apps/master-data/process/sop/designer?uuid=${editUuid}&from=edit`, { replace: true });
        setSearchParams({}, { replace: true });
        return;
      }
      const initialTab = tab === 'scope' ? 'scope' : undefined;
      handleEdit({ uuid: editUuid } as SOP, initialTab).then(() => {
        setSearchParams({}, { replace: true });
      });
    } else if (create === '1') {
      setIsEdit(false);
      setCurrentSOPUuid(null);
      formRef.current?.resetFields();
      setModalVisible(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams.get('editUuid'), searchParams.get('create')]);

  /**
   * 加载工序、物料组、物料、工艺路线列表
   */
  useEffect(() => {
    const load = async () => {
      try {
        setOperationsLoading(true);
        const [opRes, mgRes, matRes, routeRes] = await Promise.all([
          operationApi.list({ limit: 1000, isActive: true }),
          materialGroupApi.list({ limit: 1000 }).catch(() => []),
          materialApi.list({ limit: 2000, isActive: true }).catch(() => []),
          processRouteApi.list({ limit: 500, isActive: true }).catch(() => []),
        ]);
        setOperations(unwrapProcessPagedList(opRes));
        setMaterialGroups(Array.isArray(mgRes) ? mgRes : []);
        const rawMats = Array.isArray(matRes)
          ? matRes
          : ((matRes as MaterialListResponse | undefined)?.items ?? []);
        setMaterials(
          rawMats.map((m: any) => ({
            uuid: m.uuid,
            code: m.mainCode ?? m.code ?? '',
            name: m.name ?? '',
          }))
        );
        setRoutes(
          unwrapProcessPagedList(routeRes).map((r: any) => ({
            uuid: r.uuid,
            code: r.code,
            name: r.name,
          }))
        );
      } catch (e) {
        console.error('加载基础数据失败:', e);
      } finally {
        setOperationsLoading(false);
      }
    };
    load();
  }, []);

  /**
   * 处理关闭新建 Modal
   */
  const handleCloseCreateModal = () => {
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  /**
   * 批量创建完成后，关闭新建 Modal 并打开编辑（可选）
   */
  const handleBatchCreateSuccess = () => {
    handleCloseCreateModal();
  };

  /**
   * 批量创建中点击某条 SOP 的编辑：打开编辑 Modal 或设计页
   */
  const handleBatchCreateEditSop = async (uuid: string, tab?: 'formConfig') => {
    handleCloseCreateModal();
    if (tab === 'formConfig') {
      navigate(`/apps/master-data/process/sop/designer?uuid=${uuid}&from=edit`);
      return;
    }
    await handleEdit({ uuid } as SOP);
  };

  /**
   * 处理编辑SOP（仅基本信息与适用范围；流程与报工采集在设计页管理）
   */
  const handleEdit = async (record: SOP, _initialTab?: 'basic' | 'scope') => {
    try {
      setIsEdit(true);
      setCurrentSOPUuid(record.uuid);
      setModalVisible(true);

      const detail = await sopApi.get(record.uuid);
      const d = detail as any;
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        operationId: detail.operationId,
        version: detail.version,
        content: detail.content,
        isActive: detail.isActive ?? (detail as any).is_active ?? true,
        material_group_uuids: d.material_group_uuids ?? d.materialGroupUuids ?? undefined,
        material_uuids: d.material_uuids ?? d.materialUuids ?? undefined,
      });
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.sop.getDetailFailed'));
    }
  };

  /**
   * 处理删除SOP
   */
  const handleDelete = async (record: SOP) => {
    try {
      await sopApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除SOP
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await sopApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('common.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          }
          if (failCount > 0) {
            messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SOP) => {
    const req = ++sopDetailReqRef.current;
    flushDrawerOpen(() => {
      setCurrentSOPUuid(record.uuid);
      setSopDetail(record);
      setDrawerVisible(true);
      setDetailLoading(true);
    });
    try {
      const detail = await sopApi.get(record.uuid);
      if (sopDetailReqRef.current !== req) return;
      setSopDetail(detail);
    } catch (error: any) {
      if (sopDetailReqRef.current === req) {
        messageApi.error(error.message || t('app.master-data.sop.getDetailFailed'));
      }
    } finally {
      if (sopDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentSOPUuid(null);
    setSopDetail(null);
  };

  /**
   * 处理提交表单（创建/更新SOP）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 仅提交基本信息与适用范围；流程与报工采集在设计页保存
      const payload: Record<string, unknown> = {
        ...values,
        material_group_uuids: values.material_group_uuids ?? values.materialGroupUuids ?? null,
        material_uuids: values.material_uuids ?? values.materialUuids ?? null,
      };
      
      if (isEdit && currentSOPUuid) {
        // 更新SOP
        await sopApi.update(currentSOPUuid, payload as SOPUpdate);
        messageApi.success(t('common.updateSuccess'));
      } else {
        // 创建SOP
        await sopApi.create(payload as unknown as SOPCreate);
        messageApi.success(t('common.createSuccess'));
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }
    const col = (n: string) => headers.findIndex((h: string) => (h || '').replace(/\*+/, '').trim() === n);
    const idxCode = col('SOP编号') >= 0 ? col('SOP编号') : col('编号');
    const idxName = col('SOP名称') >= 0 ? col('SOP名称') : col('名称');
    const idxVersion = col('版本') >= 0 ? col('版本') : -1;
    if (idxCode < 0 || idxName < 0) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'SOP编号/名称', headers: headers.join(', ') }));
      return;
    }
    const items: SOPCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    rows.forEach((row: any[], i: number) => {
      const code = (row[idxCode] ?? '').toString().trim();
      const name = (row[idxName] ?? '').toString().trim();
      const version = idxVersion >= 0 ? (row[idxVersion] ?? '').toString().trim() : undefined;
      if (!code) {
        errors.push({ row: i + 3, message: 'SOP编号不能为空' });
        return;
      }
      if (!name) {
        errors.push({ row: i + 3, message: 'SOP名称不能为空' });
        return;
      }
      items.push({ code, name, version: version || undefined, isActive: true });
    });
    if (errors.length > 0) {
      Modal.warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List size="small" dataSource={errors} renderItem={(e) => (
              <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.message })}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      });
      return;
    }
    try {
      const result = await batchImport({
        items,
        importFn: async (item) => sopApi.create(item),
        title: '正在导入SOP',
        concurrency: 5,
      });
      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.error })}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      }
      if (result.successCount > 0) actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed'));
    }
  };

  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: SOP[]) => {
    try {
      let toExport: SOP[] = [];
      if (type === 'all') {
        const res = await sopApi.list({ skip: 0, limit: 10000 });
        toExport = Array.isArray(res) ? res : res?.data ?? [];
      } else if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        toExport = currentPageData.filter((r) => selectedRowKeys.includes(r.uuid));
      } else if (type === 'currentPage' && currentPageData) {
        toExport = currentPageData;
      } else {
        const res = await sopApi.list({ skip: 0, limit: 10000 });
        toExport = Array.isArray(res) ? res : res?.data ?? [];
      }
      if (toExport.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const headers = ['SOP编号', 'SOP名称', '版本', '启用状态', '创建时间'];
      const csvRows = [headers.join(',')];
      toExport.forEach((r) => {
        const isActive = r?.isActive ?? (r as any)?.is_active;
        csvRows.push([
          r.code || '',
          r.name || '',
          r.version || '',
          isActive ? '启用' : '禁用',
          r.createdAt ? new Date(r.createdAt).toLocaleString() : (r as any).created_at ? new Date((r as any).created_at).toLocaleString() : '',
        ].map((c) => {
          const s = String(c ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','));
      });
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `sop_${new Date().toISOString().slice(0, 10)}.csv`);
      messageApi.success(t('common.exportSuccess', { count: toExport.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'));
    }
  };

  /**
   * 处理关闭 Modal（编辑/单个新建）
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setIsEdit(false);
    setCurrentSOPUuid(null);
    formRef.current?.resetFields();
  };

  /**
   * 选择单个新建：关闭新建 Modal，打开编辑 Modal 用于创建
   */
  const handleSelectSingleCreate = () => {
    setCreateModalVisible(false);
    setIsEdit(false);
    setCurrentSOPUuid(null);
    formRef.current?.resetFields();
    setModalVisible(true);
  };

  useNewShortcut(handleSelectSingleCreate);

  /**
   * 获取工序名称
   */
  const getOperationName = (operationId?: number): string => {
    if (!operationId) return '-';
    const operation = operations.find(o => o.id === operationId);
    return operation ? `${operation.code} - ${operation.name}` : `工序ID: ${operationId}`;
  };

  const bomLoadModeLabel = (mode?: string | null) => {
    const m = mode || 'by_material';
    if (m === 'by_material_group') return '按关联物料组载入 BOM';
    if (m === 'specific_bom') return '指定 BOM';
    return '按关联物料载入 BOM';
  };

  const sopDetailBasicColumns: ProDescriptionsItemProps<SOP>[] = useMemo(
    () => [
      { title: t('app.master-data.sop.codeLabel', { defaultValue: 'SOP编号' }), dataIndex: 'code' },
      { title: t('app.master-data.sop.nameLabel', { defaultValue: 'SOP名称' }), dataIndex: 'name' },
      {
        title: t('app.master-data.sop.operationLabel', { defaultValue: '关联工序' }),
        dataIndex: 'operationId',
        render: (_: unknown, record: SOP) =>
          getOperationName(record?.operationId ?? (record as any)?.operation_id),
      },
      {
        title: t('app.master-data.sop.versionLabel', { defaultValue: '版本号' }),
        dataIndex: 'version',
        render: (_: unknown, record: SOP) => {
          const v = (record as any)?.version;
          return v != null && String(v).trim() !== '' ? String(v) : '-';
        },
      },
      {
        title: t('app.master-data.sop.contentLabel', { defaultValue: '备注 / SOP内容' }),
        dataIndex: 'content',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const c = (record as any)?.content;
          const text = c != null && String(c).trim() !== '' ? String(c) : '-';
          return (
            <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }} ellipsis={{ rows: 8, expandable: true }}>
              {text}
            </Typography.Paragraph>
          );
        },
      },
      {
        title: t('field.route.isActive'),
        dataIndex: 'isActive',
        render: (_: unknown, record: SOP) => {
          const isActive = record?.isActive ?? (record as any)?.is_active;
          return (
            <Tag color={isActive ? 'success' : 'default'}>
              {isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
            </Tag>
          );
        },
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'createdAt',
        render: (_: unknown, record: SOP) => {
          const v = (record as any)?.createdAt ?? (record as any)?.created_at;
          return v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updatedAt',
        render: (_: unknown, record: SOP) => {
          const v = (record as any)?.updatedAt ?? (record as any)?.updated_at;
          return v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
    ],
    [t, operations]
  );

  const sopDetailBindingColumns: ProDescriptionsItemProps<SOP>[] = useMemo(
    () => [
      {
        title: '绑定物料组',
        dataIndex: 'materialGroupUuids',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const uuids: string[] =
            (record as any)?.materialGroupUuids ?? (record as any)?.material_group_uuids ?? [];
          if (!Array.isArray(uuids) || uuids.length === 0) return '-';
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {uuids.map((u) => {
                const g = materialGroups.find((x) => x.uuid === u);
                return <Tag key={u}>{g ? `${g.code} - ${g.name}` : u}</Tag>;
              })}
            </Space>
          );
        },
      },
      {
        title: '绑定物料',
        dataIndex: 'materialUuids',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const uuids: string[] = (record as any)?.materialUuids ?? (record as any)?.material_uuids ?? [];
          if (!Array.isArray(uuids) || uuids.length === 0) return '-';
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {uuids.map((u) => {
                const m = materials.find((x) => x.uuid === u);
                return <Tag key={u}>{m ? `${m.code} - ${m.name}` : u}</Tag>;
              })}
            </Space>
          );
        },
      },
      {
        title: '载入工艺路线',
        dataIndex: 'routeUuids',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const uuids: string[] = (record as any)?.routeUuids ?? (record as any)?.route_uuids ?? [];
          if (!Array.isArray(uuids) || uuids.length === 0) return '-';
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {uuids.map((u) => {
                const r = routes.find((x) => x.uuid === u);
                return <Tag key={u}>{r ? `${r.code} - ${r.name}` : u}</Tag>;
              })}
            </Space>
          );
        },
      },
      {
        title: 'BOM 载入方式',
        dataIndex: 'bomLoadMode',
        render: (_: unknown, record: SOP) =>
          bomLoadModeLabel((record as any)?.bomLoadMode ?? (record as any)?.bom_load_mode),
      },
      {
        title: '指定 BOM UUID',
        dataIndex: 'specificBomUuid',
        render: (_: unknown, record: SOP) => {
          const u = (record as any)?.specificBomUuid ?? (record as any)?.specific_bom_uuid;
          return u ? (
            <Typography.Text copyable={{ text: String(u) }} style={{ wordBreak: 'break-all' }}>
              {String(u)}
            </Typography.Text>
          ) : (
            '-'
          );
        },
      },
    ],
    [materialGroups, materials, routes]
  );

  const sopDetailDigitalColumns: ProDescriptionsItemProps<SOP>[] = useMemo(
    () => [
      {
        title: '作业指导流程（ProFlow）',
        dataIndex: 'flowConfig',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const fc = (record as any)?.flowConfig ?? (record as any)?.flow_config;
          if (fc == null || (typeof fc === 'object' && Object.keys(fc).length === 0)) return '-';
          const nodes = (fc as any)?.nodes;
          const n = Array.isArray(nodes) ? nodes.length : 0;
          return n > 0 ? `已配置（${n} 个节点）` : '已配置';
        },
      },
      {
        title: '报工数据采集项（Formily）',
        dataIndex: 'formConfig',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const fc = (record as any)?.formConfig ?? (record as any)?.form_config;
          if (fc == null || (typeof fc === 'object' && Object.keys(fc).length === 0)) return '-';
          return '已配置';
        },
      },
      {
        title: '附件',
        dataIndex: 'attachments',
        span: 2,
        render: (_: unknown, record: SOP) => {
          const att = (record as any)?.attachments;
          if (att == null) return '-';
          if (Array.isArray(att)) return att.length === 0 ? '-' : `${att.length} 个附件`;
          if (typeof att === 'object') {
            const k = Object.keys(att).length;
            return k === 0 ? '-' : `${k} 项（JSON）`;
          }
          return String(att);
        },
      },
    ],
    []
  );

  /**
   * 表格列定义
   */
  const columns: ProColumns<SOP>[] = [
    {
      title: 'SOP编号',
      dataIndex: 'code',
      copyable: true,width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: 'SOP名称',
      dataIndex: 'name',
      width: 200,
      sorter: true,
    },
    {
      key: 'sop-operation-filter',
      title: '关联工序',
      dataIndex: 'operationId',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: '筛选工序',
        options: operations.map((o) => ({ label: `${o.code} - ${o.name}`, value: o.id })),
        showSearch: true,
      },
    },
    {
      title: '关联工序',
      dataIndex: 'operationId',
      width: 200,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => getOperationName(record.operationId),
    },
    {
      title: '绑定/载入',
      dataIndex: '_binding',
      width: 140,
      hideInSearch: true,
      render: (_, record: any) => {
        const ma = record.material_uuids ?? record.materialUuids ?? [];
        const mg = record.material_group_uuids ?? record.materialGroupUuids ?? [];
        const rt = record.route_uuids ?? record.routeUuids ?? [];
        const parts: string[] = [];
        if (ma?.length) parts.push(`物料×${ma.length}`);
        if (mg?.length) parts.push(`物料组×${mg.length}`);
        if (rt?.length) parts.push(`路线×${rt.length}`);
        return parts.length ? parts.join(' ') : '-';
      },
    },
    {
      title: '按物料',
      dataIndex: 'material_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: '筛选绑定该物料的SOP',
        options: materials.map((m: any) => ({ label: `${m.mainCode ?? m.code ?? ''} - ${m.name ?? ''}`, value: m.uuid })),
        showSearch: true,
      },
    },
    {
      title: '按物料组',
      dataIndex: 'material_group_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: '筛选绑定该物料组的SOP',
        options: materialGroups.map((g: any) => ({ label: `${g.code ?? ''} - ${g.name ?? ''}`, value: g.uuid })),
        showSearch: true,
      },
    },
    {
      title: '按工艺路线',
      dataIndex: 'route_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: '筛选载入该工艺路线的SOP',
        options: routes.map((r: any) => ({ label: `${r.code ?? ''} - ${r.name ?? ''}`, value: r.uuid })),
        showSearch: true,
      },
    },
    {
      title: '版本号',
      dataIndex: 'version',
      width: 120,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.content ? `${record.content.substring(0, 50)}...` : '-',
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => {
        const isActive = record?.isActive ?? (record as any)?.is_active;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? '启用' : '禁用'}
          </Tag>
        );
      },
      sorter: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 280,
      fixed: 'right',
      render: (_, record) => {
        const goDesigner = () => {
          navigate(`/apps/master-data/process/sop/designer?uuid=${record.uuid}&from=edit`);
        };
        return (
          <Space size={ROW_ACTIONS_INLINE_GAP} wrap={false} style={{ whiteSpace: 'nowrap' }}>
            <Button type="link" size="small" onClick={() => handleOpenDetail(record)}>
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<ApartmentOutlined />}
              onClick={goDesigner}
              title="打开图形化流程设计"
            >
              设计
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定要删除这个SOP吗？"
              onConfirm={() => handleDelete(record)}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<SOP>
        columnPersistenceId="apps.master-data.pages.process.sop"
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 工序筛选
          if (searchFormValues?.operationId !== undefined && searchFormValues.operationId !== '' && searchFormValues.operationId !== null) {
            apiParams.operationId = searchFormValues.operationId;
          }
          // 绑定/载入筛选（标准操作SOP 阶段一）
          if (searchFormValues?.material_uuid) apiParams.material_uuid = searchFormValues.material_uuid;
          if (searchFormValues?.material_group_uuid) apiParams.material_group_uuid = searchFormValues.material_group_uuid;
          if (searchFormValues?.route_uuid) apiParams.route_uuid = searchFormValues.route_uuid;

          const fuzzyKw = String(searchFormValues?.keyword ?? '').trim();
          const fallbackKw =
            fuzzyKw ||
            String(searchFormValues?.code ?? '').trim() ||
            String(searchFormValues?.name ?? '').trim();
          if (fallbackKw) apiParams.keyword = fallbackKw;

          const { sortBy: rawSortBy, sortOrder } = extractProTableSort(sort);
          const sortField = mapProcessListSortField(rawSortBy);
          if (sortField) {
            apiParams.sortBy = sortField;
            apiParams.sortOrder = sortOrder;
          }

          try {
            const result = await sopApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            return {
              data: listData,
              success: true,
              total: typeof result?.total === 'number' ? result.total : listData.length,
            };
          } catch (error: any) {
            console.error('获取SOP列表失败:', error);
            messageApi.error(error?.message || '获取SOP列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleSelectSingleCreate}>
            {'新建SOP' + NEW_SHORTCUT_HINT}
          </Button>,
          <Button key="batch-create" type="default" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            按工艺路线批量创建
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={['*SOP编号', '*SOP名称', '版本']}
        importExampleRow={['SOP001', '装配作业指导', 'v1.0']}
        importFieldMap={{
          'SOP编号': 'code',
          '*SOP编号': 'code',
          'SOP名称': 'name',
          '*SOP名称': 'name',
          '版本': 'version',
        }}
        importFieldRules={{ code: { required: true }, name: { required: true } }}
        showExportButton={true}
        onExport={handleExport}
      />

      <UniDetail
        title={t('app.master-data.sop.detailTitle', { defaultValue: 'SOP详情' })}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          sopDetail ? (
            <Descriptions
              column={1}
              size="small"
              items={detailDrawerDescriptionItems(sopDetailBasicColumns, sopDetail)}
            />
          ) : null
        }
        collaboration={
          sopDetail ? (
            <Descriptions
              column={1}
              size="small"
              items={detailDrawerDescriptionItems(sopDetailBindingColumns, sopDetail)}
            />
          ) : null
        }
        collaborationTitle={t('app.master-data.sop.detailSectionBinding', { defaultValue: '绑定与 BOM 载入' })}
        lines={
          sopDetail ? (
            <Descriptions
              column={1}
              size="small"
              items={detailDrawerDescriptionItems(sopDetailDigitalColumns, sopDetail)}
            />
          ) : null
        }
        linesTitle={t('app.master-data.sop.detailSectionDigital', { defaultValue: '数字化作业指导' })}
      />

      {/* 新建 SOP Modal：按工艺路线批量创建 */}
      <Modal
        className="modal-no-limit-height"
        title="按工艺路线批量创建 SOP"
        open={createModalVisible}
        onCancel={handleCloseCreateModal}
        footer={null}
        width={900}
        destroyOnHidden
      >
        <SOPBatchCreateSteps
          onSuccess={handleBatchCreateSuccess}
          onCancel={handleCloseCreateModal}
          onEditSop={handleBatchCreateEditSop}
        />
      </Modal>

      <FormModalTemplate
        title={isEdit ? '编辑SOP' : '新建SOP'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={640}
        grid={false}
        formRef={formRef}
        initialValues={{ isActive: true }}
      >
        <div style={{ padding: '8px 0', minWidth: 0 }}>
          <Row gutter={[16, 16]}>
            <Col span={12} style={{ minWidth: 0 }}>
              <ProFormText
                name="code"
                label="SOP编号"
                placeholder="请输入SOP编号"
                rules={[
                  { required: true, message: '请输入SOP编号' },
                  { max: 100, message: 'SOP编号不能超过100个字符' },
                ]}
                fieldProps={{ style: { textTransform: 'uppercase' } }}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <ProFormText
                name="name"
                label="SOP名称"
                placeholder="请输入SOP名称"
                rules={[
                  { required: true, message: '请输入SOP名称' },
                  { max: 200, message: 'SOP名称不能超过200个字符' },
                ]}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <SafeProFormSelect
                name="operationId"
                label="关联工序"
                placeholder="请选择关联工序（可选）"
                options={operations.map(o => ({ label: `${o.code} - ${o.name}`, value: o.id }))}
                fieldProps={{
                  loading: operationsLoading,
                  showSearch: true,
                  allowClear: true,
                  filterOption: (input: string, option: { label?: React.ReactNode }) =>
                    (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase()),
                }}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <ProFormText
                name="version"
                label="版本号"
                placeholder="请输入版本号（如：v1.0）"
                rules={[{ max: 20, message: '版本号不能超过20个字符' }]}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <SafeProFormSelect
                name="material_group_uuids"
                label="绑定物料组"
                placeholder="请选择物料组（可选，可多选）"
                mode="multiple"
                options={materialGroups.map(g => ({ label: `${g.code} - ${g.name}`, value: g.uuid }))}
                fieldProps={{ showSearch: true, filterOption: (i: string, o: any) => (o?.label ?? '').toLowerCase().includes((i || '').toLowerCase()) }}
              />
            </Col>
            <Col span={12} style={{ minWidth: 0 }}>
              <SafeProFormSelect
                name="material_uuids"
                label="绑定物料"
                placeholder="请选择物料（可选，可多选；优先于物料组）"
                mode="multiple"
                options={materials.map(m => ({ label: `${(m as any).mainCode ?? (m as any).code ?? ''} - ${(m as any).name}`, value: m.uuid }))}
                fieldProps={{ showSearch: true, filterOption: (i: string, o: any) => (o?.label ?? '').toLowerCase().includes((i || '').toLowerCase()) }}
              />
            </Col>
          </Row>
          <ProFormTextArea
            name="content"
            label="备注"
            placeholder="补充说明、注意事项等（流程步骤请在列表操作列点击「设计」在图形化设计页配置）"
            colProps={{ span: 24 }}
            fieldProps={{ rows: 3, maxLength: 5000 }}
            style={{ marginTop: 16 }}
          />
          <div style={{ marginTop: 16 }}>
            <ProFormSwitch name="isActive" label="是否启用" />
          </div>
        </div>
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SOPPage;
