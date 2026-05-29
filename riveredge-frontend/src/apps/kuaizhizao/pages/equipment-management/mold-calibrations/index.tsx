/**
 * 模具校准记录页面
 *
 * 展示全量模具校准记录，支持新建校准记录。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Tag, message, Typography } from 'antd';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getCalibrationResultLifecycle } from '../../../utils/equipmentLifecycle';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface MoldCalibration {
  uuid?: string;
  mold_uuid?: string;
  mold_code?: string;
  mold_name?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  remark?: string;
  created_at?: string;
}

const MoldCalibrationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [moldOptions, setMoldOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    moldApi.list({ limit: 500 }).then((res: any) => {
      setMoldOptions((res.items || []).map((m: any) => ({ label: `${m.code} - ${m.name}`, value: m.uuid })));
    }).catch(() => {});
  }, []);

  const handleCreate = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
  };

  useNewShortcut(handleCreate);

  const handleSubmit = async (values: any) => {
    try {
      await moldApi.createCalibration({
        mold_uuid: values.mold_uuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
      });
      messageApi.success('校准记录已保存');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败');
      throw e;
    }
  };

  const columns: ProColumns<MoldCalibration>[] = [
    {
      title: '模具编号',
      dataIndex: 'mold_code',
      width: 120,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.mold_code ?? '') }} ellipsis>
          {r.mold_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '模具名称', dataIndex: 'mold_name', width: 180, ellipsis: true },
    { title: '校准日期', dataIndex: 'calibration_date', valueType: 'date', width: 120 },
    {
      title: '结果',
      dataIndex: 'result',
      width: 100,
      render: (_, r) => {
        const color = r.result === '合格' ? 'success' : r.result === '不合格' ? 'error' : 'warning';
        return <Tag color={color}>{r.result || '-'}</Tag>;
      },
    },
    {
      title: '证书编号',
      dataIndex: 'certificate_no',
      width: 140,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.certificate_no ?? '') }} ellipsis>
          {r.certificate_no ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '有效期至', dataIndex: 'expiry_date', valueType: 'date', width: 120 },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getCalibrationResultLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, hideInSearch: true },
  ];

  return (
    <ListPageTemplate>
      <UniTable<MoldCalibration>
        headerTitle="模具校准记录"
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-calibrations"
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await moldApi.listCalibrations({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            mold_uuid: params.mold_uuid,
            keyword: (params as any).keyword,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {'新建校准记录' + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        scroll={{ x: 1500 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title="新建模具校准记录"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="mold_uuid"
          label="模具"
          options={moldOptions}
          placeholder="请选择模具"
          rules={[{ required: true, message: '请选择模具' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="calibration_date"
          label="校准日期"
          rules={[{ required: true, message: '请选择校准日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="result"
          label="结果"
          options={[
            { label: '合格', value: '合格' },
            { label: '不合格', value: '不合格' },
            { label: '准用', value: '准用' },
          ]}
          rules={[{ required: true, message: '请选择结果' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="certificate_no" label="证书编号" colProps={{ span: 12 }} />
        <ProFormDatePicker name="expiry_date" label="有效期至" colProps={{ span: 12 }} />
        <ProFormText name="remark" label="备注" colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default MoldCalibrationsPage;
