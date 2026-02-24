/**
 * 工序信息管理页面
 * 
 * 提供工序信息的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Card, Modal } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { EditOutlined, DeleteOutlined, PlusOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { OperationFormModal } from '../../../components/OperationFormModal';
import { operationApi } from '../../../services/process';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import { qrcodeApi } from '../../../../../services/qrcode';
import type { Operation, DefectTypeMinimal } from '../../../types/process';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import dayjs from 'dayjs';

/**
 * 工序信息管理列表页面组件
 */
const OperationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [operationDetail, setOperationDetail] = useState<Operation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  useEffect(() => {
    const operationUuid = searchParams.get('operationUuid');
    const action = searchParams.get('action');
    if (operationUuid && action === 'detail') {
      handleOpenDetail({ uuid: operationUuid } as Operation);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Operation) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除工序
   */
  const handleDelete = async (record: Operation) => {
    try {
      await operationApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除工序
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('app.master-data.operations.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
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
              await operationApi.delete(key.toString());
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
  const handleOpenDetail = async (record: Operation) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await operationApi.get(record.uuid);
      setOperationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.operations.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.operations.selectForQRCode'));
      return;
    }

    try {
      // 通过API获取选中的工序数据
      const operations = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await operationApi.get(key as string);
          } catch (error) {
            console.error(`获取工序失败: ${key}`, error);
            return null;
          }
        })
      );
      
      const validOperations = operations.filter((op) => op !== null) as Operation[];

      if (validOperations.length === 0) {
        messageApi.error(t('app.master-data.operations.getSelectedFailed'));
        return;
      }

      // 生成二维码
      const qrcodePromises = validOperations.map((operation) =>
        qrcodeApi.generateOperation({
          operation_uuid: operation.uuid,
          operation_code: operation.code || '',
          operation_name: operation.name || '',
        })
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(t('app.master-data.operations.qrCodeGenerated', { count: qrcodes.length }));
      
      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`${t('app.master-data.operations.batchGenerateQrCodeFailed')}: ${error.message || t('common.unknownError')}`);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setOperationDetail(null);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Operation>[] = [
    {
      title: '工序编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工序名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '报工类型',
      dataIndex: 'reportingType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        quantity: { text: '按数量报工', status: 'Processing' },
        status: { text: '按状态报工', status: 'Success' },
      },
      render: (_, record) => (
        <Tag color={record.reportingType === 'quantity' ? 'blue' : 'green'}>
          {record.reportingType === 'quantity' ? '按数量报工' : '按状态报工'}
        </Tag>
      ),
    },
    {
      title: '允许跳转',
      dataIndex: 'allowJump',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '允许', status: 'Success' },
        false: { text: '不允许', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.allowJump ? 'success' : 'default'}>
          {record.allowJump ? '允许' : '不允许'}
        </Tag>
      ),
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
    {
      title: '绑定不良品项',
      dataIndex: ['defect_types', 'defectTypes'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_, record: Operation) => {
        const dts = record.defectTypes ?? record.defect_types ?? [];
        const arr = Array.isArray(dts) ? dts : [];
        if (!arr.length) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {arr.slice(0, 3).map((d: DefectTypeMinimal) => (
              <Tag key={d.uuid}>{d.name ?? d.code}</Tag>
            ))}
            {arr.length > 3 && <Tag>+{arr.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '默认生产人员',
      dataIndex: ['default_operator_names', 'defaultOperatorNames'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_, record: Operation) => {
        const names = record.defaultOperatorNames ?? record.default_operator_names ?? [];
        const arr = Array.isArray(names) ? names : [];
        if (!arr.length) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {arr.slice(0, 3).map((name: string, idx: number) => (
              <Tag key={idx}>{name}</Tag>
            ))}
            {arr.length > 3 && <Tag>+{arr.length - 3}</Tag>}
          </Space>
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
        const val = record.createdAt ?? (record as any).created_at;
        if (val == null || val === '') return '-';
        return dayjs(val).isValid() ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : String(val);
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
            title={t('common.confirmDelete')}
            description={t('app.master-data.operations.deleteConfirmDesc')}
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
      <UniTable<Operation>
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
          
          try {
            const result = await operationApi.list(apiParams);
            // 兼容：接口可能直接返回数组或 { data: [] }，且保证每条含 defect_types
            const listData = Array.isArray(result) ? result : (result?.data ?? []);
            return {
              data: listData,
              success: true,
              total: listData.length,
            };
          } catch (error: any) {
            console.error('获取工序列表失败:', error);
            messageApi.error(error?.message || '获取工序列表失败');
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
            新建工序
          </Button>,
          <Button
            key="batch-qrcode"
            icon={<QrcodeOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchGenerateQRCode}
          >
            批量生成二维码
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
      />

      <DetailDrawerTemplate<Operation>
        title="工序详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={operationDetail || undefined}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        customContent={
          <>
            <ProDescriptions<Operation>
              dataSource={operationDetail || undefined}
              column={2}
              columns={[
                { title: '工序编码', dataIndex: 'code' },
                { title: '工序名称', dataIndex: 'name' },
                { title: '描述', dataIndex: 'description', span: 2 },
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
                  title: '绑定不良品项',
                  dataIndex: 'defectTypes',
                  span: 2,
                  render: (_, record) => {
                    const dts = record.defectTypes ?? record.defect_types ?? [];
                    const arr = Array.isArray(dts) ? dts : [];
                    if (!arr.length) return '-';
                    return (
                      <Space size={[0, 4]} wrap>
                        {arr.map((d: DefectTypeMinimal) => (
                          <Tag key={d.uuid}>{d.name ?? d.code}</Tag>
                        ))}
                      </Space>
                    );
                  },
                },
                {
                  title: '默认生产人员',
                  dataIndex: 'defaultOperatorNames',
                  span: 2,
                  render: (_, record) => {
                    const names = record.defaultOperatorNames ?? record.default_operator_names ?? [];
                    const arr = Array.isArray(names) ? names : [];
                    if (!arr.length) return '-';
                    return (
                      <Space size={[0, 4]} wrap>
                        {arr.map((name: string, idx: number) => (
                          <Tag key={idx}>{name}</Tag>
                        ))}
                      </Space>
                    );
                  },
                },
                {
                  title: '创建时间',
                  dataIndex: 'createdAt',
                  render: (_, record) => {
                    const val = record.createdAt ?? (record as any).created_at;
                    if (val == null || val === '') return '-';
                    return dayjs(val).isValid() ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : String(val);
                  },
                },
                {
                  title: '更新时间',
                  dataIndex: 'updatedAt',
                  render: (_, record) => {
                    const val = record.updatedAt ?? (record as any).updated_at;
                    if (val == null || val === '') return '-';
                    return dayjs(val).isValid() ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : String(val);
                  },
                },
              ]}
            />
            
            {/* 工序二维码 */}
            {operationDetail && (
              <div style={{ marginTop: 24 }}>
                <Card title="工序二维码">
                  <QRCodeGenerator
                    qrcodeType="OP"
                    data={{
                      operation_uuid: operationDetail.uuid,
                      operation_code: operationDetail.code || '',
                      operation_name: operationDetail.name || '',
                    }}
                    autoGenerate={true}
                  />
                </Card>
              </div>
            )}
          </>
        }
      />

      <OperationFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </ListPageTemplate>
  );
};

export default OperationsPage;
