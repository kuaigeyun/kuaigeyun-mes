/**
 * 盘点单管理页面
 * 
 * 提供盘点单的 CRUD 功能，包括列表展示、创建、编辑、删除、完成盘点等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { stocktakeApi } from '../../services/process';
import type { Stocktake, StocktakeCreate, StocktakeUpdate } from '../../types/process';

/**
 * 盘点单管理列表页面组件
 */
const StocktakesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentStocktakeUuid, setCurrentStocktakeUuid] = useState<string | null>(null);
  const [stocktakeDetail, setStocktakeDetail] = useState<Stocktake | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑盘点单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建盘点单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentStocktakeUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      stocktakeType: '全盘',
      status: '草稿',
    });
  };

  /**
   * 处理编辑盘点单
   */
  const handleEdit = async (record: Stocktake) => {
    try {
      setIsEdit(true);
      setCurrentStocktakeUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await stocktakeApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        stocktakeNo: detail.stocktakeNo,
        stocktakeDate: detail.stocktakeDate,
        warehouseId: detail.warehouseId,
        locationId: detail.locationId,
        stocktakeType: detail.stocktakeType,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取盘点单详情失败');
    }
  };

  /**
   * 处理删除盘点单
   */
  const handleDelete = async (record: Stocktake) => {
    try {
      await stocktakeApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Stocktake) => {
    try {
      setCurrentStocktakeUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await stocktakeApi.get(record.uuid);
      setStocktakeDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取盘点单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理完成盘点
   */
  const handleComplete = async (record: Stocktake) => {
    Modal.confirm({
      title: '完成盘点',
      content: `确定要完成盘点单 ${record.stocktakeNo} 吗？将计算盘点差异。`,
      onOk: async () => {
        try {
          await stocktakeApi.complete(record.uuid);
          messageApi.success('完成盘点成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '完成盘点失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: StocktakeCreate | StocktakeUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentStocktakeUuid) {
        await stocktakeApi.update(currentStocktakeUuid, values as StocktakeUpdate);
        messageApi.success('更新成功');
      } else {
        await stocktakeApi.create(values as StocktakeCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Stocktake>[] = [
    {
      title: '盘点单编号',
      dataIndex: 'stocktakeNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.stocktakeNo}</a>
      ),
    },
    {
      title: '仓库ID',
      dataIndex: 'warehouseId',
      width: 100,
    },
    {
      title: '库位ID',
      dataIndex: 'locationId',
      width: 100,
    },
    {
      title: '盘点类型',
      dataIndex: 'stocktakeType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '全盘': { text: '全盘' },
        '抽盘': { text: '抽盘' },
        '循环盘点': { text: '循环盘点' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '进行中': { text: <Tag color="orange">进行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '差异金额',
      dataIndex: 'differenceAmount',
      width: 120,
      valueType: 'money',
    },
    {
      title: '盘点日期',
      dataIndex: 'stocktakeDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === '进行中' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record)}
            >
              完成盘点
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条盘点单吗？"
            onConfirm={() => handleDelete(record)}
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

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Stocktake>
        headerTitle="盘点单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await stocktakeApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建盘点单
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑盘点单' : '新建盘点单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="stocktakeNo"
            label="盘点单编号"
            rules={[{ required: true, message: '请输入盘点单编号' }]}
            placeholder="请输入盘点单编号"
          />
          <ProFormDatePicker
            name="stocktakeDate"
            label="盘点日期"
            rules={[{ required: true, message: '请选择盘点日期' }]}
          />
          <ProFormText
            name="warehouseId"
            label="仓库ID"
            rules={[{ required: true, message: '请输入仓库ID' }]}
            placeholder="请输入仓库ID"
          />
          <ProFormSelect
            name="stocktakeType"
            label="盘点类型"
            options={[
              { label: '全盘', value: '全盘' },
              { label: '抽盘', value: '抽盘' },
              { label: '循环盘点', value: '循环盘点' },
            ]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="盘点单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : stocktakeDetail ? (
          <ProDescriptions<Stocktake>
            column={1}
            dataSource={stocktakeDetail}
            columns={[
              { title: '盘点单编号', dataIndex: 'stocktakeNo' },
              { title: '仓库ID', dataIndex: 'warehouseId' },
              { title: '库位ID', dataIndex: 'locationId' },
              { title: '盘点类型', dataIndex: 'stocktakeType' },
              { title: '状态', dataIndex: 'status' },
              { title: '差异金额', dataIndex: 'differenceAmount', valueType: 'money' },
              { title: '盘点日期', dataIndex: 'stocktakeDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default StocktakesPage;
