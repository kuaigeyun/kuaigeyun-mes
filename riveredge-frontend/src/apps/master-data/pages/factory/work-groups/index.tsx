import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工作小组页面
 *
 * 提供工作小组的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import { workGroupApi, applyFactoryKeyword, applyFactoryTableSort } from '../../../services/factory';
import { WorkGroupFormModal } from '../../../components/WorkGroupFormModal';
import type { WorkGroup, WorkGroupCreate } from '../../../types/factory';
import { downloadFile } from '../../../../../utils';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';

const WorkGroupsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();

  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: workGroupApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workGroupDetail, setWorkGroupDetail] = useState<WorkGroup | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const workGroupImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.workGroup.code' },
          { field: 'name', required: true, labelKey: 'field.workGroup.name' },
          { field: 'description', labelKey: 'field.workGroup.description' },
        ],
        [
          t('app.master-data.workGroups.importExample.code'),
          t('app.master-data.workGroups.importExample.name'),
          t('app.master-data.workGroups.importExample.description'),
        ],
      ),
    [t, i18n.language],
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: WorkGroup) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleOpenDetail = async (record: WorkGroup) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      const detail = await workGroupApi.get(record.uuid);
      setWorkGroupDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.workGroups.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkGroupDetail(null);
  };

  const handleDelete = async (record: WorkGroup) => {
    try {
      await workGroupApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = targetKeys.map((key) => String(key));
      const result = await workGroupApi.batchDelete(uuids);

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

  const formatMembersSummary = (record: WorkGroup): string => {
    const members = record?.members ?? [];
    if (members.length === 0) return '';
    return members
      .map(
        (m: any) =>
          `${m.employeeName ?? m.employee_name ?? m.employeeId ?? m.employee_id} (${m.performanceWeight ?? m.performance_weight ?? 1})`,
      )
      .join(t('common.listSeparator'));
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

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      workGroupImportTemplate.importHeaderMap,
    );

    if (headerIndexMap['code'] === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: 'code',
          headers: headers.join(', '),
        }),
      );
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: 'name',
          headers: headers.join(', '),
        }),
      );
      return;
    }

    const importData: WorkGroupCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmptyRow =
        !row ||
        row.length === 0 ||
        row.every((cell: any) => {
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
        const description =
          descriptionIndex !== undefined && row[descriptionIndex] !== undefined ? row[descriptionIndex] : undefined;

        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';

        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('field.workGroup.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('field.workGroup.nameRequired') });
          return;
        }

        importData.push({
          code: codeValue.toUpperCase(),
          name: nameValue,
          description: description ? String(description).trim() : undefined,
          isActive: true,
          members: [],
        });
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
        importFn: async (item: WorkGroupCreate) => workGroupApi.create(item),
        title: t('app.master-data.workGroups.importTitle'),
        concurrency: 5,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>
                  {t('app.master-data.importPartialResultIntro', {
                    success: result.successCount,
                    failure: result.failureCount,
                  })}
                </strong>
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
        messageApi.success(t('app.master-data.workGroups.importSuccess', { count: result.successCount }));
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
    selectedKeys?: React.Key[],
    currentPageData?: WorkGroup[],
  ) => {
    try {
      let exportData: WorkGroup[] = [];
      let filename = '';

      if (type === 'selected' && selectedKeys && selectedKeys.length > 0) {
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter((item) => selectedKeys.includes(item.uuid));
        filename = `${t('app.master-data.workGroups.exportFilenameSelected', {
          date: new Date().toISOString().slice(0, 10),
        })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        exportData = currentPageData;
        filename = `${t('app.master-data.workGroups.exportFilenameCurrentPage', {
          date: new Date().toISOString().slice(0, 10),
        })}.csv`;
      } else {
        const allData = await workGroupApi.list({ skip: 0, limit: 10000 });
        exportData = allData.items;
        filename = `${t('app.master-data.workGroups.exportFilenameAll', {
          date: new Date().toISOString().slice(0, 10),
        })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      const headers = [
        t('field.workGroup.code'),
        t('field.workGroup.name'),
        t('field.workGroup.description'),
        t('field.workGroup.members'),
        t('app.master-data.plants.status'),
        t('common.createdAt'),
      ];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const row = [
          item.code || '',
          item.name || '',
          item.description || '',
          formatMembersSummary(item),
          item.isActive ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? new Date(item.createdAt).toLocaleString(i18n.language) : '',
        ];
        csvRows.push(
          row.map((cell) => {
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(','),
        );
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

  const columns: ProColumns<WorkGroup>[] = React.useMemo(() => [
    {
      title: t('field.workGroup.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
      sorter: true,
    },
    {
      title: t('field.workGroup.name'),
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      sorter: true,
    },
    {
      title: t('field.workGroup.members'),
      dataIndex: 'members',
      width: 280,
      ellipsis: true,
      hideInSearch: true,
      render: (_: React.ReactNode, record: WorkGroup) => {
        const text = formatMembersSummary(record);
        return text ? text : '-';
      },
    },
    {
      title: t('field.workGroup.description'),
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.workGroup.isActive'),
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
          <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
            {t('field.customField.view')}
          </Button>
          <Button key="edit" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.customField.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.workGroups.deleteConfirm')}
            description={t('app.master-data.workGroups.deleteDescription')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('field.customField.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [t]);

  const detailColumns: ProDescriptionsItemProps<WorkGroup>[] = [
    { title: t('field.workGroup.code'), dataIndex: 'code' },
    { title: t('field.workGroup.name'), dataIndex: 'name' },
    { title: t('field.workGroup.description'), dataIndex: 'description' },
    {
      title: t('field.workGroup.members'),
      dataIndex: 'members',
      render: (_: React.ReactNode, record: WorkGroup) => {
        const members = record?.members ?? [];
        if (members.length === 0) return '-';
        return (
          <div>
            {members.map((m: any, i: number) => (
              <div key={i}>
                {m.employeeName ?? m.employee_name ?? m.employeeId ?? m.employee_id} -{' '}
                {t('field.workGroup.performanceWeight')}: {m.performanceWeight ?? m.performance_weight ?? 1}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: t('field.workGroup.isActive'),
      dataIndex: 'isActive',
      render: (_: React.ReactNode, record: WorkGroup) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<WorkGroup>
          columnPersistenceId="apps.master-data.pages.factory.work-groups"
          actionRef={actionRef}
          columns={columns}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          loadingDelay={200}
          request={async (params, sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            if (
              searchFormValues?.isActive !== undefined &&
              searchFormValues.isActive !== '' &&
              searchFormValues.isActive !== null
            ) {
              apiParams.is_active = searchFormValues.isActive;
            }
            applyFactoryKeyword(apiParams, searchFormValues);
            applyFactoryTableSort(apiParams, sort);

            try {
              const result = await workGroupApi.list(apiParams);

              return {
                data: result.items,
                success: true,
                total: result.total,
              };
            } catch (error: any) {
              console.error('获取工作小组列表失败:', error);
              messageApi.error(error?.message || t('app.master-data.workGroups.listFetchFailed'));
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
          createButtonText={t('field.workGroup.createTitle') + NEW_SHORTCUT_HINT}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={t('app.master-data.workGroups.batchDeleteConfirm')}
          deleteConfirmDescription={(count) =>
            t('app.master-data.workGroups.batchDeleteDescription', { count })
          }
          toolBarActionsAfterDelete={[
            <MasterDataBatchActiveMenuButton
              menuKey="work-groups-batch-active"
              selectedRowKeys={selectedRowKeys}
              menuItems={batchActiveMenuItems}
            />,
          ]}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={workGroupImportTemplate.importHeaders}
          importExampleRow={workGroupImportTemplate.importExampleRow}
          importFieldMap={workGroupImportTemplate.importHeaderMap}
          importFieldRules={{
            code: { required: true },
            name: { required: true },
          }}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t('field.workGroup.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={workGroupDetail ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, workGroupDetail)} />
          ) : undefined}
      />

      <WorkGroupFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditUuid(null);
        }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default WorkGroupsPage;
