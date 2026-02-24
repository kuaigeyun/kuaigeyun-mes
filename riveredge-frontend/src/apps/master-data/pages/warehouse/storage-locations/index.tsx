/**
 * 库位管理页面
 * 
 * 提供库位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
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
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除库位
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const toDelete = keys ?? selectedRowKeys;
    if (toDelete.length === 0) {
      messageApi.warning('请至少选择一条记录');
      return;
    }

    try {
      const uuids = toDelete.map(key => String(key));
      const result = await storageLocationApi.batchDelete(uuids);
      
      if (result.success) {
        messageApi.success(result.message || '批量删除成功');
        setSelectedRowKeys([]);
      } else {
        messageApi.warning(result.message || '部分删除失败');
      }
      
      // 清空选择
      setSelectedRowKeys([]);
      // 刷新列表
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '批量删除失败');
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
      messageApi.warning('导入数据为空');
      return;
    }

    // 如果库区列表为空，提示用户先创建库区
    if (storageAreas.length === 0) {
      Modal.warning({
        title: '无法导入',
        content: '当前没有可用的库区数据，请先创建库区后再导入库位数据。',
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
      messageApi.warning('没有可导入的数据行（请从第3行开始填写数据，并确保至少有一行非空数据）');
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
      messageApi.error(`缺少必需字段：库位编码。当前表头：${headers.join(', ')}`);
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(`缺少必需字段：库位名称。当前表头：${headers.join(', ')}`);
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
          errors.push({ row: actualRowIndex, message: '表头映射错误，无法找到必需字段' });
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
          errors.push({ row: actualRowIndex, message: '库位编码不能为空' });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: '库位名称不能为空' });
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
                message: `库区编码 "${storageAreaCodeValue}" 不存在，请检查库区编码是否正确` 
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
                message: `库区名称 "${storageAreaNameValue}" 不存在，请检查库区名称是否正确` 
              });
              return;
            }
          }
        } else {
          errors.push({ 
            row: actualRowIndex, 
            message: '所属库区不能为空' 
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
          message: error.message || '数据解析失败',
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasStorageAreaError = errors.some(e => e.message.includes('库区'));
      
      Modal.warning({
        title: '数据验证失败',
        width: 700,
        content: (
          <div>
            <p>以下数据行存在错误，请修正后重新导入：</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">
                    第 {item.row} 行：{item.message}
                  </Typography.Text>
                </List.Item>
              )}
            />
            {hasStorageAreaError && storageAreas.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  当前可用的库区列表：
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
                  提示：所属库区列可以填写库区编码（如：{storageAreas[0]?.code}）或库区名称（如：{storageAreas[0]?.name}）
                </Typography.Text>
              </div>
            )}
          </div>
        ),
      });
      return;
    }

    if (importData.length === 0) {
      messageApi.warning('没有可导入的数据行（所有行都为空）');
      return;
    }

    // 批量导入
    try {
      const result = await batchImport({
        items: importData,
        importFn: async (item: StorageLocationCreate) => {
          return await storageLocationApi.create(item);
        },
        title: '正在导入库位数据',
        concurrency: 5,
      });

      // 显示导入结果
      if (result.failureCount > 0) {
        Modal.warning({
          title: '导入完成（部分失败）',
          width: 600,
          content: (
            <div>
              <p>
                <strong>导入结果：</strong>成功 {result.successCount} 条，失败 {result.failureCount} 条
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(item) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        第 {item.row} 行：{item.error}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(`成功导入 ${result.successCount} 条库位数据`);
      }

      // 刷新列表
      if (result.successCount > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || '导入失败');
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
          messageApi.warning('无法获取选中数据，请重试');
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `库位数据_选中_${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `库位数据_当前页_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        // 导出全部数据
        const allData = await storageLocationApi.list({ skip: 0, limit: 10000 });
        exportData = allData;
        filename = `库位数据_全部_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning('没有可导出的数据');
        return;
      }

      // 构建 CSV 内容
      const headers = ['库位编码', '库位名称', '所属库区', '描述', '状态', '创建时间'];
      const rows = exportData.map(item => {
        const storageArea = storageAreas.find(s => s.id === item.storageAreaId);
        return [
          item.code || '',
          item.name || '',
          storageArea ? `${storageArea.code}(${storageArea.name})` : '',
          item.description || '',
          (item.isActive ?? (item as any).is_active) ? '启用' : '禁用',
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
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
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
      messageApi.error(error.message || '获取库位详情失败');
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
    return storageArea ? `${storageArea.code} - ${storageArea.name}` : `库区ID: ${storageAreaId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<StorageLocation>[] = [
    {
      title: '库位编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: '库位名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '所属库区',
      dataIndex: 'storageAreaId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getStorageAreaName(record?.storageAreaId),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
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
        return (
          <Tag color={record?.isActive ? 'success' : 'default'}>
            {record?.isActive ? '启用' : '禁用'}
          </Tag>
        );
      },
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
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            详情
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
            title="确定要删除这个库位吗？"
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
      ),
    },
  ];

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<StorageLocation>[] = [
    {
      title: '库位编码',
      dataIndex: 'code',
    },
    {
      title: '库位名称',
      dataIndex: 'name',
    },
    {
      title: '所属库区',
      dataIndex: 'storageAreaId',
      render: (_, record) => getStorageAreaName(record?.storageAreaId),
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      render: (_, record) => {
        return (
          <Tag color={record?.isActive ? 'success' : 'default'}>
            {record?.isActive ? '启用' : '禁用'}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
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
            messageApi.error(error?.message || '获取库位列表失败');
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
        createButtonText="新建储位"
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={(keys) => {
          if (keys.length === 0) return;
          Modal.confirm({
            title: '确定要批量删除选中的储位吗？',
            content: `将删除 ${keys.length} 个储位，删除后无法恢复，请谨慎操作。`,
            okText: '确定',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => await handleBatchDelete(keys),
          });
        }}
        deleteButtonText="批量删除"
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<StorageLocation>
        title="库位详情"
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
