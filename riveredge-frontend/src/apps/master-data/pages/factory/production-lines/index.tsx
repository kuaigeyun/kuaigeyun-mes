/**
 * 产线管理页面
 * 
 * 提供产线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { productionLineApi, workshopApi } from '../../../services/factory';
import { ProductionLineFormModal } from '../../../components/ProductionLineFormModal';
import type { ProductionLine, ProductionLineCreate, Workshop } from '../../../types/factory';
import { batchImport } from '../../../../../utils/batchOperations';

/**
 * 产线管理列表页面组件
 */
const ProductionLinesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentProductionLineUuid, setCurrentProductionLineUuid] = useState<string | null>(null);
  const [productionLineDetail, setProductionLineDetail] = useState<ProductionLine | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑产线）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  
  // 车间列表（用于导入等）
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  useEffect(() => {
    const loadWorkshops = async () => {
      try {
        const result = await workshopApi.list({ limit: 1000, isActive: true });
        setWorkshops(result);
      } catch (error: any) {
        console.error('加载车间列表失败:', error);
      }
    };
    loadWorkshops();
  }, []);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: ProductionLine) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除产线
   */
  const handleDelete = async (record: ProductionLine) => {
    try {
      await productionLineApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除产线
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = selectedRowKeys.map(key => String(key));
      const result = await productionLineApi.batchDelete(uuids);
      
      if (result.success) {
        messageApi.success(result.message || t('app.master-data.batchDeleteSuccess'));
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
   * 支持从 Excel 导入产线数据，批量创建产线
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   * 
   * 所属车间字段说明：
   * - 可以填写车间编码（如：WS001）或车间名称（如：装配车间）
   * - 系统会根据编码或名称自动匹配对应的车间
   * - 如果车间不存在，导入会失败并提示错误
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果车间列表为空，提示用户先创建车间
    if (workshops.length === 0) {
      Modal.warning({
        title: t('app.master-data.importDisabled'),
        content: t('app.master-data.importNoWorkshop'),
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
      '产线编码': 'code',
      '*产线编码': 'code',
      '编码': 'code',
      '*编码': 'code',
      'code': 'code',
      '*code': 'code',
      '产线名称': 'name',
      '*产线名称': 'name',
      '名称': 'name',
      '*名称': 'name',
      'name': 'name',
      '*name': 'name',
      '所属车间': 'workshopCode',
      '车间': 'workshopCode',
      '车间编码': 'workshopCode',
      '车间名称': 'workshopName',
      'workshopCode': 'workshopCode',
      'workshop_code': 'workshopCode',
      'workshopName': 'workshopName',
      'workshop_name': 'workshopName',
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
      messageApi.error(t('app.master-data.importMissingField', { field: '产线编码', headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: '产线名称', headers: headers.join(', ') }));
      return;
    }

    // 解析数据行
    const importData: ProductionLineCreate[] = [];
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
        const workshopCodeIndex = headerIndexMap['workshopCode'];
        const workshopNameIndex = headerIndexMap['workshopName'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: '表头映射错误，无法找到必需字段' });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const workshopCode = workshopCodeIndex !== undefined && row[workshopCodeIndex] !== undefined
          ? row[workshopCodeIndex]
          : undefined;
        const workshopName = workshopNameIndex !== undefined && row[workshopNameIndex] !== undefined
          ? row[workshopNameIndex]
          : undefined;
        
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: '产线编码不能为空' });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: '产线名称不能为空' });
          return;
        }

        // 处理所属车间（根据车间编码或名称查找 workshopId）
        let workshopId: number | undefined = undefined;
        if (workshopCode || workshopName) {
          const workshopCodeValue = workshopCode ? String(workshopCode).trim().toUpperCase() : '';
          const workshopNameValue = workshopName ? String(workshopName).trim() : '';
          
          // 优先通过编码查找
          if (workshopCodeValue) {
            const foundWorkshop = workshops.find(w => w.code.toUpperCase() === workshopCodeValue);
            if (foundWorkshop) {
              workshopId = foundWorkshop.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: `车间编码 "${workshopCodeValue}" 不存在，请检查车间编码是否正确` 
              });
              return;
            }
          } 
          // 如果编码未找到，尝试通过名称查找
          else if (workshopNameValue) {
            const foundWorkshop = workshops.find(w => w.name === workshopNameValue);
            if (foundWorkshop) {
              workshopId = foundWorkshop.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: `车间名称 "${workshopNameValue}" 不存在，请检查车间名称是否正确` 
              });
              return;
            }
          }
        } else {
          errors.push({ 
            row: actualRowIndex, 
            message: '所属车间不能为空' 
          });
          return;
        }

        // 构建导入数据
        const productionLineData: ProductionLineCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          workshopId: workshopId!,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(productionLineData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || '数据解析失败',
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasWorkshopError = errors.some(e => e.message.includes('车间'));
      
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
            {hasWorkshopError && workshops.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  当前可用的车间列表：
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {workshops.map(workshop => (
                    <li key={workshop.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{workshop.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {workshop.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  提示：所属车间列可以填写车间编码（如：{workshops[0]?.code}）或车间名称（如：{workshops[0]?.name}）
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
        importFn: async (item: ProductionLineCreate) => {
          return await productionLineApi.create(item);
        },
        title: '正在导入产线数据',
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
   * 处理批量导出产线
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: ProductionLine[]
  ) => {
    try {
      let exportData: ProductionLine[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `产线数据_选中_${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `产线数据_当前页_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        // 导出全部数据
        const allData = await productionLineApi.list({ skip: 0, limit: 10000 });
        exportData = allData;
        filename = `产线数据_全部_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = ['产线编码', '产线名称', '所属车间', '描述', '状态', '创建时间'];
      const rows = exportData.map(item => {
        const workshop = workshops.find(w => w.id === item.workshopId);
        return [
          item.code || '',
          item.name || '',
          workshop ? `${workshop.code}(${workshop.name})` : '',
          item.description || '',
          item.isActive ? '启用' : '禁用',
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
  const handleOpenDetail = async (record: ProductionLine) => {
    try {
      setCurrentProductionLineUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await productionLineApi.get(record.uuid);
      setProductionLineDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.productionLines.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentProductionLineUuid(null);
    setProductionLineDetail(null);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ProductionLine>[] = [
    {
      title: '产线编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: '产线名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '所属车间',
      dataIndex: 'workshopId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getWorkshopName(record?.workshopId ?? (record as any)?.workshop_id),
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
        const isActive = record?.isActive;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? '启用' : '禁用'}
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
            title="确定要删除这条产线吗？"
            description="删除产线前需要检查是否有关联的工位"
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
   * 获取车间名称
   */
  const getWorkshopName = (workshopId?: number): string => {
    if (!workshopId) return '-';
    const workshop = workshops.find(w => w.id === workshopId);
    return workshop ? `${workshop.code} - ${workshop.name}` : '-';
  };

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<ProductionLine>[] = [
    {
      title: '产线编码',
      dataIndex: 'code',
    },
    {
      title: '产线名称',
      dataIndex: 'name',
    },
    {
      title: '所属车间',
      dataIndex: 'workshopId',
      render: (_, record) => getWorkshopName(record?.workshopId ?? (record as any)?.workshop_id),
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
        const isActive = record?.isActive;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? '启用' : '禁用'}
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
        <UniTable<ProductionLine>
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
          
          // 车间筛选
          if (searchFormValues?.workshopId !== undefined && searchFormValues.workshopId !== '' && searchFormValues.workshopId !== null) {
            apiParams.workshopId = searchFormValues.workshopId;
          }
          
          try {
            const result = await productionLineApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
            };
          } catch (error: any) {
            console.error('获取产线列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.productionLines.getListFailed'));
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
        importHeaders={['*产线编码', '*产线名称', '*所属车间', '描述']}
        importExampleRow={[
          'PL001', 
          '产线1', 
          workshops.length > 0 ? workshops[0].code : 'WS001', 
          '主要负责产品生产'
        ]}
        importFieldMap={{
          '产线编码': 'code',
          '*产线编码': 'code',
          '编码': 'code',
          '*编码': 'code',
          'code': 'code',
          '*code': 'code',
          '产线名称': 'name',
          '*产线名称': 'name',
          '名称': 'name',
          '*名称': 'name',
          'name': 'name',
          '*name': 'name',
          '所属车间': 'workshopCode',
          '车间': 'workshopCode',
          '车间编码': 'workshopCode',
          '车间名称': 'workshopName',
          'workshopCode': 'workshopCode',
          'workshop_code': 'workshopCode',
          'workshopName': 'workshopName',
          'workshop_name': 'workshopName',
          '描述': 'description',
          'description': 'description',
        }}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
          workshopCode: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
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
            新建产线
          </Button>,
          <Popconfirm
            key="batchDelete"
            title="确定要批量删除选中的产线吗？"
            description={`将删除 ${selectedRowKeys.length} 个产线，删除后无法恢复，请谨慎操作。`}
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              type="default"
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
            >
              批量删除
            </Button>
          </Popconfirm>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<ProductionLine>
        title="产线详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={productionLineDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑产线 Modal */}
      <ProductionLineFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default ProductionLinesPage;
