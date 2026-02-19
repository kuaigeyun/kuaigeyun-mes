/**
 * 工位管理页面
 * 
 * 提供工位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptionsItemType } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { workstationApi, productionLineApi } from '../../../services/factory';
import type { Workstation, WorkstationCreate, WorkstationUpdate, ProductionLine } from '../../../types/factory';
import { batchImport } from '../../../../../utils/batchOperations';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';

/**
 * 工位管理列表页面组件
 */
const WorkstationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentWorkstationUuid, setCurrentWorkstationUuid] = useState<string | null>(null);
  const [workstationDetail, setWorkstationDetail] = useState<Workstation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工位）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  // 保存预览编码，用于在提交时判断是否需要正式生成
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  
  // 产线列表（用于下拉选择）
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [productionLinesLoading, setProductionLinesLoading] = useState(false);

  /**
   * 加载产线列表
   */
  useEffect(() => {
    const loadProductionLines = async () => {
      try {
        setProductionLinesLoading(true);
        const result = await productionLineApi.list({ limit: 1000, isActive: true });
        setProductionLines(result);
      } catch (error: any) {
        console.error('加载产线列表失败:', error);
      } finally {
        setProductionLinesLoading(false);
      }
    };
    loadProductionLines();
  }, []);

  /**
   * 处理新建工位
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentWorkstationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    
    // 检查是否启用自动编码
    if (isAutoGenerateEnabled('master-data-factory-workstation')) {
      const ruleCode = getPageRuleCode('master-data-factory-workstation');
      if (ruleCode) {
        try {
          // 使用测试生成（不更新序号），仅用于预览
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const previewCodeValue = codeResponse.code;
          setPreviewCode(previewCodeValue);
          formRef.current?.setFieldsValue({
            code: previewCodeValue,
            isActive: true,
          });
        } catch (error: any) {
          console.warn('自动生成编码失败:', error);
          setPreviewCode(null);
          formRef.current?.setFieldsValue({
            isActive: true,
          });
        }
      } else {
        setPreviewCode(null);
        formRef.current?.setFieldsValue({
          isActive: true,
        });
      }
    } else {
      setPreviewCode(null);
      formRef.current?.setFieldsValue({
        isActive: true,
      });
    }
  };

  /**
   * 处理编辑工位
   */
  const handleEdit = async (record: Workstation) => {
    try {
      setIsEdit(true);
      setCurrentWorkstationUuid(record.uuid);
      setModalVisible(true);
      
      // 获取工位详情
      const detail = await workstationApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        productionLineId: detail.productionLineId,
        description: detail.description,
        isActive: detail.isActive ?? (detail as any).is_active ?? true,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取工位详情失败');
    }
  };

  /**
   * 处理删除工位
   */
  const handleDelete = async (record: Workstation) => {
    try {
      await workstationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除工位
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一条记录');
      return;
    }

    try {
      const uuids = selectedRowKeys.map(key => String(key));
      const result = await workstationApi.batchDelete(uuids);
      
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
   * 支持从 Excel 导入工位数据，批量创建工位
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   * 
   * 所属产线字段说明：
   * - 可以填写产线编码（如：PL001）或产线名称（如：产线1）
   * - 系统会根据编码或名称自动匹配对应的产线
   * - 如果产线不存在，导入会失败并提示错误
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning('导入数据为空');
      return;
    }

    // 如果产线列表为空，提示用户先创建产线
    if (productionLines.length === 0) {
      Modal.warning({
        title: '无法导入',
        content: '当前没有可用的产线数据，请先创建产线后再导入工位数据。',
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
      '工位编码': 'code',
      '*工位编码': 'code',
      '编码': 'code',
      '*编码': 'code',
      'code': 'code',
      '*code': 'code',
      '工位名称': 'name',
      '*工位名称': 'name',
      '名称': 'name',
      '*名称': 'name',
      'name': 'name',
      '*name': 'name',
      '所属产线': 'productionLineCode',
      '产线': 'productionLineCode',
      '产线编码': 'productionLineCode',
      '产线名称': 'productionLineName',
      'productionLineCode': 'productionLineCode',
      'production_line_code': 'productionLineCode',
      'productionLineName': 'productionLineName',
      'production_line_name': 'productionLineName',
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
      messageApi.error(`缺少必需字段：工位编码。当前表头：${headers.join(', ')}`);
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(`缺少必需字段：工位名称。当前表头：${headers.join(', ')}`);
      return;
    }

    // 解析数据行
    const importData: WorkstationCreate[] = [];
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
        const productionLineCodeIndex = headerIndexMap['productionLineCode'];
        const productionLineNameIndex = headerIndexMap['productionLineName'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: '表头映射错误，无法找到必需字段' });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const productionLineCode = productionLineCodeIndex !== undefined && row[productionLineCodeIndex] !== undefined
          ? row[productionLineCodeIndex]
          : undefined;
        const productionLineName = productionLineNameIndex !== undefined && row[productionLineNameIndex] !== undefined
          ? row[productionLineNameIndex]
          : undefined;
        
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: '工位编码不能为空' });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: '工位名称不能为空' });
          return;
        }

        // 处理所属产线（根据产线编码或名称查找 productionLineId）
        let productionLineId: number | undefined = undefined;
        if (productionLineCode || productionLineName) {
          const productionLineCodeValue = productionLineCode ? String(productionLineCode).trim().toUpperCase() : '';
          const productionLineNameValue = productionLineName ? String(productionLineName).trim() : '';
          
          // 优先通过编码查找
          if (productionLineCodeValue) {
            const foundProductionLine = productionLines.find(p => p.code.toUpperCase() === productionLineCodeValue);
            if (foundProductionLine) {
              productionLineId = foundProductionLine.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: `产线编码 "${productionLineCodeValue}" 不存在，请检查产线编码是否正确` 
              });
              return;
            }
          } 
          // 如果编码未找到，尝试通过名称查找
          else if (productionLineNameValue) {
            const foundProductionLine = productionLines.find(p => p.name === productionLineNameValue);
            if (foundProductionLine) {
              productionLineId = foundProductionLine.id;
            } else {
              errors.push({ 
                row: actualRowIndex, 
                message: `产线名称 "${productionLineNameValue}" 不存在，请检查产线名称是否正确` 
              });
              return;
            }
          }
        } else {
          errors.push({ 
            row: actualRowIndex, 
            message: '所属产线不能为空' 
          });
          return;
        }

        // 构建导入数据
        const workstationData: WorkstationCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          productionLineId: productionLineId!,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(workstationData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || '数据解析失败',
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasProductionLineError = errors.some(e => e.message.includes('产线'));
      
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
            {hasProductionLineError && productionLines.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  当前可用的产线列表：
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {productionLines.map(productionLine => (
                    <li key={productionLine.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{productionLine.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {productionLine.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  提示：所属产线列可以填写产线编码（如：{productionLines[0]?.code}）或产线名称（如：{productionLines[0]?.name}）
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
        importFn: async (item: WorkstationCreate) => {
          return await workstationApi.create(item);
        },
        title: '正在导入工位数据',
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
        messageApi.success(`成功导入 ${result.successCount} 条工位数据`);
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
   * 处理批量导出工位
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Workstation[]
  ) => {
    try {
      let exportData: Workstation[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning('无法获取选中数据，请重试');
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `工位数据_选中_${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `工位数据_当前页_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        // 导出全部数据
        const allData = await workstationApi.list({ skip: 0, limit: 10000 });
        exportData = allData;
        filename = `工位数据_全部_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning('没有可导出的数据');
        return;
      }

      // 构建 CSV 内容
      const headers = ['工位编码', '工位名称', '所属产线', '描述', '状态', '创建时间'];
      const rows = exportData.map(item => {
        const productionLine = productionLines.find(p => p.id === item.productionLineId);
        return [
          item.code || '',
          item.name || '',
          productionLine ? `${productionLine.code}(${productionLine.name})` : '',
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
  const handleOpenDetail = async (record: Workstation) => {
    try {
      setCurrentWorkstationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await workstationApi.get(record.uuid);
      setWorkstationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工位详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentWorkstationUuid(null);
    setWorkstationDetail(null);
  };

  /**
   * 处理提交表单（创建/更新工位）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentWorkstationUuid) {
        // 更新工位
        await workstationApi.update(currentWorkstationUuid, values as WorkstationUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建工位
        // 如果是新建且编码与预览编码匹配，需要正式生成编码（更新序号）
        if (!isEdit && isAutoGenerateEnabled('master-data-factory-workstation')) {
          const ruleCode = getPageRuleCode('master-data-factory-workstation');
          const currentCode = values.code;
          
          // 如果编码与预览编码匹配，或者编码为空，则正式生成编码
          if (ruleCode && (currentCode === previewCode || !currentCode)) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.code = codeResponse.code;
            } catch (error: any) {
              console.warn('正式生成编码失败，使用预览编码:', error);
              // 如果正式生成失败，继续使用预览编码（虽然序号未更新，但至少可以保存）
            }
          }
        }
        
        await workstationApi.create(values as WorkstationCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      setPreviewCode(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setPreviewCode(null);
    formRef.current?.resetFields();
  };

  /**
   * 获取产线名称
   */
  const getProductionLineName = (productionLineId: number): string => {
    const productionLine = productionLines.find(p => p.id === productionLineId);
    return productionLine ? `${productionLine.code} - ${productionLine.name}` : `产线ID: ${productionLineId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Workstation>[] = [
    {
      title: '工位编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: '工位名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '所属产线',
      dataIndex: 'productionLineId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getProductionLineName(record?.productionLineId ?? (record as any)?.production_line_id),
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
            title="确定要删除这个工位吗？"
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
  const detailColumns: ProDescriptionsItemType<Workstation>[] = [
    {
      title: '工位编码',
      dataIndex: 'code',
    },
    {
      title: '工位名称',
      dataIndex: 'name',
    },
    {
      title: '所属产线',
      dataIndex: 'productionLineId',
      render: (_, record) => getProductionLineName(record?.productionLineId ?? (record as any)?.production_line_id),
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      render: (_, record) => {
        const isActive = record?.isActive ?? (record as any)?.is_active;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? '启用' : '禁用'}
          </Tag>
        );
      },
      span: 2,
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
        <UniTable<Workstation>
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
          
          // 产线筛选
          if (searchFormValues?.productionLineId !== undefined && searchFormValues.productionLineId !== '' && searchFormValues.productionLineId !== null) {
            apiParams.productionLineId = searchFormValues.productionLineId;
          }
          
          try {
            const result = await workstationApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
            };
          } catch (error: any) {
            console.error('获取工位列表失败:', error);
            messageApi.error(error?.message || '获取工位列表失败');
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
        importHeaders={['*工位编码', '*工位名称', '*所属产线', '描述']}
        importExampleRow={[
          'ST001', 
          '工位1', 
          productionLines.length > 0 ? productionLines[0].code : 'PL001', 
          '主要负责产品加工'
        ]}
        importFieldMap={{
          '工位编码': 'code',
          '*工位编码': 'code',
          '编码': 'code',
          '*编码': 'code',
          'code': 'code',
          '*code': 'code',
          '工位名称': 'name',
          '*工位名称': 'name',
          '名称': 'name',
          '*名称': 'name',
          'name': 'name',
          '*name': 'name',
          '所属产线': 'productionLineCode',
          '产线': 'productionLineCode',
          '产线编码': 'productionLineCode',
          '产线名称': 'productionLineName',
          'productionLineCode': 'productionLineCode',
          'production_line_code': 'productionLineCode',
          'productionLineName': 'productionLineName',
          'production_line_name': 'productionLineName',
          '描述': 'description',
          'description': 'description',
        }}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
          productionLineCode: { required: true },
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
            新建工位
          </Button>,
          <Popconfirm
            key="batchDelete"
            title="确定要批量删除选中的工位吗？"
            description={`将删除 ${selectedRowKeys.length} 个工位，删除后无法恢复，请谨慎操作。`}
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
      <DetailDrawerTemplate<Workstation>
        title="工位详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={workstationDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑工位 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑工位' : '新建工位'}
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
          label="工位编码"
          placeholder="请输入工位编码"
          rules={[
            { required: true, message: '请输入工位编码' },
            { max: 50, message: '工位编码不能超过50个字符' },
          ]}
          fieldProps={{
            disabled: isEdit, // 编辑时不允许修改编码
          }}
        />
        <ProFormText
          name="name"
          label="工位名称"
          placeholder="请输入工位名称"
          rules={[
            { required: true, message: '请输入工位名称' },
            { max: 200, message: '工位名称不能超过200个字符' },
          ]}
        />
        <SafeProFormSelect
          name="productionLineId"
          label="所属产线"
          placeholder="请选择产线"
          options={productionLines.map(p => ({
            label: `${p.code} - ${p.name}`,
            value: p.id,
          }))}
          rules={[
            { required: true, message: '请选择产线' },
          ]}
          fieldProps={{
            loading: productionLinesLoading,
            showSearch: true,
            filterOption: (input, option) => {
              const label = option?.label as string || '';
              return label.toLowerCase().includes(input.toLowerCase());
            },
          }}
        />
        <ProFormSwitch
          name="isActive"
          label="是否启用"
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述信息"
          fieldProps={{
            rows: 4,
            maxLength: 1000,
          }}
        />
      </FormModalTemplate>
    </>
  );
};

export default WorkstationsPage;
