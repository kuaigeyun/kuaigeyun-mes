/**
 * 客户向：MRP 计算参数「一页纸」说明（弹窗内展示，与 docs/mrp-parameters-customer-one-pager-zh.md 同步维护）
 */
import React, { useState } from 'react'
import { Button, Modal, Typography, Table } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

const PARAM_ROWS = [
  { param: '考虑安全库存', problem: '净算是否体现安全库存策略，避免过度消耗可用量。' },
  { param: '考虑在途/在制', problem: '是否把未结案采购、在制工单等计入供应，减少重复请购/投产。' },
  { param: '考虑预留量', problem: '已预留库存是否从可用量中扣除。' },
  { param: '考虑再订货点', problem: '是否按再订货点规则放大净需求。' },
  { param: '参与计算的仓库', problem: '哪些仓库参与库存汇总（默认普通仓，可增选）。' },
  { param: '计划展望期', problem: '超出窗口的需求行可不参与运算，减少远期噪声。' },
  { param: 'BOM 版本与展开层级', problem: '用对清单、控制展开深度，降低错料与异常深展风险。' },
  { param: '建议量按批量规则', problem: '建议量是否按最小量、倍数、上限圆整，便于直接下单。' },
  { param: '排程缓冲天数', problem: '在物料提前期基础上，开工/请购再整体前置若干天，应对波动。' },
]

export const MrpParametersCustomerGuideTrigger: React.FC<{ size?: 'small' | 'middle' }> = ({ size = 'small' }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="link" size={size} icon={<QuestionCircleOutlined />} onClick={() => setOpen(true)}>
        MRP 参数解决什么问题
      </Button>
      <Modal
        title="MRP 计算参数一页纸说明"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Typography>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            面向计划、采购、生产及管理层：说明各参数<strong>解决的现场问题</strong>。采购/自制/委外<strong>基础提前期</strong>在物料来源配置中维护；以下为每次运算可选的<strong>策略与缓冲</strong>。
          </Paragraph>

          <Title level={5}>一、我们帮您解决什么问题？</Title>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              <Text strong>库存与在途对不上</Text>：通过仓库范围、在途/在制、预留、安全库存、再订货点，把可供应量算清楚。
            </li>
            <li>
              <Text strong>远期预测不准</Text>：用计划展望期聚焦近期可执行需求。
            </li>
            <li>
              <Text strong>BOM 改版频繁</Text>：用 BOM 版本与展开层级控制用哪套清单、展多深。
            </li>
            <li>
              <Text strong>有 MOQ/整包装</Text>：用批量规则（结合物料主数据）圆整建议量。
            </li>
            <li>
              <Text strong>提前期仍偏紧</Text>：用排程缓冲天数在整体排程上多留余地。
            </li>
          </ul>

          <Title level={5} style={{ marginTop: 20 }}>
            二、参数与「解决什么问题」对照
          </Title>
          <Table
            size="small"
            pagination={false}
            rowKey="param"
            style={{ marginTop: 8 }}
            columns={[
              { title: '参数', dataIndex: 'param', width: 200 },
              { title: '解决什么问题', dataIndex: 'problem' },
            ]}
            dataSource={PARAM_ROWS}
          />

          <Title level={5} style={{ marginTop: 20 }}>
            三、落地建议
          </Title>
          <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
            <li>先保证 BOM、物料来源与提前期、仓库与库存习惯、开放单状态四类主数据可靠。</li>
            <li>建议先启用展望期、仓库范围、在途，再按需打开安全库存与再订货点。</li>
            <li>批量规则与供应商/现场凑单习惯对齐后再强制圆整。</li>
            <li>缓冲天数宜小步调整（如 1～3 天），结合历史延期迭代。</li>
          </ol>

          <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
            完整可打印版见项目内文档：docs/mrp-parameters-customer-one-pager-zh.md。参数含义以当前系统版本及实施配置为准。
          </Paragraph>
        </Typography>
      </Modal>
    </>
  )
}
