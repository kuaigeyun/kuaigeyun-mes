import React, { useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Tag, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { equipmentFaultApi } from '../../../services/equipment';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaizhizao.equipmentRepair';
const RESOURCE = 'kuaizhizao:equipment-fault';

interface EquipmentRepair {
  uuid?: string;
  repair_no?: string;
  equipment_uuid?: string;
  equipment_name?: string;
  equipment_fault_uuid?: string;
  repair_date?: string;
  repair_type?: string;
  repair_description?: string;
  repairer_name?: string;
  repair_duration?: number;
  repair_cost?: number;
  status?: string;
  repair_result?: string;
  repair_parts?: { items?: Array<{ spare_part_id?: number; quantity?: number }> };
  created_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  进行中: 'processing',
  已完成: 'success',
  已取消: 'default',
};

const EquipmentRepairsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<EquipmentRepair | null>(null);

  const handleDetail = async (record: EquipmentRepair) => {
    if (!record.uuid) return;
    const res = await equipmentFaultApi.getRepair(record.uuid);
    setDetail(res);
    setDrawerVisible(true);
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const key of keys) {
          await equipmentFaultApi.deleteRepair(String(key));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<EquipmentRepair>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.repairNo`),
        dataIndex: 'repair_no',
        width: 140,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.repair_no ?? '') }} ellipsis>
            {r.repair_no ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t(`${P}.col.equipmentName`), dataIndex: 'equipment_name', width: 180, ellipsis: true },
      {
        title: t(`${P}.col.repairDate`),
        dataIndex: 'repair_date',
        valueType: 'dateTime',
        width: 160,
      },
      { title: t(`${P}.col.repairType`), dataIndex: 'repair_type', width: 120 },
      { title: t(`${P}.col.repairerName`), dataIndex: 'repairer_name', width: 120, hideInSearch: true },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 100,
        valueType: 'select',
        valueEnum: {
          进行中: { text: t(`${P}.status.inProgress`) },
          已完成: { text: t(`${P}.status.completed`) },
          已取消: { text: t(`${P}.status.cancelled`) },
        },
        render: (_, r) => <Tag color={STATUS_COLORS[r.status ?? ''] ?? 'default'}>{r.status ?? '-'}</Tag>,
      },
      {
        title: t(`${P}.col.repairResult`),
        dataIndex: 'repair_result',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 120,
        fixed: 'right',
        render: (_, record) => [
          perms.canRead ? (
            <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => void handleDetail(record)}>
              {t('common.view')}
            </Button>
          ) : null,
        ],
      },
    ],
    [t, perms.canRead],
  );

  if (!perms.canRead) return null;

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentRepair>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-repairs"
          actionRef={actionRef}
          rowKey="uuid"
          enableRowSelection={perms.canDelete}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          columns={columns}
          onRow={(record) => ({ onClick: () => void handleDetail(record), style: { cursor: 'pointer' } })}
          request={async (params) => {
            const res = await equipmentFaultApi.listRepairs({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              search: (params as { keyword?: string }).keyword,
              status: params.status as string | undefined,
            });
            return { data: res.items || [], success: true, total: res.total || 0 };
          }}
          search={{ labelWidth: 'auto' }}
          pagination={{ defaultPageSize: 20 }}
          scroll={{ x: 1300 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetail(null);
        }}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      >
        {detail ? (
          <DetailDrawerSection title={t(`${P}.section.basic`)}>
            <p>{t(`${P}.col.repairNo`)}: {detail.repair_no ?? '-'}</p>
            <p>{t(`${P}.col.equipmentName`)}: {detail.equipment_name ?? '-'}</p>
            <p>{t(`${P}.col.repairDate`)}: {detail.repair_date ? formatDateTime(detail.repair_date) : '-'}</p>
            <p>{t(`${P}.col.repairType`)}: {detail.repair_type ?? '-'}</p>
            <p>{t(`${P}.col.repairerName`)}: {detail.repairer_name ?? '-'}</p>
            <p>{t(`${P}.col.status`)}: {detail.status ?? '-'}</p>
            <p>{t(`${P}.col.repairResult`)}: {detail.repair_result ?? '-'}</p>
            <p>{t(`${P}.col.repairDescription`)}: {detail.repair_description ?? '-'}</p>
          </DetailDrawerSection>
        ) : null}
      </DetailDrawerTemplate>
    </>
  );
};

export default EquipmentRepairsPage;
