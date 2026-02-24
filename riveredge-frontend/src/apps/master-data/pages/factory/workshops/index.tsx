/**
 * 车间管理页面
 * 
 * 提供车间的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemType, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { WorkshopFormModal } from '../../../components/WorkshopFormModal';
import { workshopApi, plantApi } from '../../../services/factory';
import type { Workshop, WorkshopCreate, Plant } from '../../../types/factory';
import { batchImport } from '../../../../../utils/batchOperations';
import { getCustomFieldsByTable, getFieldValues, CustomField } from '../../../../../services/customField';

/**
 * 车间管理列表页面组件
 */
const WorkshopsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

    const actionRef = useRef<ActionType>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [drawerVisible, setDrawerVisible] = useState(false);
    const [workshopDetail, setWorkshopDetail] = useState<Workshop | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [editUuid, setEditUuid] = useState<string | null>(null);

    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
    const [plants, setPlants] = useState<Plant[]>([]);

  /**
   * 加载自定义字段
   */
  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        const fields = await getCustomFieldsByTable('master_data_factory_workshops', true).catch((error) => {
          // 如果是401错误，静默忽略（token可能在其他地方被验证）
          if (error?.response?.status === 401) {
            console.warn('⚠️ 自定义字段加载失败（401），跳过加载');
            return [];
          }
          throw error; // 其他错误重新抛出
        });
        setCustomFields(fields);
      } catch (error) {
        console.error('加载自定义字段失败:', error);
      }
    };
    loadCustomFields();
  }, []);

  /**
   * 加载厂区列表
   */
  useEffect(() => {
    const loadPlants = async () => {
      try {
        const plantList = await plantApi.list({ isActive: true });
        setPlants(plantList);
      } catch (error) {
        console.error('加载厂区列表失败:', error);
      }
    };
    loadPlants();
  }, []);

  /**
   * 当自定义字段加载完成后，刷新表格以显示自定义字段列
   */
  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      // 延迟刷新，确保列定义已更新
      setTimeout(() => {
        actionRef.current?.reload();
      }, 200);
    }
  }, [customFields.length]);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Workshop) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Workshop) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await workshopApi.get(record.uuid);
      setWorkshopDetail(detail);
      
      // 加载自定义字段值
      try {
        const fieldValues = await getFieldValues('master_data_factory_workshops', detail.id);
        setCustomFieldValues(fieldValues);
      } catch (error) {
        console.error('加载自定义字段值失败:', error);
        setCustomFieldValues({});
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.workshops.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkshopDetail(null);
  };

  /**
   * 处理删除车间
   */
  const handleDelete = async (record: Workshop) => {
    try {
      await workshopApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除车间
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = selectedRowKeys.map(key => String(key));
      const result = await workshopApi.batchDelete(uuids);
      
      if (result.success) {
        messageApi.success(result.message || '批量删除成功');
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
   * 支持从 Excel 导入车间数据，批量创建车间
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   * 
   * 所属厂区字段说明：
   * - 可以填写厂区编码（如：PLANT001）或厂区名称（如：无锡生产基地）
   * - 系统会根据编码或名称自动匹配对应的厂区
   * - 如果厂区不存在，导入会失败并提示错误
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果厂区列表为空，提示用户先创建厂区
    if (plants.length === 0) {
      Modal.warning({
        title: '无法导入',
        content: '当前没有可用的厂区数据，请先创建厂区后再导入车间数据。',
      });
      return;
    }

    // 解析表头和数据
    // 第1行（索引0）：表头
    // 第2行（索引1）：示例数据（跳过）
    // 从第3行开始（索引2）：实际数据行
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2); // 跳过表头和示例数据行，从第3行开始

    // 过滤空行（所有单元格都为空或只包含空白字符的行）
    const nonEmptyRows = rows.filter((row: any[]) => {
      if (!row || row.length === 0) return false;
      // 检查行中是否有任何非空单元格
      return row.some((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value !== '';
      });
    });

    if (nonEmptyRows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }

    // 表头字段映射（支持中英文，支持带*号的必填项标识）
    // 注意：不包含 isActive 和 createdAt，这些字段使用默认值
    const headerMap: Record<string, string> = {
      '车间编码': 'code',
      '*车间编码': 'code',
      '编码': 'code',
      '*编码': 'code',
      'code': 'code',
      '*code': 'code',
      '车间名称': 'name',
      '*车间名称': 'name',
      '名称': 'name',
      '*名称': 'name',
      'name': 'name',
      '*name': 'name',
      '所属厂区': 'plantCode',
      '厂区': 'plantCode',
      '厂区编码': 'plantCode',
      '厂区名称': 'plantName',
      'plantCode': 'plantCode',
      'plant_code': 'plantCode',
      'plantName': 'plantName',
      'plant_name': 'plantName',
      '描述': 'description',
      'description': 'description',
    };

    // 找到表头索引（支持去除空格和特殊字符）
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      // 去除空格、星号等特殊字符进行匹配
      const normalizedHeader = String(header || '').trim();
      // 直接匹配
      if (headerMap[normalizedHeader]) {
        headerIndexMap[headerMap[normalizedHeader]] = index;
      } else {
        // 尝试去除星号后匹配
        const withoutStar = normalizedHeader.replace(/^\*+/, '').trim();
        if (headerMap[withoutStar]) {
          headerIndexMap[headerMap[withoutStar]] = index;
        }
      }
    });

    // 验证必需字段
    if (headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.workshops.code'), headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.workshops.name'), headers: headers.join(', ') }));
      return;
    }

    // 解析数据行（使用已过滤的非空行）
    const importData: WorkshopCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      // 再次检查是否为空行（双重保险）
      const isEmptyRow = !row || row.length === 0 || row.every((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value === '';
      });

      if (isEmptyRow) {
        return; // 跳过空行
      }

      // 计算实际 Excel 行号（需要考虑原始数据中的行号）
      // 由于我们已经过滤了空行，需要找到这一行在原始数据中的位置
      let actualRowIndex = rowIndex + 3; // 默认行号（表头+示例+数据起始）
      // 尝试从原始数据中找到对应的行号
      for (let i = 2; i < data.length; i++) {
        if (data[i] === row) {
          actualRowIndex = i + 1; // Excel 行号从1开始
          break;
        }
      }

      try {
        // 提取字段值（确保数组索引有效）
        const codeIndex = headerIndexMap['code'];
        const nameIndex = headerIndexMap['name'];
        const descriptionIndex = headerIndexMap['description'];
        const plantCodeIndex = headerIndexMap['plantCode'];
        const plantNameIndex = headerIndexMap['plantName'];

        // 确保数组有足够的长度
        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const plantCode = plantCodeIndex !== undefined && row[plantCodeIndex] !== undefined
          ? row[plantCodeIndex]
          : undefined;
        const plantName = plantNameIndex !== undefined && row[plantNameIndex] !== undefined
          ? row[plantNameIndex]
          : undefined;
        
        // 验证必需字段（去除空白字符后检查）
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.workshops.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.workshops.nameRequired') });
          return;
        }

        // 处理所属厂区（根据厂区编码或名称查找 plantId）
        let plantId: number | undefined = undefined;
        if (plantCode || plantName) {
          const plantCodeValue = plantCode ? String(plantCode).trim().toUpperCase() : '';
          const plantNameValue = plantName ? String(plantName).trim() : '';
          
          // 优先通过编码查找
          if (plantCodeValue) {
            const foundPlant = plants.find(p => p.code.toUpperCase() === plantCodeValue);
            if (foundPlant) {
              plantId = foundPlant.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: t('app.master-data.plantCodeNotFound', { code: plantCodeValue }) 
              });
              return;
            }
          } 
          // 如果编码未找到，尝试通过名称查找
          else if (plantNameValue) {
            const foundPlant = plants.find(p => p.name === plantNameValue);
            if (foundPlant) {
              plantId = foundPlant.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: t('app.master-data.plantNameNotFound', { name: plantNameValue }) 
              });
              return;
            }
          }
        }

        // 构建导入数据（isActive 使用默认值 true，不导入）
        const workshopData: WorkshopCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          plantId: plantId,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(workshopData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      // 检查是否有厂区相关的错误
      const hasPlantError = errors.some(e => e.message.includes('厂区'));
      
      Modal.warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 700,
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
            {hasPlantError && plants.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.master-data.availablePlantsList')}
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {plants.map(plant => (
                    <li key={plant.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{plant.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {plant.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  {t('app.master-data.plantImportHint', { code: plants[0]?.code || '', name: plants[0]?.name || '' })}
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
        importFn: async (item: WorkshopCreate) => {
          return await workshopApi.create(item);
        },
        title: t('app.master-data.workshops.importTitle'),
        concurrency: 5,
      });

      // 显示导入结果
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
        messageApi.success(t('app.master-data.workshops.importSuccess', { count: result.successCount }));
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
   * 处理批量导出车间
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Workshop[]
  ) => {
    try {
      let exportData: Workshop[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `车间数据_选中_${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `车间数据_当前页_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        // 导出全部数据
        const allData = await workshopApi.list({ skip: 0, limit: 10000 });
        exportData = allData;
        filename = `车间数据_全部_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = ['车间编码', '车间名称', '所属厂区', '描述', '状态', '创建时间'];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const plant = plants.find(p => p.id === item.plantId);
        const row = [
          item.code || '',
          item.name || '',
          plant ? plant.name : '',
          item.description || '',
          (item.isActive ?? (item as any).is_active) ? '启用' : '禁用',
          item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '',
        ];
        // 处理包含逗号、引号或换行符的字段
        csvRows.push(row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // 添加 BOM 以支持 Excel 正确显示中文
      
      downloadFile(blob, filename);
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.exportFailed'));
    }
  };

  /**
   * 生成自定义字段列
   */
  const generateCustomFieldColumns = (): ProColumns<Workshop>[] => {
    return customFields
      .filter(field => field.is_active) // 只显示启用的自定义字段
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(field => ({
        title: field.label || field.name,
        dataIndex: `custom_${field.code}`,
        width: 150,
        hideInSearch: !field.is_searchable,
        sorter: field.is_sortable,
        render: (value: any) => {
          if (value === null || value === undefined || value === '') {
            return <Typography.Text type="secondary">-</Typography.Text>;
          }
          // 根据字段类型格式化显示
          if (field.field_type === 'date' && value) {
            return new Date(value).toLocaleDateString('zh-CN');
          }
          if (field.field_type === 'datetime' && value) {
            return new Date(value).toLocaleString('zh-CN');
          }
          if (field.field_type === 'select' && field.config?.options && Array.isArray(field.config.options)) {
            const option = field.config.options.find((opt: any) => opt.value === value);
            return option ? option.label : String(value);
          }
          return String(value);
        },
      }));
  };

  /**
   * 表格列定义（使用 useMemo 确保 customFields 和 plants 变化时重新计算）
   */
  const columns: ProColumns<Workshop>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    const fixedColumns = [
      {
        title: '车间编码',
        dataIndex: 'code',
        width: 150,
        fixed: 'left' as const,
        ellipsis: true,
        copyable: true,
      },
      {
        title: '车间名称',
        dataIndex: 'name',
        width: 200,
      },
      {
        title: '所属厂区',
        dataIndex: 'plantId',
        width: 150,
        valueType: 'select',
        valueEnum: plants.reduce((acc, plant) => {
          acc[plant.id] = { text: plant.name };
          return acc;
        }, {} as Record<number, { text: string }>),
        render: (_, record) => {
          const plant = plants.find(p => p.id === record.plantId);
          return plant ? plant.name : <Typography.Text type="secondary">-</Typography.Text>;
        },
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
          const isActive = record?.isActive ?? (record as any)?.is_active;
          return (
            <Tag color={isActive ? 'success' : 'default'}>
              {isActive ? '启用' : '禁用'}
            </Tag>
          );
        },
      },
      // 插入自定义字段列
      ...customFieldColumns,
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
        fixed: 'right' as const,
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
              title="确定要删除这个车间吗？"
              description="删除车间前需要检查是否有关联的产线"
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

    return fixedColumns;
  }, [customFields, plants]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemType<Workshop>[] = [
    {
      title: '车间编码',
      dataIndex: 'code',
    },
    {
      title: '车间名称',
      dataIndex: 'name',
    },
    {
      title: '所属厂区',
      dataIndex: 'plantId',
      render: (_, record) => {
        const plant = plants.find(p => p.id === (record?.plantId ?? (record as any)?.plant_id));
        return plant ? plant.name : <Typography.Text type="secondary">-</Typography.Text>;
      },
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
        const isActive = record?.isActive ?? (record as any)?.is_active;
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

  /**
   * 详情 Drawer 的自定义内容（包含自定义字段）
   */
  const renderDetailContent = () => {
    if (!workshopDetail) return null;

    return (
      <>
        <ProDescriptions<Workshop>
          dataSource={workshopDetail}
          loading={detailLoading}
          column={2}
          columns={detailColumns}
        />
        
        {/* 自定义字段 */}
        {customFields.length > 0 && Object.keys(customFieldValues).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <Typography.Title level={5}>自定义字段</Typography.Title>
            <ProDescriptions
              column={2}
              dataSource={customFieldValues}
              columns={customFields
                .filter(field => field.is_active && customFieldValues[field.code] !== undefined)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(field => ({
                  title: field.label || field.name,
                  dataIndex: field.code,
                  render: (value: any) => {
                    if (value === null || value === undefined || value === '') {
                      return <Typography.Text type="secondary">-</Typography.Text>;
                    }
                    return String(value);
                  },
                }))}
            />
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable<Workshop>
        actionRef={actionRef}
        columns={columns}
        viewTypes={['table', 'help']}
        defaultViewType="table"
        onImport={handleImport}
        importHeaders={['*车间编码', '*车间名称', '所属厂区', '描述']}
        importExampleRow={[
          'WS001', 
          '装配车间', 
          plants.length > 0 ? plants[0].code : 'PLANT001', 
          '主要负责产品装配作业'
        ]}
        importFieldMap={{
          '车间编码': 'code',
          '*车间编码': 'code',
          '编码': 'code',
          '*编码': 'code',
          'code': 'code',
          '*code': 'code',
          '车间名称': 'name',
          '*车间名称': 'name',
          '名称': 'name',
          '*名称': 'name',
          'name': 'name',
          '*name': 'name',
          '所属厂区': 'plantCode',
          '厂区': 'plantCode',
          '厂区编码': 'plantCode',
          '厂区名称': 'plantName',
          'plantCode': 'plantCode',
          'plant_code': 'plantCode',
          'plantName': 'plantName',
          'plant_name': 'plantName',
          '描述': 'description',
          'description': 'description',
        }}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
        request={async (params, _sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };

          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }

          try {
            const result = await workshopApi.list(apiParams);
            
            // 批量加载自定义字段值
            if (customFields.length > 0 && result.length > 0) {
              try {
                // 为每条记录加载自定义字段值
                const recordsWithCustomFields = await Promise.all(
                  result.map(async (record: Workshop) => {
                    try {
                      const fieldValues = await getFieldValues('master_data_factory_workshops', record.id);
                      // 将自定义字段值合并到记录中
                      const recordWithCustomFields: any = { ...record };
                      Object.keys(fieldValues).forEach(fieldCode => {
                        recordWithCustomFields[`custom_${fieldCode}`] = fieldValues[fieldCode];
                      });
                      return recordWithCustomFields;
                    } catch (error) {
                      console.error(`加载记录 ${record.id} 的自定义字段值失败:`, error);
                      return record;
                    }
                  })
                );
                
                return {
                  data: recordsWithCustomFields,
                  success: true,
                  total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
                };
              } catch (error) {
                console.error('批量加载自定义字段值失败:', error);
                // 如果加载失败，返回原始数据
                return {
                  data: result,
                  success: true,
                  total: result.length,
                };
              }
            }
            
            return {
              data: result,
              success: true,
              total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
            };
          } catch (error: any) {
            console.error('获取车间列表失败:', error);
            messageApi.error(error?.message || '获取车间列表失败');
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
            新建车间
          </Button>,
          <Popconfirm
            key="batchDelete"
            title="确定要批量删除选中的车间吗？"
            description={`将删除 ${selectedRowKeys.length} 个车间，删除后无法恢复，请谨慎操作。`}
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
      <DetailDrawerTemplate<Workshop>
        title="车间详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={workshopDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        customContent={renderDetailContent()}
      />

      <WorkshopFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
    );
};

export default WorkshopsPage;
