/**
 * 页面指标配置
 *
 * 配置列表页与指标型数据集的绑定关系。
 * 一个页面仅绑定一个 multi_metric 数据集。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space } from 'antd';
import { EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import {
  listPageMetricConfigs,
  bindPageMetricConfig,
  unbindPageMetricConfig,
  initSalesOrderMetrics,
  getDatasetList,
  type PageMetricConfigItem,
  type Dataset,
} from '../../../../services/dataset';

const PageMetricsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [editingPagePath, setEditingPagePath] = useState<string | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [metricDatasets, setMetricDatasets] = useState<Dataset[]>([]);

  const handleInitSalesOrderMetrics = async () => {
    try {
      setInitLoading(true);
      const res = await initSalesOrderMetrics();
      messageApi.success(res.message);
      actionRef.current?.reload();
      queryClient.invalidateQueries({ queryKey: ['pageMetrics'] });
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.pageMetrics.initFailed', '初始化失败'));
    } finally {
      setInitLoading(false);
    }
  };

  const loadMetricDatasets = async () => {
    try {
      const res = await getDatasetList({ output_type: 'multi_metric', page_size: 200 });
      setMetricDatasets(res.items);
    } catch {
      setMetricDatasets([]);
    }
  };

  const handleCreate = () => {
    setEditingPagePath(null);
    setFormInitialValues({ page_path: '', dataset_code: undefined, sort_order: 0 });
    loadMetricDatasets();
    setModalVisible(true);
  };

  const handleEdit = (record: PageMetricConfigItem) => {
    setEditingPagePath(record.page_path);
    setFormInitialValues({
      page_path: record.page_path,
      dataset_code: record.dataset_code,
      sort_order: record.sort_order,
    });
    loadMetricDatasets();
    setModalVisible(true);
  };

  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      await bindPageMetricConfig({
        page_path: values.page_path.trim(),
        dataset_code: values.dataset_code,
        sort_order: values.sort_order ?? 0,
      });
      messageApi.success(t('pages.system.pageMetrics.saveSuccess', '配置已保存'));
      setModalVisible(false);
      actionRef.current?.reload();
      queryClient.invalidateQueries({ queryKey: ['pageMetrics'] });
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.pageMetrics.saveFailed', '保存失败'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (record: PageMetricConfigItem) => {
    try {
      await unbindPageMetricConfig(record.page_path);
      messageApi.success(t('pages.system.pageMetrics.deleteSuccess', '已解除绑定'));
      actionRef.current?.reload();
      queryClient.invalidateQueries({ queryKey: ['pageMetrics'] });
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.pageMetrics.deleteFailed', '解除失败'));
    }
  };

  const columns: ProColumns<PageMetricConfigItem>[] = [
    {
      title: t('pages.system.pageMetrics.columnPagePath', '页面路径'),
      dataIndex: 'page_path',
      width: 320,
      copyable: true,
    },
    {
      title: t('pages.system.pageMetrics.columnDatasetCode', '数据集'),
      dataIndex: 'dataset_code',
      width: 200,
    },
    {
      title: t('pages.system.pageMetrics.columnSortOrder', '排序'),
      dataIndex: 'sort_order',
      width: 80,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('pages.system.pageMetrics.confirmUnbind', '确定解除该页面的指标绑定？')}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const datasetOptions = metricDatasets.map((d) => ({ label: `${d.name} (${d.code})`, value: d.code }));

  return (
    <>
      <ListPageTemplate>
        <UniTable<PageMetricConfigItem>
          actionRef={actionRef}
          columns={columns}
          request={async () => {
            try {
              const items = await listPageMetricConfigs();
              return { data: items, success: true, total: items.length };
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.pageMetrics.loadFailed', '加载失败'));
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          pagination={false}
          showCreateButton
          onCreate={handleCreate}
          createButtonText={t('pages.system.pageMetrics.createButton', '新增绑定')}
          toolBarRender={() => [
            <Button
              key="init-sales"
              icon={<ThunderboltOutlined />}
              loading={initLoading}
              onClick={handleInitSalesOrderMetrics}
            >
              {t('pages.system.pageMetrics.initSalesOrderMetrics', '一键初始化销售订单指标')}
            </Button>,
          ]}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingPagePath ? t('pages.system.pageMetrics.modalEdit', '编辑绑定') : t('pages.system.pageMetrics.modalCreate', '新增绑定')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={!!editingPagePath}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormText
          name="page_path"
          label={t('pages.system.pageMetrics.labelPagePath', '页面路径')}
          rules={[{ required: true, message: t('pages.system.pageMetrics.pagePathRequired', '请输入页面路径') }]}
          placeholder="/apps/kuaizhizao/sales-management/sales-orders"
          disabled={!!editingPagePath}
          colProps={{ span: 24 }}
        />
        <ProFormSelect
          name="dataset_code"
          label={t('pages.system.pageMetrics.labelDataset', '指标数据集')}
          rules={[{ required: true, message: t('pages.system.pageMetrics.datasetRequired', '请选择数据集') }]}
          options={datasetOptions}
          colProps={{ span: 24 }}
        />
        <ProFormDigit
          name="sort_order"
          label={t('pages.system.pageMetrics.labelSortOrder', '排序')}
          initialValue={0}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>
    </>
  );
};

export default PageMetricsPage;
