/**
 * 工作中心页面
 *
 * 提供工作中心的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { workCenterApi, workstationApi } from '../../../services/factory';
import { WorkCenterFormModal } from '../../../components/WorkCenterFormModal';
import type { WorkCenter, WorkCenterCreate, Workstation } from '../../../types/factory';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../../utils';

/**
 * 工作中心列表页面组件
 */
const WorkCentersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workCenterDetail, setWorkCenterDetail] = useState<WorkCenter | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [workstationMap, setWorkstationMap] = useState<Record<number, Workstation>>({});

  useEffect(() => {
    const loadWorkstations = async () => {
      try {
        const list = await workstationApi.list({ limit: 5000, isActive: true });
        const map: Record<number, Workstation> = {};
        list.forEach((ws) => { map[ws.id] = ws; });
        setWorkstationMap(map);
      } catch (error) {
        console.error('加载工位列表失败:', error);
      }
    };
    loadWorkstations();
  }, []);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: WorkCenter) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleOpenDetail = async (record: WorkCenter) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      const detail = await workCenterApi.get(record.uuid);
      setWorkCenterDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.workCenters.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkCenterDetail(null);
  };

  const handleDelete = async (record: WorkCenter) => {
    try {
      await workCenterApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = selectedRowKeys.map(key => String(key));
      const result = await workCenterApi.batchDelete(uuids);

      if (result.success) {
        messageApi.success(result.message || t('app.master-data.batchDeleteSuccess'));
      } else {
        messageApi.warning(result.message || t('app.master-data.batchDeletePartial'));
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2);

    const nonEmptyRows = rows.filter((row: any[]) => {
      if (!row || row.length === 0) return false;
      return row.some((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value !== '';
      });
    });

    if (nonEmptyRows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }

    const headerMap: Record<string, string> = {
      '工作中心编码': 'code',
      '*工作中心编码': 'code',
      '编码': 'code',
      '*编码': 'code',
      'code': 'code',
      '*code': 'code',
      '工作中心名称': 'name',
      '*工作中心名称': 'name',
      '名称': 'name',
      '*名称': 'name',
      'name': 'name',
      '*name': 'name',
      '描述': 'description',
      'description': 'description',
    };

    const headerIndexMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = String(header || '').trim();
      if (headerMap[normalizedHeader]) {
        headerIndexMap[headerMap[normalizedHeader]] = index;
      } else {
        const withoutStar = normalizedHeader.replace(/^\*+/, '').trim();
        if (headerMap[withoutStar]) {
          headerIndexMap[headerMap[withoutStar]] = index;
        }
      }
    });

    if (headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('field.workCenter.code'), headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('field.workCenter.name'), headers: headers.join(', ') }));
      return;
    }

    const importData: WorkCenterCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmptyRow = !row || row.length === 0 || row.every((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value === '';
      });

      if (isEmptyRow) return;

      let actualRowIndex = rowIndex + 3;
      for (let i = 2; i < data.length; i++) {
        if (data[i] === row) {
          actualRowIndex = i + 1;
          break;
        }
      }

      try {
        const codeIndex = headerIndexMap['code'];
        const nameIndex = headerIndexMap['name'];
        const descriptionIndex = headerIndexMap['description'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;

        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';

        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('field.workCenter.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('field.workCenter.nameRequired') });
          return;
        }

        const workCenterData: WorkCenterCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          description: description ? String(description).trim() : undefined,
          isActive: true,
        };

        importData.push(workCenterData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.dataParseFailed'),
        });
      }
    });

    if (errors.length > 0) {
      Modal.warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.rowError', { row: item.row, message: item.message })}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    if (importData.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }

    try {
      const result = await batchImport({
        items: importData,
        importFn: async (item: WorkCenterCreate) => {
          return await workCenterApi.create(item);
        },
        title: t('app.master-data.workCenters.importTitle'),
        concurrency: 5,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong>
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(item) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.master-data.rowError', { row: item.row, message: item.error })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.workCenters.importSuccess', { count: result.successCount }));
      }

      if (result.successCount > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.importFailed'));
    }
  };

  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: WorkCenter[]
  ) => {
    try {
      let exportData: WorkCenter[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.workCenters.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        exportData = currentPageData;
        filename = `${t('app.master-data.workCenters.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else {
        const allData = await workCenterApi.list({ skip: 0, limit: 10000 });
        exportData = allData;
        filename = `${t('app.master-data.workCenters.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      const headers = [t('field.workCenter.code'), t('field.workCenter.name'), t('field.workCenter.description'), t('app.master-data.plants.status'), t('common.createdAt')];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const row = [
          item.code || '',
          item.name || '',
          item.description || '',
          item.isActive ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '',
        ];
        csvRows.push(row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });

      downloadFile(blob, filename);
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.exportFailed'));
    }
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  const columns: ProColumns<WorkCenter>[] = [
    {
      title: t('field.workCenter.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: t('field.workCenter.name'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('field.workCenter.description'),
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.workCenter.isActive'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            {t('field.customField.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm
            title={t('app.master-data.workCenters.deleteConfirm')}
            description={t('app.master-data.workCenters.deleteDescription')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const detailColumns: ProDescriptionsItemProps<WorkCenter>[] = [
    { title: t('field.workCenter.code'), dataIndex: 'code' },
    { title: t('field.workCenter.name'), dataIndex: 'name' },
    { title: t('field.workCenter.description'), dataIndex: 'description', span: 2 },
    {
      title: t('field.workCenter.workstationIds'),
      dataIndex: 'workstationIds',
      render: (_: React.ReactNode, record: WorkCenter) => {
        const ids = record?.workstationIds ?? [];
        if (ids.length === 0) return '-';
        const labels = ids
          .map((id) => workstationMap[id])
          .filter(Boolean)
          .map((ws) => `${ws.code} - ${ws.name}`);
        return labels.join('；') || '-';
      },
      span: 2,
    },
    {
      title: t('field.workCenter.isActive'),
      dataIndex: 'isActive',
      render: (_: React.ReactNode, record: WorkCenter) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
      span: 2,
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<WorkCenter>
          actionRef={actionRef}
          columns={columns}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          loadingDelay={200}
          request={async (params, _sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
              apiParams.isActive = searchFormValues.isActive;
            }
            if (searchFormValues?.keyword) {
              apiParams.keyword = searchFormValues.keyword;
            }

            try {
              const result = await workCenterApi.list(apiParams);

              return {
                data: result,
                success: true,
                total: result.length,
              };
            } catch (error: any) {
              console.error('获取工作中心列表失败:', error);
              messageApi.error(error?.message || t('app.master-data.workCenters.listFetchFailed'));
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
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              {t('field.workCenter.createTitle')}
            </Button>,
            <Popconfirm
              key="batchDelete"
              title={t('app.master-data.workCenters.batchDeleteConfirm')}
              description={t('app.master-data.workCenters.batchDeleteDescription', { count: selectedRowKeys.length })}
            onConfirm={handleBatchDelete}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
              disabled={selectedRowKeys.length === 0}
            >
              <Button
                type="default"
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
              >
              {t('common.batchDelete')}
            </Button>
            </Popconfirm>,
          ]}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={['*工作中心编码', '*工作中心名称', '描述']}
          importExampleRow={['GZZX0001', '焊接工作中心', '负责焊接工序的产能单元']}
          importFieldMap={{
            '工作中心编码': 'code',
            '*工作中心编码': 'code',
            '编码': 'code',
            '*编码': 'code',
            'code': 'code',
            '*code': 'code',
            '工作中心名称': 'name',
            '*工作中心名称': 'name',
            '名称': 'name',
            '*名称': 'name',
            'name': 'name',
            '*name': 'name',
            '描述': 'description',
            'description': 'description',
          }}
          importFieldRules={{
            code: { required: true },
            name: { required: true },
          }}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate<WorkCenter>
        title={t('field.workCenter.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={workCenterDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      <WorkCenterFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default WorkCentersPage;
