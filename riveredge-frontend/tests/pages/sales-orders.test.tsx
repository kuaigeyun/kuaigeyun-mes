/**
 * 销售订单页面组件测试
 * 
 * 测试销售订单页面的基本功能。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import SalesOrdersPage from '../../src/apps/kuaizhizao/pages/sales-management/sales-orders/index'

// Mock依赖
vi.mock('../../src/apps/kuaizhizao/services/sales', () => ({
  listSalesOrders: vi.fn(),
  getSalesOrder: vi.fn(),
  createSalesOrder: vi.fn(),
  updateSalesOrder: vi.fn(),
}))

vi.mock('../../../../master-data/services/supply-chain', () => ({
  customerApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../../../master-data/services/material', () => ({
  materialApi: {
    list: vi.fn(),
  },
}))

describe('销售订单页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染页面标题', async () => {
    const { listSalesOrders } = await import('../../src/apps/kuaizhizao/services/sales')
    vi.mocked(listSalesOrders).mockResolvedValue([])

    render(
      <App>
        <SalesOrdersPage />
      </App>
    )

    await waitFor(() => {
      expect(screen.getByText(/销售订单管理/i)).toBeInTheDocument()
    })
  })

  it('应该显示新建订单按钮', async () => {
    const { listSalesOrders } = await import('../../src/apps/kuaizhizao/services/sales')
    vi.mocked(listSalesOrders).mockResolvedValue([])

    render(
      <App>
        <SalesOrdersPage />
      </App>
    )

    await waitFor(() => {
      expect(screen.getByText(/新建订单/i)).toBeInTheDocument()
    })
  })
})

