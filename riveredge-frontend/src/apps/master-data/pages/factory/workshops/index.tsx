/**
 * 车间管理页面
 * 
 * 提供车间的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptionsItemType, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';

// 安全处理 options 的工具函数
const safeOptions = (options: any): any[] => {
  if (Array.isArray(options)) {
    return options;
  }
  console.warn('ProFormSelect options 不是数组:', options);
  return [];
};
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography, Divider } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { workshopApi, plantApi } from '../../../services/factory';
import type { Workshop, WorkshopCreate, WorkshopUpdate, Plant } from '../../../types/factory';
import { batchImport } from '../../../../../utils/batchOperations';
import { generateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getCustomFieldsByTable, getFieldValues, batchSetFieldValues, CustomField } from '../../../../../services/customField';

/**
 * 车间管理列表页面组件
 */
const WorkshopsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();

    const actionRef = useRef<ActionType>(null);
    const formRef = useRef<ProFormInstance>();
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    // Drawer 相关状态（详情查看）
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [currentWorkshopUuid, setCurrentWorkshopUuid] = useState<string | null>(null);
    const [workshopDetail, setWorkshopDetail] = useState<Workshop | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Modal 相关状态（创建/编辑车间）
    const [modalVisible, setModalVisible] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    // 自定义字段相关状态
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

    // 厂区列表状态
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

  /**
   * 处理新建车间
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentWorkshopUuid(null);
    setModalVisible(true);
    setCustomFieldValues({});
    formRef.current?.resetFields();
    
    // 检查是否启用自动编码
    if (isAutoGenerateEnabled('master-data-factory-workshop')) {
      const ruleCode = getPageRuleCode('master-data-factory-workshop');
      if (ruleCode) {
        try {
          const codeResponse = await generateCode({ rule_code: ruleCode });
          formRef.current?.setFieldsValue({
            code: codeResponse.code,
            isActive: true,
          });
        } catch (error: any) {
          console.warn('自动生成编码失败:', error);
          formRef.current?.setFieldsValue({
            isActive: true,
          });
        }
      } else {
        formRef.current?.setFieldsValue({
          isActive: true,
        });
      }
    } else {
      formRef.current?.setFieldsValue({
        isActive: true,
      });
    }
  };

  /**
   * 处理编辑车间
   */
  const handleEdit = async (record: Workshop) => {
    try {
      setIsEdit(true);
      setCurrentWorkshopUuid(record.uuid);
      setModalVisible(true);
      
      // 获取车间详情
      const detail = await workshopApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        description: detail.description,
        plantId: detail.plantId,
        isActive: detail.isActive,
      });
      
      // 加载自定义字段值
      try {
        const fieldValues = await getFieldValues('master_data_factory_workshops', detail.id);
        setCustomFieldValues(fieldValues);
        // 将自定义字段值设置到表单
        Object.keys(fieldValues).forEach(fieldCode => {
          formRef.current?.setFieldValue(`custom_${fieldCode}`, fieldValues[fieldCode]);
        });
      } catch (error) {
        console.error('加载自定义字段值失败:', error);
      }
    } catch (error: any) {
      messageApi.error(error.message || '获取车间详情失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Workshop) => {
    try {
      setCurrentWorkshopUuid(record.uuid);
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
      messageApi.error(error.message || '获取车间详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentWorkshopUuid(null);
    setWorkshopDetail(null);
  };

  /**
   * 处理删除车间
   */
  const handleDelete = async (record: Workshop) => {
    try {
      await workshopApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新车间）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 分离自定义字段值和标准字段值
      const customFieldData: Record<string, any> = {};
      const standardValues: any = {};
      
      Object.keys(values).forEach(key => {
        if (key.startsWith('custom_')) {
          const fieldCode = key.replace('custom_', '');
          customFieldData[fieldCode] = values[key];
        } else {
          standardValues[key] = values[key];
        }
      });
      
      let workshopId: number;
      
      if (isEdit && currentWorkshopUuid) {
        // 更新车间
        const updated = await workshopApi.update(currentWorkshopUuid, standardValues as WorkshopUpdate);
        workshopId = updated.id;
        messageApi.success('更新成功');
      } else {
        // 创建车间
        const created = await workshopApi.create(standardValues as WorkshopCreate);
        workshopId = created.id;
        messageApi.success('创建成功');
      }
      
      // 保存自定义字段值
      if (Object.keys(customFieldData).length > 0) {
        try {
          const fieldValues = Object.keys(customFieldData).map(fieldCode => {
            const field = customFields.find(f => f.code === fieldCode);
            return field ? {
              field_uuid: field.uuid,
              value: customFieldData[fieldCode],
            } : null;
          }).filter(Boolean);
          
          if (fieldValues.length > 0) {
            await batchSetFieldValues({
              record_id: workshopId,
              record_table: 'master_data_factory_workshops',
              values: fieldValues as any[],
            });
          }
        } catch (error) {
          console.error('保存自定义字段值失败:', error);
          // 不阻止表单提交，只记录错误
        }
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      setCustomFieldValues({});
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };
  
  /**
   * 渲染自定义字段表单项
   */
  const renderCustomFields = () => {
    if (customFields.length === 0) return null;
    
    return customFields
      .filter(field => field.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(field => {
        const fieldName = `custom_${field.code}`;
        const label = field.label || field.name;
        const placeholder = field.placeholder || `请输入${label}`;
        
        switch (field.field_type) {
          case 'text':
            return (
              <ProFormText
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                fieldProps={{
                  maxLength: field.config?.maxLength,
                }}
                initialValue={customFieldValues[field.code] || field.config?.default}
              />
            );
          case 'number':
            return (
              <ProFormDigit
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                fieldProps={{
                  min: field.config?.min,
                  max: field.config?.max,
                }}
                initialValue={customFieldValues[field.code] || field.config?.default}
              />
            );
          case 'date':
            return (
              <ProFormDatePicker
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
                fieldProps={{
                  format: field.config?.format || 'YYYY-MM-DD',
                }}
                initialValue={customFieldValues[field.code] || field.config?.default}
              />
            );
          case 'select':
            return (
              <SafeProFormSelect
                key={`${field.uuid}-${JSON.stringify(safeOptions(field.config?.options))}`}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
                options={safeOptions(field.config?.options)}
                initialValue={customFieldValues[field.code] || field.config?.default}
              />
            );
          case 'textarea':
            return (
              <ProFormTextArea
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 24 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                fieldProps={{
                  rows: field.config?.rows || 4,
                }}
                initialValue={customFieldValues[field.code] || field.config?.default}
              />
            );
          default:
            return (
              <ProFormText
                key={field.uuid}
                name={fieldName}
                label={label}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请输入${label}` }] : []}
                initialValue={customFieldValues[field.code] || field.config?.default}
              />
            );
        }
      });
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    formRef.current?.resetFields();
  };

  /**
   * 处理导入数据
   * 
   * 支持从 Excel 导入车间数据，批量创建车间
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning('导入数据为空');
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
      messageApi.warning('没有可导入的数据行（请从第3行开始填写数据，并确保至少有一行非空数据）');
      return;
    }

    // 表头字段映射（支持中英文，支持带*号的必填项标识）
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
      '描述': 'description',
      'description': 'description',
      '启用状态': 'isActive',
      '启用': 'isActive',
      'isActive': 'isActive',
      'is_active': 'isActive',
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
      messageApi.error(`缺少必需字段：车间编码。当前表头：${headers.join(', ')}`);
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(`缺少必需字段：车间名称。当前表头：${headers.join(', ')}`);
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
        const isActiveIndex = headerIndexMap['isActive'];

        // 确保数组有足够的长度
        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: '表头映射错误，无法找到必需字段' });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const isActiveStr = isActiveIndex !== undefined && row[isActiveIndex] !== undefined
          ? String(row[isActiveIndex] || '').trim().toLowerCase()
          : 'true';
        
        // 验证必需字段（去除空白字符后检查）
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: '车间编码不能为空' });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: '车间名称不能为空' });
          return;
        }

        // 转换启用状态
        let isActive = true;
        if (isActiveStr === 'false' || isActiveStr === '0' || isActiveStr === '否' || isActiveStr === '禁用') {
          isActive = false;
        }

        // 构建导入数据
        const workshopData: WorkshopCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          description: description ? String(description).trim() : undefined,
          isActive,
        };

        importData.push(workshopData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || '数据解析失败',
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      Modal.warning({
        title: '数据验证失败',
        width: 600,
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
        importFn: async (item: WorkshopCreate) => {
          return await workshopApi.create(item);
        },
        title: '正在导入车间数据',
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
        messageApi.success(`成功导入 ${result.successCount} 条车间数据`);
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
        render: (_, record) => (
          <Tag color={record.isActive ? 'success' : 'default'}>
            {record.isActive ? '启用' : '禁用'}
          </Tag>
        ),
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
        const plant = plants.find(p => p.id === record.plantId);
        return plant ? plant.name : <Typography.Text type="secondary">-</Typography.Text>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
    },
    {
      title: '所属厂区',
      dataIndex: 'plantId',
      render: (_, record) => {
        const plant = plants.find(p => p.id === record.plantId);
        return plant ? (
          <Typography.Text>{plant.name}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        );
      },
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
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
        onImport={handleImport}
        importHeaders={['车间编码', '车间名称', '描述', '启用状态']}
        importExampleRow={['WS001', '装配车间', '主要负责产品装配作业', '启用']}
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
          '描述': 'description',
          'description': 'description',
          '启用状态': 'isActive',
          '启用': 'isActive',
          'isActive': 'isActive',
          'is_active': 'isActive',
        }}
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

      {/* 创建/编辑车间 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑车间' : '新建车间'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={{
          isActive: true,
        }}
      >
          <ProFormText
            name="code"
            label="车间编码"
            placeholder="请输入车间编码（如启用自动编码，将自动生成）"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入车间编码' },
              { max: 50, message: '车间编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
            extra={
              isAutoGenerateEnabled('master-data-factory-workshop')
                ? '已启用自动编码，编码将根据规则自动生成'
                : undefined
            }
            disabled={!isEdit && isAutoGenerateEnabled('master-data-factory-workshop')}
          />
          <ProFormText
            name="name"
            label="车间名称"
            placeholder="请输入车间名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入车间名称' },
              { max: 200, message: '车间名称不能超过200个字符' },
            ]}
          />
          <SafeProFormSelect
            name="plantId"
            label="所属厂区"
            placeholder="请选择所属厂区（可选）"
            colProps={{ span: 12 }}
            options={plants.map(plant => ({
              label: `${plant.code} - ${plant.name}`,
              value: plant.id,
            }))}
            allowClear
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入描述"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 4,
              maxLength: 500,
            }}
          />
          <ProFormSwitch
            name="isActive"
            label="是否启用"
            colProps={{ span: 12 }}
          />
          
          {/* 自定义字段分割线 */}
          {customFields.length > 0 && (
            <>
              <div style={{ gridColumn: 'span 24', marginTop: 16, marginBottom: 8, width: '100%' }}>
                <Divider style={{ margin: 0, fontSize: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, padding: '0 8px' }}>
                    自定义字段
                  </Typography.Text>
                </Divider>
              </div>
              {renderCustomFields()}
            </>
          )}
      </FormModalTemplate>
    </>
    );
};

export default WorkshopsPage;
