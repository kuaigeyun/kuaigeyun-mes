/**
 * 工单管理完整流程E2E测试（前端）
 * 
 * 测试工单管理的前端交互流程。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { workOrderApi } from '../../src/apps/kuaizhizao/services/production'
import { apiRequest } from '../../src/services/api'

// Mock API模块
vi.mock('../../src/services/api', () => ({
  apiRequest: vi.fn(),
}))

describe('工单管理完整流程E2E测试（前端）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('创建工单流程', () => {
    it('应该完成创建工单的完整流程', async () => {
      const orderData = {
        material_id: 1,
        quantity: 100,
        workshop_id: 1,
        production_line_id: 1,
      }

      const mockCreatedOrder = {
        id: 1,
        order_code: 'WO202601150001',
        ...orderData,
        status: '草稿',
      }

      vi.mocked(apiRequest).mockResolvedValue(mockCreatedOrder)

      const result = await workOrderApi.create(orderData)

      expect(apiRequest).toHaveBeenCalledWith('/apps/kuaizhizao/work-orders', {
        method: 'POST',
        data: orderData,
      })
      expect(result).toEqual(mockCreatedOrder)
      expect(result.order_code).toBe('WO202601150001')
    })
  })

  describe('工单列表流程', () => {
    it('应该完成获取和筛选工单的完整流程', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'WO202601150001',
          status: '草稿',
        },
        {
          id: 2,
          order_code: 'WO202601150002',
          status: '已下达',
        },
      ]

      // 1. 获取所有工单
      vi.mocked(apiRequest).mockResolvedValueOnce(mockOrders)
      const allOrders = await workOrderApi.list({ skip: 0, limit: 20 })
      expect(allOrders).toHaveLength(2)

      // 2. 按状态筛选
      const filteredOrders = mockOrders.filter((o) => o.status === '草稿')
      vi.mocked(apiRequest).mockResolvedValueOnce(filteredOrders)
      const draftOrders = await workOrderApi.list({ skip: 0, limit: 20, status: '草稿' })
      expect(draftOrders).toHaveLength(1)
      expect(draftOrders[0].status).toBe('草稿')
    })
  })

  describe('工单下达流程', () => {
    it('应该完成工单下达的完整流程', async () => {
      const mockOrder = {
        id: 1,
        order_code: 'WO202601150001',
        status: '草稿',
      }

      // 1. 获取工单详情
      vi.mocked(apiRequest).mockResolvedValueOnce(mockOrder)
      const order = await workOrderApi.get('1')
      expect(order.id).toBe(1)

      // 2. 下达工单
      const releasedOrder = {
        ...mockOrder,
        status: '已下达',
      }
      vi.mocked(apiRequest).mockResolvedValueOnce(releasedOrder)
      const result = await workOrderApi.release('1')
      expect(result.status).toBe('已下达')
    })
  })
})







