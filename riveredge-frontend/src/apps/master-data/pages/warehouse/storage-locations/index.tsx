/**
 * 库位管理页面
 * 
 * 提供库位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { storageLocationApi, storageAreaApi } from '../../../services/warehouse';
import { StorageLocationFormModal } from '../../../components/StorageLocationFormModal';
import type { StorageLocation, StorageLocationCreate, StorageArea } from '../../../types/warehouse';
import { batchImport } from '../../../../../utils/batchOperations';

/**
 * 库位管理列表页面组件
 */
const StorageLocationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentStorageLocationUuid, setCurrentStorageLocationUuid] = useState<string | null>(null);
  const [storageLocationDetail, setStorageLocationDetail] = useState<StorageLocation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑库位）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  
  // 库区列表（用于导入等）
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);

  useEffect(() => {
    const loadStorageAreas = async () => {
      try {
        const result = await storageAreaApi.list({ limit: 1000, isActive: true });
        setStorageAreas(result);
      } catch (error: any) {
        console.error('加载库区列表失败:', error);
      }
    };
    loadStorageAreas();
  }, []);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: StorageLocation) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除库位
   */
  const handleDelete = async (record: StorageLocation) => {
    try {
      await storageLocationApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除库位
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const toDelete = keys ?? selectedRowKeys;
    if (toDelete.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = toDelete.map(key => String(key));
      const result = await storageLocationApi.batchDelete(uuids);
      
      if (result.success) {
        messageApi.success(result.message || t('app.master-data.batchDeleteSuccess'));
        setSelectedRowKeys([]);
      } else {
        messageApi.warning(result.message || t('app.master-data.batchDeletePartial'));
      }
      
      // 清空选择
      setSelectedRowKeys([]);
      // 刷新列表
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  /**
   * 处理导入数据
   * 
   * 支持从 Excel 导入库位数据，批量创建库位
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   * 
   * 所属库区字段说明：
   * - 可以填写库区编码（如：SA001）或库区名称（如：A区）
   * - 系统会根据编码或名称自动匹配对应的库区
   * - 如果库区不存在，导入会失败并提示错误
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果库区列表为空，提示用户先创建库区
    if (storageAreas.length === 0) {
      Modal.warning({
        title: t('app.master-data.importDisabled'),
        content: t('app.master-data.importNoStorageArea'),
      });
      return;
    }

    // 解析表头和数据
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2); // 跳过表头和示例数据行

    // 过滤空行
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

    // 表头字段映射（不包含 isActive 和 createdAt，这些字段使用默认值）
    const headerMap: Record<string, string> = {
      '库位编码': 'code',
      '*库位编码': 'code',
      '编码': 'code',
      '*编码': 'code',
      'code': 'code',
      '*code': 'code',
      '库位名称': 'name',
      '*库位名称': 'name',
      '名称': 'name',
      '*名称': 'name',
      'name': 'name',
      '*name': 'name',
      '所属库区': 'storageAreaCode',
      '库区': 'storageAreaCode',
      '库区编码': 'storageAreaCode',
      '库区名称': 'storageAreaName',
      'storageAreaCode': 'storageAreaCode',
      'storage_area_code': 'storageAreaCode',
      'storageAreaName': 'storageAreaName',
      'storage_area_name': 'storageAreaName',
      '描述': 'description',
      'description': 'description',
    };

    // 找到表头索引
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

    // 验证必需字段
    if (headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.storageLocations.code'), headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.storageLocations.name'), headers: headers.join(', ') }));
      return;
    }

    // 解析数据行
    const importData: StorageLocationCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmptyRow = !row || row.length === 0 || row.every((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value === '';
      });

      if (isEmptyRow) {
        return;
      }

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
        const storageAreaCodeIndex = headerIndexMap['storageAreaCode'];
        const storageAreaNameIndex = headerIndexMap['storageAreaName'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.warehouses.headerMapError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const storageAreaCode = storageAreaCodeIndex !== undefined && row[storageAreaCodeIndex] !== undefined
          ? row[storageAreaCodeIndex]
          : undefined;
        const storageAreaName = storageAreaNameIndex !== undefined && row[storageAreaNameIndex] !== undefined
          ? row[storageAreaNameIndex]
          : undefined;
        
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.storageLocations.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.storageLocations.nameRequired') });
          return;
        }

        // 处理所属库区（根据库区编码或名称查找 storageAreaId）
        let storageAreaId: number | undefined = undefined;
        if (storageAreaCode || storageAreaName) {
          const storageAreaCodeValue = storageAreaCode ? String(storageAreaCode).trim().toUpperCase() : '';
          const storageAreaNameValue = storageAreaName ? String(storageAreaName).trim() : '';
          
          // 优先通过编码查找
          if (storageAreaCodeValue) {
            const foundStorageArea = storageAreas.find(s => s.code.toUpperCase() === storageAreaCodeValue);
            if (foundStorageArea) {
              storageAreaId = foundStorageArea.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: t('app.master-data.storageLocations.storageAreaCodeNotExist', { value: storageAreaCodeValue }) 
              });
              return;
            }
          } 
          // 如果编码未找到，尝试通过名称查找
          else if (storageAreaNameValue) {
            const foundStorageArea = storageAreas.find(s => s.name === storageAreaNameValue);
            if (foundStorageArea) {
              storageAreaId = foundStorageArea.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: t('app.master-data.storageLocations.storageAreaNameNotExist', { value: storageAreaNameValue }) 
              });
              return;
            }
          }
        } else {
          errors.push({ 
            row: actualRowIndex, 
            message: t('app.master-data.storageLocations.storageAreaRequired') 
          });
          return;
        }

        // 构建导入数据
        const storageLocationData: StorageLocationCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          storageAreaId: storageAreaId!,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(storageLocationData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.warehouses.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasStorageAreaError = errors.some(e => e.message.includes('库区') || e.message.includes('Storage area'));
      
      Modal.warning({
        title: t('app.master-data.warehouses.importValidationFailed'),
        width: 700,
        content: (
          <div>
            <p>{t('app.master-data.warehouses.importValidationIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.warehouses.rowError', { row: item.row, message: item.message })}
                  </Typography.Text>
                </List.Item>
              )}
            />
            {hasStorageAreaError && storageAreas.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.master-data.storageLocations.availableStorageAreaList')}
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {storageAreas.map(storageArea => (
                    <li key={storageArea.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{storageArea.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {storageArea.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  {t('app.master-data.storageLocations.importTip', { code: storageAreas[0]?.code || '', name: storageAreas[0]?.name || '' })}
                </Typography.Text>
              </div>
            )}
          </div>
        ),
      });
      return;
    }

    if (importData.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }

    // 批量导入
    try {
      const result = await batchImport({
        items: importData,
        importFn: async (item: StorageLocationCreate) => {
          return await storageLocationApi.create(item);
        },
        title: t('app.master-data.storageLocations.importTitle'),
        concurrency: 5,
      });

      // 显示导入结果
      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.warehouses.importPartialFailure'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>{t('app.master-data.warehouses.importResult', { success: result.successCount, failure: result.failureCount })}</strong>
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(item) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.master-data.warehouses.rowError', { row: item.row, message: item.error })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      }

      // 刷新列表
      if (result.successCount > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.importFailed'));
    }
  };

  /**
   * 处理批量导出库位
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: StorageLocation[]
  ) => {
    try {
      let exportData: StorageLocation[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = t('app.master-data.storageLocations.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) });
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = t('app.master-data.storageLocations.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) });
      } else {
        // 导出全部数据
        const allData = await storageLocationApi.list({ skip: 0, limit: 10000 });
        exportData = allData;
        filename = t('app.master-data.storageLocations.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) });
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.storageLocations.code'), t('app.master-data.storageLocations.name'), t('app.master-data.storageLocations.storageArea'), t('app.master-data.warehouses.description'), t('app.master-data.warehouses.status'), t('app.master-data.warehouses.createTime')];
      const rows = exportData.map(item => {
        const storageArea = storageAreas.find(s => s.id === item.storageAreaId);
        return [
          item.code || '',
          item.name || '',
          storageArea ? `${storageArea.code}(${storageArea.name})` : '',
          item.description || '',
          (item.isActive ?? (item as any).is_active) ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '',
        ];
      });

      // 生成 CSV 内容
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // 下载文件
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
      messageApi.success(t('app.master-data.exportSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.exportFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: StorageLocation) => {
    try {
      setCurrentStorageLocationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await storageLocationApi.get(record.uuid);
      setStorageLocationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.storageLocations.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentStorageLocationUuid(null);
    setStorageLocationDetail(null);
  };

  /**
   * 获取库区名称
   */
  const getStorageAreaName = (storageAreaId: number): string => {
    const storageArea = storageAreas.find(s => s.id === storageAreaId);
    return storageArea ? `${storageArea.code} - ${storageArea.name}` : `${t('app.master-data.storageLocations.storageAreaIdPrefix')}: ${storageAreaId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<StorageLocation>[] = [
    {
      title: t('app.master-data.storageLocations.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: t('app.master-data.storageLocations.name'),
      dataIndex: 'name',
      width: 200,
    },
    {
      title: t('app.master-data.storageLocations.storageArea'),
      dataIndex: 'storageAreaId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getStorageAreaName(record?.storageAreaId),
    },
    {
      title: t('app.master-data.warehouses.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) => {
        return (
          <Tag color={record?.isActive ? 'success' : 'default'}>
            {record?.isActive ? t('common.enabled') : t('common.disabled')}
          </Tag>
        );
      },
    },
    {
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.warehouses.action'),
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
            title={t('app.master-data.storageLocations.deleteConfirm')}
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

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<StorageLocation>[] = [
    {
      title: t('app.master-data.storageLocations.code'),
      dataIndex: 'code',
    },
    {
      title: t('app.master-data.storageLocations.name'),
      dataIndex: 'name',
    },
    {
      title: t('app.master-data.storageLocations.storageArea'),
      dataIndex: 'storageAreaId',
      render: (_, record) => getStorageAreaName(record?.storageAreaId),
    },
    {
      title: t('app.master-data.warehouses.description'),
      dataIndex: 'description',
      span: 2,
    },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      render: (_, record) => {
        return (
          <Tag color={record?.isActive ? 'success' : 'default'}>
            {record?.isActive ? t('common.enabled') : t('common.disabled')}
          </Tag>
        );
      },
    },
    {
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.warehouses.updateTime'),
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<StorageLocation>
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
          
          // 库区筛选
          if (searchFormValues?.storageAreaId !== undefined && searchFormValues.storageAreaId !== '' && searchFormValues.storageAreaId !== null) {
            apiParams.storageAreaId = searchFormValues.storageAreaId;
          }
          
          try {
            const result = await storageLocationApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取库位列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.storageLocations.getListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        viewTypes={['table', 'help']}
        defaultViewType="table"
        showImportButton={true}
        onImport={handleImport}
        importHeaders={['*库位编码', '*库位名称', '*所属库区', '描述']}
        importExampleRow={[
          'SL001', 
          'A-01-01', 
          storageAreas.length > 0 ? storageAreas[0].code : 'SA001', 
          'A区第1排第1列'
        ]}
        importFieldMap={{
          '库位编码': 'code',
          '*库位编码': 'code',
          '编码': 'code',
          '*编码': 'code',
          'code': 'code',
          '*code': 'code',
          '库位名称': 'name',
          '*库位名称': 'name',
          '名称': 'name',
          '*名称': 'name',
          'name': 'name',
          '*name': 'name',
          '所属库区': 'storageAreaCode',
          '库区': 'storageAreaCode',
          '库区编码': 'storageAreaCode',
          '库区名称': 'storageAreaName',
          'storageAreaCode': 'storageAreaCode',
          'storage_area_code': 'storageAreaCode',
          'storageAreaName': 'storageAreaName',
          'storage_area_name': 'storageAreaName',
          '描述': 'description',
          'description': 'description',
        }}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
          storageAreaCode: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
        showAdvancedSearch={true}
        showCreateButton
        createButtonText={t('app.master-data.storageLocations.create')}
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={(keys) => {
          if (keys.length === 0) return;
          Modal.confirm({
            title: t('app.master-data.storageLocations.batchDeleteTitle'),
            content: t('app.master-data.storageLocations.batchDeleteDescription', { count: keys.length }),
            okText: t('common.confirm'),
            cancelText: t('common.cancel'),
            okType: 'danger',
            onOk: async () => await handleBatchDelete(keys),
          });
        }}
        deleteButtonText={t('common.batchDelete')}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<StorageLocation>
        title={t('app.master-data.storageLocations.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={storageLocationDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑库位 Modal */}
      <StorageLocationFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default StorageLocationsPage;
