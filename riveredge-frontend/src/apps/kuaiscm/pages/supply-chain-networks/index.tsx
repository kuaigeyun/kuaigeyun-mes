/**
 * 供应链网络管理页面
 * 
 * 提供供应链网络的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { supplyChainNetworkApi } from '../../services/process';
import type { SupplyChainNetwork, SupplyChainNetworkCreate, SupplyChainNetworkUpdate } from '../../types/process';

/**
 * 供应链网络管理列表页面组件
 */
const SupplyChainNetworksPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentNetworkUuid, setCurrentNetworkUuid] = useState<string | null>(null);
  const [networkDetail, setNetworkDetail] = useState<SupplyChainNetwork | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑供应链网络）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建供应链网络
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentNetworkUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      level: 1,
      status: '启用',
    });
  };

  /**
   * 处理编辑供应链网络
   */
  const handleEdit = async (record: SupplyChainNetwork) => {
    try {
      setIsEdit(true);
      setCurrentNetworkUuid(record.uuid);
      setModalVisible(true);
      
      // 获取供应链网络详情
      const detail = await supplyChainNetworkApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        networkNo: detail.networkNo,
        networkName: detail.networkName,
        nodeType: detail.nodeType,
        nodeId: detail.nodeId,
        nodeName: detail.nodeName,
        nodeCode: detail.nodeCode,
        parentNodeId: detail.parentNodeId,
        parentNodeUuid: detail.parentNodeUuid,
        level: detail.level,
        relationshipType: detail.relationshipType,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取供应链网络详情失败');
    }
  };

  /**
   * 处理删除供应链网络
   */
  const handleDelete = async (record: SupplyChainNetwork) => {
    try {
      await supplyChainNetworkApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SupplyChainNetwork) => {
    try {
      setCurrentNetworkUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await supplyChainNetworkApi.get(record.uuid);
      setNetworkDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取供应链网络详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SupplyChainNetworkCreate | SupplyChainNetworkUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentNetworkUuid) {
        await supplyChainNetworkApi.update(currentNetworkUuid, values as SupplyChainNetworkUpdate);
        messageApi.success('更新成功');
      } else {
        await supplyChainNetworkApi.create(values as SupplyChainNetworkCreate);
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
  const columns: ProColumns<SupplyChainNetwork>[] = [
    {
      title: '网络编号',
      dataIndex: 'networkNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.networkNo}</a>
      ),
    },
    {
      title: '网络名称',
      dataIndex: 'networkName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '节点类型',
      dataIndex: 'nodeType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '供应商': { text: '供应商' },
        '制造商': { text: '制造商' },
        '分销商': { text: '分销商' },
        '客户': { text: '客户' },
      },
    },
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '层级',
      dataIndex: 'level',
      width: 80,
    },
    {
      title: '关系类型',
      dataIndex: 'relationshipType',
      width: 120,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '启用': { text: <Tag color="green">启用</Tag> },
        '停用': { text: <Tag color="default">停用</Tag> },
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
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条供应链网络吗？"
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
      <UniTable<SupplyChainNetwork>
        headerTitle="供应链网络管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await supplyChainNetworkApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length, // TODO: 后端需要返回总数
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
            新建供应链网络
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑供应链网络' : '新建供应链网络'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
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
            name="networkNo"
            label="网络编号"
            rules={[{ required: true, message: '请输入网络编号' }]}
            placeholder="请输入网络编号"
          />
          <ProFormText
            name="networkName"
            label="网络名称"
            rules={[{ required: true, message: '请输入网络名称' }]}
            placeholder="请输入网络名称"
          />
          <ProFormSelect
            name="nodeType"
            label="节点类型"
            options={[
              { label: '供应商', value: '供应商' },
              { label: '制造商', value: '制造商' },
              { label: '分销商', value: '分销商' },
              { label: '客户', value: '客户' },
            ]}
            rules={[{ required: true, message: '请选择节点类型' }]}
          />
          <ProFormDigit
            name="nodeId"
            label="节点ID"
            placeholder="请输入节点ID"
          />
          <ProFormText
            name="nodeName"
            label="节点名称"
            placeholder="请输入节点名称"
          />
          <ProFormText
            name="nodeCode"
            label="节点编码"
            placeholder="请输入节点编码"
          />
          <ProFormDigit
            name="parentNodeId"
            label="父节点ID"
            placeholder="请输入父节点ID"
          />
          <ProFormText
            name="parentNodeUuid"
            label="父节点UUID"
            placeholder="请输入父节点UUID"
          />
          <ProFormDigit
            name="level"
            label="层级"
            placeholder="请输入层级"
            initialValue={1}
          />
          <ProFormText
            name="relationshipType"
            label="关系类型"
            placeholder="请输入关系类型"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '启用', value: '启用' },
              { label: '停用', value: '停用' },
            ]}
            initialValue="启用"
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="供应链网络详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : networkDetail ? (
          <ProDescriptions<SupplyChainNetwork>
            column={1}
            dataSource={networkDetail}
            columns={[
              { title: '网络编号', dataIndex: 'networkNo' },
              { title: '网络名称', dataIndex: 'networkName' },
              { title: '节点类型', dataIndex: 'nodeType' },
              { title: '节点ID', dataIndex: 'nodeId' },
              { title: '节点名称', dataIndex: 'nodeName' },
              { title: '节点编码', dataIndex: 'nodeCode' },
              { title: '父节点ID', dataIndex: 'parentNodeId' },
              { title: '父节点UUID', dataIndex: 'parentNodeUuid' },
              { title: '层级', dataIndex: 'level' },
              { title: '关系类型', dataIndex: 'relationshipType' },
              { title: '状态', dataIndex: 'status' },
              { title: '备注', dataIndex: 'remark' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default SupplyChainNetworksPage;

