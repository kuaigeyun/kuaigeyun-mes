/**
 * 厂区管理页面
 * 
 * 提供厂区的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { plantApi } from '../../../services/factory';
import type { Plant, PlantCreate, PlantUpdate } from '../../../types/factory';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../kuaizhizao/services/common';

/**
 * 厂区管理列表页面组件
 */
const PlantsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();

  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑厂区）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [currentPlantUuid, setCurrentPlantUuid] = useState<string | null>(null);
  // 保存预览编码，用于在提交时判断是否需要正式生成
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [plantDetail, setPlantDetail] = useState<Plant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建厂区
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentPlantUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    
    // 检查是否启用自动编码
    if (isAutoGenerateEnabled('master-data-factory-plant')) {
      const ruleCode = getPageRuleCode('master-data-factory-plant');
      if (ruleCode) {
        try {
          // 使用测试生成（不更新序号），仅用于预览
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const previewCodeValue = codeResponse.code;
          setPreviewCode(previewCodeValue);
          formRef.current?.setFieldsValue({
            code: previewCodeValue,
          });
        } catch (error: any) {
          console.warn('自动生成编码失败:', error);
          setPreviewCode(null);
        }
      }
    } else {
      setPreviewCode(null);
    }
  };

  /**
   * 处理编辑厂区
   */
  const handleEdit = async (record: Plant) => {
    setIsEdit(true);
    setCurrentPlantUuid(record.uuid);
    setModalVisible(true);
    
    // 加载厂区详情
    try {
      const detail = await plantApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        description: detail.description,
        address: detail.address,
        isActive: detail.isActive ?? (detail as any).is_active ?? true,
      });
    } catch (error: any) {
      messageApi.error(error.message || '加载厂区详情失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Plant) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      const detail = await plantApi.get(record.uuid);
      setPlantDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取厂区详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setPlantDetail(null);
  };

  /**
   * 处理删除厂区
   */
  const handleDelete = async (record: Plant) => {
    try {
      await plantApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除厂区
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一条记录');
      return;
    }

    try {
      const uuids = selectedRowKeys.map(key => String(key));
      const result = await plantApi.batchDelete(uuids);
      
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
   * 处理批量导入厂区
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
    // 注意：不包含 isActive 和 createdAt，这些字段使用默认值
    const headerMap: Record<string, string> = {
      '厂区编码': 'code',
      '*厂区编码': 'code',
      '编码': 'code',
      '*编码': 'code',
      'code': 'code',
      '*code': 'code',
      '厂区名称': 'name',
      '*厂区名称': 'name',
      '名称': 'name',
      '*名称': 'name',
      'name': 'name',
      '*name': 'name',
      '地址': 'address',
      'address': 'address',
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
      messageApi.error(`缺少必需字段：厂区编码。当前表头：${headers.join(', ')}`);
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(`缺少必需字段：厂区名称。当前表头：${headers.join(', ')}`);
      return;
    }

    // 解析数据行（使用已过滤的非空行）
    const importData: PlantCreate[] = [];
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
        const addressIndex = headerIndexMap['address'];
        const descriptionIndex = headerIndexMap['description'];

        // 确保数组有足够的长度
        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: '表头映射错误，无法找到必需字段' });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const address = addressIndex !== undefined && row[addressIndex] !== undefined
          ? row[addressIndex]
          : undefined;
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        
        // 验证必需字段（去除空白字符后检查）
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: '厂区编码不能为空' });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: '厂区名称不能为空' });
          return;
        }

        // 构建导入数据（isActive 使用默认值 true，不导入）
        const plantData: PlantCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          address: address ? String(address).trim() : undefined,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(plantData);
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
        importFn: async (item: PlantCreate) => {
          return await plantApi.create(item);
        },
        title: '正在导入厂区数据',
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
        messageApi.success(`成功导入 ${result.successCount} 条厂区数据`);
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
   * 处理批量导出厂区
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Plant[]
  ) => {
    try {
      let exportData: Plant[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning('无法获取选中数据，请重试');
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `厂区数据_选中_${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `厂区数据_当前页_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        // 导出全部数据
        const allData = await plantApi.list({ skip: 0, limit: 10000 });
        exportData = allData;
        filename = `厂区数据_全部_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning('没有可导出的数据');
        return;
      }

      // 构建 CSV 内容
      const headers = ['厂区编码', '厂区名称', '地址', '描述', '状态', '创建时间'];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const row = [
          item.code || '',
          item.name || '',
          item.address || '',
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
      messageApi.success(`成功导出 ${exportData.length} 条数据`);
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };

  /**
   * 处理提交表单（创建/更新厂区）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPlantUuid) {
        // 更新厂区
        await plantApi.update(currentPlantUuid, values as PlantUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建厂区
        // 如果是新建且编码与预览编码匹配，需要正式生成编码（更新序号）
        if (!isEdit && isAutoGenerateEnabled('master-data-factory-plant')) {
          const ruleCode = getPageRuleCode('master-data-factory-plant');
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
        
        await plantApi.create(values as PlantCreate);
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
   * 表格列定义
   */
  const columns: ProColumns<Plant>[] = [
    {
      title: '厂区编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
    },
    {
      title: '厂区名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '地址',
      dataIndex: 'address',
      width: 300,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '状态',
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
            title="确定要删除这个厂区吗？"
            description="删除后无法恢复，请谨慎操作。"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
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
  const detailColumns: ProDescriptionsItemType<Plant>[] = [
    { title: '厂区编码', dataIndex: 'code' },
    { title: '厂区名称', dataIndex: 'name' },
    { title: '地址', dataIndex: 'address', span: 2 },
    { title: '描述', dataIndex: 'description', span: 2 },
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
    { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Plant>
          actionRef={actionRef}
          columns={columns}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          loadingDelay={200}
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
              const result = await plantApi.list(apiParams);
              
              return {
                data: result,
                success: true,
                total: result.length, // 注意：后端需要返回总数，这里暂时使用数组长度
              };
            } catch (error: any) {
              console.error('获取厂区列表失败:', error);
              messageApi.error(error?.message || '获取厂区列表失败');
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
              新建厂区
            </Button>,
            <Popconfirm
              key="batchDelete"
              title="确定要批量删除选中的厂区吗？"
              description={`将删除 ${selectedRowKeys.length} 个厂区，删除后无法恢复，请谨慎操作。`}
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
          showImportButton={true}
          onImport={handleImport}
          importHeaders={['*厂区编码', '*厂区名称', '地址', '描述']}
          importExampleRow={['PLANT001', '无锡生产基地', '江苏省无锡市新吴区太湖国际科技园', '主要生产电子产品的生产基地，占地面积约50000平方米']}
          importFieldMap={{
            '厂区编码': 'code',
            '*厂区编码': 'code',
            '编码': 'code',
            '*编码': 'code',
            'code': 'code',
            '*code': 'code',
            '厂区名称': 'name',
            '*厂区名称': 'name',
            '名称': 'name',
            '*名称': 'name',
            'name': 'name',
            '*name': 'name',
            '地址': 'address',
            'address': 'address',
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

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<Plant>
        title="厂区详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={plantDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑厂区 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑厂区' : '新建厂区'}
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
          label="厂区编码"
          placeholder="请输入厂区编码"
          rules={[
            { required: true, message: '请输入厂区编码' },
            { max: 50, message: '厂区编码不能超过50个字符' },
          ]}
          fieldProps={{
            disabled: isEdit, // 编辑时不允许修改编码
          }}
        />
        <ProFormText
          name="name"
          label="厂区名称"
          placeholder="请输入厂区名称"
          rules={[
            { required: true, message: '请输入厂区名称' },
            { max: 200, message: '厂区名称不能超过200个字符' },
          ]}
        />
        <ProFormText
          name="address"
          label="地址"
          placeholder="请输入厂区地址"
          rules={[
            { max: 500, message: '地址不能超过500个字符' },
          ]}
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
        <ProFormSwitch
          name="isActive"
          label="是否启用"
        />
      </FormModalTemplate>
    </>
  );
};

export default PlantsPage;
