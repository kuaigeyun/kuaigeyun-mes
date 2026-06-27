/**
 * 工序信息管理页面
 * 
 * 提供工序信息的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Table, theme, Descriptions, Select, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { EditOutlined, DeleteOutlined, PlusOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useTrialRunMode } from '../../../../../hooks/useTrialRunMode';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, flushDrawerOpen } from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { OperationFormModal } from '../../../components/OperationFormModal';
import { operationApi, defectTypeApi, type OperationPresetCatalog, type OperationPresetRow } from '../../../services/process';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import { batchImport } from '../../../../../utils/batchOperations';
import { qrcodeApi } from '../../../../../services/qrcode';
import type { Operation, DefectTypeMinimal } from '../../../types/process';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import dayjs from 'dayjs';
import { extractProTableSort, mapProcessListSortField } from '../../../../../utils/tableQueryKey';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { formatDateTime } from '../../../../../utils/format';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import {
  resolvePresetOperationIndustryName,
  resolvePresetOperationNameByKey,
  resolvePresetOperationNameByName,
  resolvePresetOperationDefectName,
} from '../../../../../utils/presetEntityI18n';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

/**
 * 工序信息管理列表页面组件
 */
const OperationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const trialRunMode = useTrialRunMode();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [operationDetail, setOperationDetail] = useState<Operation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetCatalog, setPresetCatalog] = useState<OperationPresetCatalog | null>(null);
  const [presetIndustryId, setPresetIndustryId] = useState<string>('');
  const [selectedPresetKeys, setSelectedPresetKeys] = useState<string[]>([]);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);
  const operationDetailReqRef = useRef(0);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Operation>({ tableName: 'master_data_operations' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: operationApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [customFields.length]);

  const operationImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.operation.code' },
          { field: 'name', required: true, labelKey: 'field.operation.name' },
          {
            field: 'description',
            labelKey: 'field.operation.description',
            aliases: ['描述'],
          },
          {
            field: 'isActive',
            labelKey: 'app.master-data.operations.isActive',
            aliases: ['启用状态'],
          },
          {
            field: 'defectTypes',
            labelKey: 'app.master-data.operations.defectTypes',
            aliases: ['不良品项'],
          },
        ],
        [
          t('app.master-data.operations.importExample.code'),
          t('app.master-data.operations.importExample.name'),
          t('app.master-data.operations.importExample.description'),
          t('app.master-data.operations.importExample.isActive'),
          t('app.master-data.operations.importExample.defectTypes'),
        ],
      ),
    [t, i18n.language],
  );

  const presetOperations = useMemo(() => {
    if (!presetCatalog?.industries?.length || !presetIndustryId) return [];
    return presetCatalog.industries.find((i) => i.id === presetIndustryId)?.operations ?? [];
  }, [presetCatalog, presetIndustryId]);

  const operationDetailColumns: ProDescriptionsItemProps<Operation>[] = useMemo(
    () => [
      { title: t('field.operation.code'), dataIndex: 'code' },
      {
        title: t('field.operation.name'),
        dataIndex: 'name',
        render: (_: unknown, record: Operation) => resolvePresetOperationNameByName(record.name, t),
      },
      { title: t('field.operation.description'), dataIndex: 'description', span: 2 },
      {
        title: t('field.route.isActive'),
        dataIndex: 'isActive',
        render: (_: unknown, record: Operation) => (
          <Tag color={record.isActive ? 'success' : 'default'}>
            {record.isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
          </Tag>
        ),
      },
      {
        title: t('field.operation.defectTypeUuids'),
        dataIndex: 'defectTypes',
        span: 2,
        render: (_: unknown, record: Operation) => {
          const dts = record.defectTypes ?? record.defect_types ?? [];
          const arr = Array.isArray(dts) ? dts : [];
          if (!arr.length) return '-';
          return (
            <Space size={[0, 4]} wrap>
              {arr.map((d: DefectTypeMinimal) => (
                <Tag key={d.uuid}>{d.name ?? d.code}</Tag>
              ))}
            </Space>
          );
        },
      },
      {
        title: t('field.operation.defaultPersonnelConfigs'),
        dataIndex: 'defaultOperatorNames',
        span: 2,
        render: (_: unknown, record: Operation) => {
          const names = record.defaultOperatorNames ?? record.default_operator_names ?? [];
          const arr = Array.isArray(names) ? names : [];
          if (!arr.length) return '-';
          return (
            <Space size={[0, 4]} wrap>
              {arr.map((name: string, idx: number) => (
                <Tag key={idx}>{name}</Tag>
              ))}
            </Space>
          );
        },
      },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t]
  );

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Operation) => {
    const req = ++operationDetailReqRef.current;
    flushDrawerOpen(() => {
      setOperationDetail({ ...record, uuid: record.uuid } as Operation);
      setDrawerVisible(true);
      setDetailLoading(true);
    });
    try {
      const detail = await operationApi.get(record.uuid);
      if (operationDetailReqRef.current !== req) return;
      setOperationDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error: any) {
      if (operationDetailReqRef.current === req) {
        messageApi.error(error.message || t('app.master-data.operations.getDetailFailed'));
      }
    } finally {
      if (operationDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  useEffect(() => {
    const operationUuid = searchParams.get('operationUuid');
    const action = searchParams.get('action');
    if (operationUuid && action === 'detail') {
      handleOpenDetail({ uuid: operationUuid } as Operation);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: Operation) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除工序
   */
  const handleDelete = async (record: Operation) => {
    try {
      await operationApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除工序
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of targetKeys) {
        try {
          await operationApi.delete(key.toString());
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
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: errors.length > 0 ? '：' + errors.join('; ') : '',
          }),
        );
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  const handleImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      operationImportTemplate.importHeaderMap,
    );
    if (headerIndexMap['code'] === undefined || headerIndexMap['name'] === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: `${t('field.operation.code')}、${t('field.operation.name')}`,
          headers: headers.join(', '),
        }),
      );
      return;
    }

    const parseIsActive = (cell: unknown) => {
      if (cell === true) return true;
      const s = String(cell ?? '').trim().toLowerCase();
      return s === '是' || s === '1' || s === 'true' || s === 'enabled' || s === '启用';
    };

    const allDefectInputs = new Set<string>();
    for (const row of rows) {
      if (!row?.length) continue;
      const code = String(row[headerIndexMap['code']] ?? '').trim();
      const name = String(row[headerIndexMap['name']] ?? '').trim();
      if (!code || !name) continue;
      const defectIdx = headerIndexMap['defectTypes'];
      if (defectIdx !== undefined && row[defectIdx] != null) {
        const val = String(row[defectIdx]).trim();
        if (val) {
          val.split(/[,，;；]/).forEach((part: string) => {
            const trimmed = part.trim();
            if (trimmed) allDefectInputs.add(trimmed);
          });
        }
      }
    }

    let defectMap: Record<string, string> = {};
    if (allDefectInputs.size > 0) {
      try {
        defectMap = await defectTypeApi.batchResolveOrCreate(Array.from(allDefectInputs));
      } catch (e: any) {
        messageApi.error(e?.message || t('app.master-data.exportFailed'));
        return;
      }
    }

    const items: { code: string; name: string; description?: string; isActive?: boolean; defectTypeUuids?: string[] }[] = [];
    for (const row of rows) {
      if (!row?.length) continue;
      const code = String(row[headerIndexMap['code']] ?? '').trim();
      const name = String(row[headerIndexMap['name']] ?? '').trim();
      if (!code || !name) continue;
      let defectTypeUuids: string[] = [];
      const defectIdx = headerIndexMap['defectTypes'];
      if (defectIdx !== undefined && row[defectIdx] != null) {
        const val = String(row[defectIdx]).trim();
        if (val) {
          defectTypeUuids = val
            .split(/[,，;；]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((s: string) => defectMap[s])
            .filter(Boolean);
        }
      }
      const descIdx = headerIndexMap['description'];
      const activeIdx = headerIndexMap['isActive'];
      items.push({
        code,
        name,
        description:
          descIdx !== undefined && row[descIdx] != null ? String(row[descIdx]).trim() : undefined,
        isActive: activeIdx !== undefined ? parseIsActive(row[activeIdx]) : true,
        defectTypeUuids: defectTypeUuids.length > 0 ? defectTypeUuids : undefined,
      });
    }
    if (items.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }
    const result = await batchImport({
      items,
      importFn: async (item) => operationApi.create(item),
      title: t('app.master-data.operations.importTitle'),
      concurrency: 5,
    });
    if (result.successCount > 0) {
      messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      actionRef.current?.reload();
    }
    if (result.failureCount > 0) {
      messageApi.warning(t('app.kuaizhizao.productionPlan.importPartialFailed', { count: result.failureCount }));
    }
  };

  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedKeys?: React.Key[], pageData?: Operation[]) => {
    try {
      let list: Operation[] = [];
      if (type === 'selected' && selectedKeys?.length && pageData?.length) {
        list = pageData.filter((r) => selectedKeys.includes(r.uuid));
      } else if (type === 'currentPage' && pageData?.length) {
        list = pageData;
      } else {
        const res = await operationApi.list({ skip: 0, limit: 10000 });
        list = Array.isArray(res) ? res : res?.data ?? [];
      }
      if (list.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const enabledLabel = t('app.master-data.plants.enabled');
      const disabledLabel = t('app.master-data.plants.disabled');
      const csv = [
        [
          t('field.operation.code'),
          t('field.operation.name'),
          t('field.operation.description'),
          t('app.master-data.operations.isActive'),
          t('app.master-data.operations.defectTypes'),
        ].join(','),
        ...list.map((r) => {
          const dts = r.defectTypes ?? r.defect_types ?? [];
          const defectStr = Array.isArray(dts) ? dts.map((d: DefectTypeMinimal) => d.name ?? d.code).filter(Boolean).join(',') : '';
          return [r.code, r.name, r.description ?? '', r.isActive ? enabledLabel : disabledLabel, defectStr].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
        }),
      ].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('app.master-data.operations.exportFilename', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('common.exportSuccess', { count: list.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.exportFailed'));
    }
  };

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.operations.selectForQRCode'));
      return;
    }

    try {
      // 通过API获取选中的工序数据
      const operations = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await operationApi.get(key as string);
          } catch (error) {
            console.error(`获取工序失败: ${key}`, error);
            return null;
          }
        })
      );
      
      const validOperations = operations.filter((op) => op !== null) as Operation[];

      if (validOperations.length === 0) {
        messageApi.error(t('app.master-data.operations.getSelectedFailed'));
        return;
      }

      // 生成二维码
      const qrcodePromises = validOperations.map((operation) =>
        qrcodeApi.generateOperation({
          operation_uuid: operation.uuid,
          operation_code: operation.code || '',
          operation_name: operation.name || '',
        })
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(t('app.master-data.operations.qrCodeGenerated', { count: qrcodes.length }));
      
      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`${t('app.master-data.operations.batchGenerateQrCodeFailed')}: ${error.message || t('common.unknownError')}`);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setOperationDetail(null);
    resetDetailFieldValues();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Operation>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('field.operation.code'),
      dataIndex: 'code',
      copyable: true,width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('field.operation.name'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
      render: (_: unknown, record: Operation) => resolvePresetOperationNameByName(record.name, t),
    },
    {
      title: t('field.operation.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.operation.reportingType'),
      dataIndex: 'reportingType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        quantity: { text: t('field.operation.reportingTypeQuantity'), status: 'Processing' },
        status: { text: t('field.operation.reportingTypeStatus'), status: 'Success' },
      },
      render: (_: any, record: Operation) => (
        <Tag color={record.reportingType === 'quantity' ? 'blue' : 'green'}>
          {record.reportingType === 'quantity' ? t('field.operation.reportingTypeQuantity') : t('field.operation.reportingTypeStatus')}
        </Tag>
      ),
      sorter: true,
    },
    {
      title: t('field.operation.overReportMode'),
      dataIndex: 'overReportMode',
      width: 120,
      hideInSearch: true,
      render: (_: any, record: any) => {
        const m = record.overReportMode ?? record.over_report_mode ?? 'none';
        const v = Number(record.overReportValue ?? record.over_report_value ?? 0) || 0;
        if (!m || m === 'none') return <Tag>—</Tag>;
        const label = m === 'fixed' ? `+${v}` : `${v}%`;
        return <Tag color="blue">{label}</Tag>;
      },
    },
    {
      title: t('field.operation.defectTypeUuids'),
      dataIndex: ['defect_types', 'defectTypes'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_: any, record: Operation) => {
        const dts = record.defectTypes ?? record.defect_types ?? [];
        const arr = Array.isArray(dts) ? dts : [];
        if (!arr.length) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {arr.slice(0, 3).map((d: DefectTypeMinimal) => (
              <Tag key={d.uuid}>{d.name ?? d.code}</Tag>
            ))}
            {arr.length > 3 && <Tag>+{arr.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: t('field.operation.defaultPersonnelConfigs'),
      dataIndex: ['default_operator_names', 'defaultOperatorNames'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_: any, record: Operation) => {
        const names = record.defaultOperatorNames ?? record.default_operator_names ?? [];
        const arr = Array.isArray(names) ? names : [];
        if (!arr.length) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {arr.slice(0, 3).map((name: string, idx: number) => (
              <Tag key={idx}>{name}</Tag>
            ))}
            {arr.length > 3 && <Tag>+{arr.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: t('app.master-data.operations.isActive'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('app.master-data.plants.enabled'), status: 'Success' },
        false: { text: t('app.master-data.plants.disabled'), status: 'Default' },
      },
      render: (_: any, record: Operation) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
        </Tag>
      ),
      sorter: true,
    },
    ...customFieldColumns,
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
      render: (_: any, record: Operation) => {
        const val = record.createdAt ?? (record as any).created_at;
        if (val == null || val === '') return '-';
        return dayjs(val).isValid() ? formatDateTime(val, 'YYYY-MM-DD HH:mm:ss') : String(val);
      },
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_: any, record: Operation) => (
        <Space>
          <Button key="view" {...rowActionKind('read')}
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            {t('field.customField.view')}
          </Button>
          <Button key="edit" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('common.confirmDelete')}
            description={t('app.master-data.operations.deleteConfirmDesc')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ];
  }, [customFields, t]);

  return (
    <ListPageTemplate>
      <UniTable<Operation>
        columnPersistenceId="apps.master-data.pages.process.operations"
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
            const result = await operationApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            const enrichedData = await enrichRecordsWithCustomFields(listData);
            return {
              data: enrichedData,
              success: true,
              total: typeof result?.total === 'number' ? result.total : listData.length,
            };
          } catch (error: any) {
            console.error('获取工序列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.operations.listFailed'));
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
        showCreateButton
        createButtonText={t('field.operation.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        toolBarActionsAfterCreate={[
          trialRunMode ? (
            <Button {...rowActionKind('import')}
              key="loadPreset"
              loading={loadPresetLoading}
              onClick={async () => {
                try {
                  setLoadPresetLoading(true);
                  const catalog = await operationApi.getPresetPreview();
                  setPresetCatalog(catalog);
                  const first = catalog.industries?.[0];
                  const iid = first?.id ?? '';
                  setPresetIndustryId(iid);
                  setSelectedPresetKeys((first?.operations ?? []).map((o) => o.presetKey));
                  setPresetModalVisible(true);
                } catch (e: any) {
                  messageApi.error(e?.message || t('common.operationFailed'));
                } finally {
                  setLoadPresetLoading(false);
                }
              }}
            >
              {t('field.operation.loadPreset')}
            </Button>
          ) : null,
        ].filter(Boolean)}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.operations.confirmBatchDeleteContent', { count })
        }
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="operation-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaiplm.phase2.common.batchActions')}
            menuItems={[
              ...batchActiveMenuItems,
              {
                key: 'batch-generate-qrcode',
                label: t('app.kuaizhizao.workOrder.batchGenerateQrcode'),
                onClick: handleBatchGenerateQRCode,
              },
            ]}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton
        onImport={handleImport}
        importHeaders={operationImportTemplate.importHeaders}
        importExampleRow={operationImportTemplate.importExampleRow}
        importFieldMap={operationImportTemplate.importHeaderMap}
        showExportButton
        onExport={handleExport}
      />

      <UniDetail
        title={t('app.master-data.operations.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          operationDetail ? (
            <div style={{ position: 'relative', paddingRight: 168 }}>
              <Descriptions
                column={1}
                items={detailDrawerDescriptionItems(operationDetailColumns, operationDetail)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 152,
                  zIndex: 1,
                  background: token.colorBgContainer,
                  padding: 12,
                  borderRadius: token.borderRadiusLG,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <QRCodeGenerator
                  qrcodeType="OP"
                  data={{
                    operation_uuid: operationDetail.uuid,
                    operation_code: operationDetail.code || '',
                    operation_name: operationDetail.name || '',
                  }}
                  autoGenerate={true}
                  showCardTitle={false}
                  size={6}
                  noCard={true}
                />
              </div>
            </div>
          ) : null
        }
        linesTitle={t('app.master-data.customFields')}
        lines={
          hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
            <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
          ) : null
        }
      />

      <OperationFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

      <Modal
        title={t('field.operation.loadPreset')}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        width={760}
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setPresetModalVisible(false)}>{t('common.cancel')}</Button>,
          <Button {...rowActionKind('audit')}
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={!presetIndustryId || selectedPresetKeys.length === 0}
            onClick={async () => {
              try {
                setPresetConfirmLoading(true);
                const res = await operationApi.loadPreset(presetIndustryId, selectedPresetKeys);
                messageApi.success(res.message);
                setPresetModalVisible(false);
                actionRef.current?.reload();
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'));
              } finally {
                setPresetConfirmLoading(false);
              }
            }}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
          {t('app.master-data.operations.presetModalHint')}
        </p>
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ marginRight: 8 }}>
            {t('app.master-data.operations.presetIndustryLabel')}
          </Typography.Text>
          <Select
            style={{ minWidth: 260 }}
            placeholder={t('app.master-data.operations.presetIndustryPlaceholder')}
            value={presetIndustryId || undefined}
            options={(presetCatalog?.industries ?? []).map((ind) => ({
              value: ind.id,
              label: resolvePresetOperationIndustryName(ind.id, ind.name, t),
            }))}
            onChange={(v: string) => {
              setPresetIndustryId(v);
              const ind = presetCatalog?.industries?.find((i) => i.id === v);
              setSelectedPresetKeys((ind?.operations ?? []).map((o) => o.presetKey));
            }}
          />
        </div>
        <Table<OperationPresetRow>
          size="small"
          rowKey="presetKey"
          dataSource={presetOperations}
          locale={{
            emptyText: t('app.master-data.operations.presetEmptyIndustry'),
          }}
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            selectedRowKeys: selectedPresetKeys,
            onChange: (keys) => setSelectedPresetKeys(keys as string[]),
          }}
          columns={[
            {
              title: t('field.operation.name'),
              dataIndex: 'name',
              width: 140,
              ellipsis: true,
              render: (_: unknown, row: OperationPresetRow) =>
                resolvePresetOperationNameByKey(row.presetKey, row.name, t),
            },
            {
              title: t('field.department.sortOrder'),
              dataIndex: 'sortOrder',
              width: 72,
            },
            {
              title: t('app.master-data.operations.presetDefectsColumn'),
              key: 'defects',
              ellipsis: true,
              render: (_: unknown, row) => {
                const parts = (row.defectPresets ?? [])
                  .map((d) => resolvePresetOperationDefectName(d.code, d.name, t))
                  .filter(Boolean);
                const separator = i18n.language?.startsWith('zh') ? '、' : ', ';
                const text = parts.length ? parts.join(separator) : '—';
                return (
                  <Typography.Text type="secondary" ellipsis={{ tooltip: text }}>
                    {text}
                  </Typography.Text>
                );
              },
            },
          ]}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default OperationsPage;
