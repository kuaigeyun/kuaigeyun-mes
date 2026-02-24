/**
 * 不良品信息管理页面
 * 
 * 提供不良品信息的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { DefectTypeFormModal } from '../../../components/DefectTypeFormModal';
import { defectTypeApi } from '../../../services/process';
import type { DefectType, DefectTypeCreate } from '../../../types/process';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import { generateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImport } from '../../../../../utils/import';

/**
 * 不良品信息管理列表页面组件
 */
const DefectTypesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [defectTypeDetail, setDefectTypeDetail] = useState<DefectType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑不良品）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: DefectType) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除不良品
   */
  const handleDelete = async (record: DefectType) => {
    try {
      await defectTypeApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除不良品
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await defectTypeApi.delete(key.toString());
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
            messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DefectType) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await defectTypeApi.get(record.uuid);
      setDefectTypeDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.defectTypes.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setDefectTypeDetail(null);
  };

  /**
   * 处理批量导入不良品
   * 启用状态默认启用，创建时间由后端自动生成，导入模板不包含该列
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    // 第1行表头、第2行示例，从第3行开始为数据行（导入组件已保留所有行，不过滤空行）
    const rows = data.slice(2);

    const nonEmptyRows = rows.filter((row: any[]) => {
      if (!row || row.length === 0) return false;
      return row.some((cell: any) => {
        const value = cell != null ? String(cell).trim() : '';
        return value !== '';
      });
    });

    if (nonEmptyRows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }

    const headerMap: Record<string, string> = {
      '不良品编码': 'code', '*不良品编码': 'code', '编码': 'code', '*编码': 'code', code: 'code',
      '不良品名称': 'name', '*不良品名称': 'name', '名称': 'name', '*名称': 'name', name: 'name',
      '分类': 'category', category: 'category',
      '描述': 'description', description: 'description',
    };

    const headerIndexMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalized = String(header || '').trim();
      const key = headerMap[normalized] ?? headerMap[normalized.replace(/^\*+/, '').trim()];
      if (key) headerIndexMap[key] = index;
    });

    const autoCodeEnabled = isAutoGenerateEnabled('master-data-defect-type');
    if (!autoCodeEnabled && headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.defectTypes.code'), headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.defectTypes.name'), headers: headers.join(', ') }));
      return;
    }

    const importData: DefectTypeCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmpty = !row?.length || row.every((c: any) => (c != null ? String(c).trim() : '') === '');
      if (isEmpty) return;
      const actualRowIndex = rowIndex + 3; // 第1行表头、第2行示例，第3行起为数据

      const code = headerIndexMap['code'] !== undefined ? row[headerIndexMap['code']] : undefined;
      const name = row[headerIndexMap['name']];
      const category = headerIndexMap['category'] !== undefined ? row[headerIndexMap['category']] : undefined;
      const description = headerIndexMap['description'] !== undefined ? row[headerIndexMap['description']] : undefined;

      const codeValue = code != null ? String(code).trim() : '';
      const nameValue = name != null ? String(name).trim() : '';
      if (!autoCodeEnabled && !codeValue) {
        errors.push({ row: actualRowIndex, message: t('app.master-data.defectTypes.codeRequired') });
        return;
      }
      if (!nameValue) {
        errors.push({ row: actualRowIndex, message: t('app.master-data.defectTypes.nameRequired') });
        return;
      }

      importData.push({
        code: codeValue ? codeValue.toUpperCase() : '', // 为空且启用自动编码时，导入时再生成
        name: nameValue,
        category: category != null && String(category).trim() !== '' ? String(category).trim() : undefined,
        description: description != null && String(description).trim() !== '' ? String(description).trim() : undefined,
        isActive: true, // 启用状态默认启用，创建时间由后端自动获取
      });
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
                  <Typography.Text type="danger">{t('app.master-data.rowError', { row: item.row, message: item.message })}</Typography.Text>
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

    const ruleCode = getPageRuleCode('master-data-defect-type');
    try {
      const result = await batchImport<DefectTypeCreate>(
        importData.map((item, i) => ({ data: item, rowIndex: i + 3, rawRow: [] })),
        async (item) => {
          let data = { ...item };
          if (!data.code && autoCodeEnabled && ruleCode) {
            const res = await generateCode({ rule_code: ruleCode });
            data = { ...data, code: res.code };
          }
          if (!data.code) {
            throw new Error(t('app.master-data.defectTypes.codeRequiredAuto'));
          }
          return defectTypeApi.create(data);
        },
        { title: t('app.master-data.defectTypes.importTitle') }
      );

      const successCount = result.filter((r) => r.success).length;
      const failureCount = result.filter((r) => !r.success).length;

      if (failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.master-data.importPartialResultIntro', { success: successCount, failure: failureCount })}</strong></p>
              <List
                size="small"
                dataSource={result.filter((r) => !r.success)}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text type="danger">{t('app.master-data.rowError', { row: item.rowIndex, message: item.error?.message ?? item.message })}</Typography.Text>
                  </List.Item>
                )}
              />
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.defectTypes.importSuccess', { count: successCount }));
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DefectType>[] = [
    {
      title: '不良品编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '不良品名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 150,
      hideInSearch: true,
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
        const isActive = record?.isActive ?? false;
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
      render: (_, record) => {
        const val = record.createdAt;
        return val ? (typeof val === 'string' ? new Date(val).toLocaleString() : val) : '-';
      },
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
            title="确定要删除这个不良品信息吗？"
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

  return (
    <ListPageTemplate>
      <UniTable<DefectType>
        actionRef={actionRef}
        columns={columns}
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
          
          // 分类筛选
          if (searchFormValues?.category !== undefined && searchFormValues.category !== '' && searchFormValues.category !== null) {
            apiParams.category = searchFormValues.category;
          }
          
          try {
            const result = await defectTypeApi.list(apiParams);
            const list = result?.data ?? result;
            const data = Array.isArray(list) ? list : [];
            const total = typeof result?.total === 'number' ? result.total : data.length;
            return {
              data,
              success: true,
              total,
            };
          } catch (error: any) {
            console.error('获取不良品列表失败:', error);
            messageApi.error(error?.message || '获取不良品列表失败');
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
            新建不良品
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={['*不良品编码', '*不良品名称', '分类', '描述']}
        importExampleRow={['BL001', '尺寸不良', '外观类', '产品尺寸超差导致不合格']}
        importFieldMap={{
          '不良品编码': 'code', '*不良品编码': 'code', '编码': 'code', 'code': 'code',
          '不良品名称': 'name', '*不良品名称': 'name', '名称': 'name', 'name': 'name',
          '分类': 'category', 'category': 'category',
          '描述': 'description', 'description': 'description',
        }}
      />

      <DetailDrawerTemplate<DefectType>
        title="不良品详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={defectTypeDetail || undefined}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        columns={[
          { title: '不良品编码', dataIndex: 'code' },
          { title: '不良品名称', dataIndex: 'name' },
          { title: '分类', dataIndex: 'category' },
          { title: '描述', dataIndex: 'description', span: 2 },
          {
            title: '启用状态',
            dataIndex: 'isActive',
            render: (_, record) => {
              const isActive = record?.isActive ?? false;
              return (
                <Tag color={isActive ? 'success' : 'default'}>
                  {isActive ? '启用' : '禁用'}
                </Tag>
              );
            },
          },
          { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
        ]}
      />

      <DefectTypeFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </ListPageTemplate>
  );
};

export default DefectTypesPage;
