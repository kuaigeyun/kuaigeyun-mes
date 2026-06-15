/**
 * 客户向：MRP 计算参数「一页纸」说明（弹窗内展示，与 docs/mrp-parameters-customer-one-pager-zh.md 同步维护）
 */
import React, { useMemo, useState } from 'react'
import { Button, Modal, Typography, Table } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { Trans } from 'react-i18next'

const { Title, Paragraph, Text } = Typography

const PARAM_ROW_KEYS = [
  { paramKey: 'mrpParamSafetyStock', problemKey: 'mrpParamSafetyStockProblem' },
  { paramKey: 'mrpParamInTransit', problemKey: 'mrpParamInTransitProblem' },
  { paramKey: 'mrpParamReserved', problemKey: 'mrpParamReservedProblem' },
  { paramKey: 'mrpParamReorderPoint', problemKey: 'mrpParamReorderPointProblem' },
  { paramKey: 'mrpParamWarehouses', problemKey: 'mrpParamWarehousesProblem' },
  { paramKey: 'mrpParamPlanningHorizon', problemKey: 'mrpParamPlanningHorizonProblem' },
  { paramKey: 'mrpParamBomVersion', problemKey: 'mrpParamBomVersionProblem' },
  { paramKey: 'mrpParamLotSizing', problemKey: 'mrpParamLotSizingProblem' },
  { paramKey: 'mrpParamScheduleBuffer', problemKey: 'mrpParamScheduleBufferProblem' },
] as const

export const MrpParametersCustomerGuideTrigger: React.FC<{ size?: 'small' | 'middle' }> = ({ size = 'small' }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const paramRows = useMemo(
    () =>
      PARAM_ROW_KEYS.map((row) => ({
        param: t(`app.kuaizhizao.demandComputation.${row.paramKey}`),
        problem: t(`app.kuaizhizao.demandComputation.${row.problemKey}`),
      })),
    [t],
  )

  const columns = useMemo(
    () => [
      { title: t('app.kuaizhizao.demandComputation.colParam'), dataIndex: 'param', width: 200 },
      { title: t('app.kuaizhizao.demandComputation.colProblemSolved'), dataIndex: 'problem' },
    ],
    [t],
  )

  return (
    <>
      <Button type="link" size={size} icon={<QuestionCircleOutlined />} onClick={() => setOpen(true)}>
        {t('app.kuaizhizao.demandComputation.mrpGuideTrigger')}
      </Button>
      <Modal
        title={t('app.kuaizhizao.demandComputation.mrpGuideTitle')}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <Typography>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            <Trans i18nKey="app.kuaizhizao.demandComputation.mrpGuideIntro" />
          </Paragraph>

          <Title level={5}>{t('app.kuaizhizao.demandComputation.mrpGuideSection1')}</Title>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              <Text strong>{t('app.kuaizhizao.demandComputation.mrpGuideProblem1Title')}</Text>
              : {t('app.kuaizhizao.demandComputation.mrpGuideProblem1Desc')}
            </li>
            <li>
              <Text strong>{t('app.kuaizhizao.demandComputation.mrpGuideProblem2Title')}</Text>
              : {t('app.kuaizhizao.demandComputation.mrpGuideProblem2Desc')}
            </li>
            <li>
              <Text strong>{t('app.kuaizhizao.demandComputation.mrpGuideProblem3Title')}</Text>
              : {t('app.kuaizhizao.demandComputation.mrpGuideProblem3Desc')}
            </li>
            <li>
              <Text strong>{t('app.kuaizhizao.demandComputation.mrpGuideProblem4Title')}</Text>
              : {t('app.kuaizhizao.demandComputation.mrpGuideProblem4Desc')}
            </li>
            <li>
              <Text strong>{t('app.kuaizhizao.demandComputation.mrpGuideProblem5Title')}</Text>
              : {t('app.kuaizhizao.demandComputation.mrpGuideProblem5Desc')}
            </li>
          </ul>

          <Title level={5} style={{ marginTop: 20 }}>
            {t('app.kuaizhizao.demandComputation.mrpGuideSection2')}
          </Title>
          <Table
            size="small"
            pagination={false}
            rowKey="param"
            style={{ marginTop: 8 }}
            columns={columns}
            dataSource={paramRows}
          />

          <Title level={5} style={{ marginTop: 20 }}>
            {t('app.kuaizhizao.demandComputation.mrpGuideSection3')}
          </Title>
          <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
            <li>{t('app.kuaizhizao.demandComputation.mrpGuideAdvice1')}</li>
            <li>{t('app.kuaizhizao.demandComputation.mrpGuideAdvice2')}</li>
            <li>{t('app.kuaizhizao.demandComputation.mrpGuideAdvice3')}</li>
            <li>{t('app.kuaizhizao.demandComputation.mrpGuideAdvice4')}</li>
          </ol>

          <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
            {t('app.kuaizhizao.demandComputation.mrpGuideFooter')}
          </Paragraph>
        </Typography>
      </Modal>
    </>
  )
}
