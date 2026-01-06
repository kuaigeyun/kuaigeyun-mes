/**
 * 生产执行服务测试
 * 
 * 测试工单管理相关的API调用。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { workOrderApi } from '../../src/apps/kuaizhizao/services/production'
import { apiRequest } from '../../src/services/api'

// Mock API模块
vi.mock('../../src/services/api', () => ({
  apiRequest: vi.fn(),
}))

describe('工单管理服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('workOrderApi.list', () => {
    it('应该成功获取工单列表', async () => {
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

      vi.mocked(apiRequest).mockResolvedValue(mockOrders)

      const result = await workOrderApi.list({ skip: 0, limit: 20 })

      expect(apiRequest).toHaveBeenCalledWith('/apps/kuaizhizao/work-orders', {
        method: 'GET',
        params: { skip: 0, limit: 20 },
      })
      expect(result).toEqual(mockOrders)
    })

    it('应该支持筛选参数', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'WO202601150001',
          status: '草稿',
        },
      ]

      vi.mocked(apiRequest).mockResolvedValue(mockOrders)

      const result = await workOrderApi.list({ skip: 0, limit: 20, status: '草稿' })

      expect(apiRequest).toHaveBeenCalledWith('/apps/kuaizhizao/work-orders', {
        method: 'GET',
        params: { skip: 0, limit: 20, status: '草稿' },
      })
      expect(result).toEqual(mockOrders)
    })
  })

  describe('workOrderApi.create', () => {
    it('应该成功创建工单', async () => {
      const orderData = {
        material_id: 1,
        quantity: 100,
        workshop_id: 1,
        production_line_id: 1,
      }

      const mockResponse = {
        id: 1,
        order_code: 'WO202601150001',
        ...orderData,
        status: '草稿',
      }

      vi.mocked(apiRequest).mockResolvedValue(mockResponse)

      const result = await workOrderApi.create(orderData)

      expect(apiRequest).toHaveBeenCalledWith('/apps/kuaizhizao/work-orders', {
        method: 'POST',
        data: orderData,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('workOrderApi.get', () => {
    it('应该成功获取工单详情', async () => {
      const mockOrder = {
        id: 1,
        order_code: 'WO202601150001',
        status: '草稿',
      }

      vi.mocked(apiRequest).mockResolvedValue(mockOrder)

      const result = await workOrderApi.get('1')

      expect(apiRequest).toHaveBeenCalledWith('/apps/kuaizhizao/work-orders/1', {
        method: 'GET',
      })
      expect(result).toEqual(mockOrder)
    })
  })

  describe('workOrderApi.update', () => {
    it('应该成功更新工单', async () => {
      const updateData = {
        notes: '更新后的备注',
      }

      const mockResponse = {
        id: 1,
        order_code: 'WO202601150001',
        ...updateData,
      }

      vi.mocked(apiRequest).mockResolvedValue(mockResponse)

      const result = await workOrderApi.update('1', updateData)

      expect(apiRequest).toHaveBeenCalledWith('/apps/kuaizhizao/work-orders/1', {
        method: 'PUT',
        data: updateData,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('workOrderApi.release', () => {
    it('应该成功下达工单', async () => {
      const mockResponse = {
        id: 1,
        order_code: 'WO202601150001',
        status: '已下达',
      }

      vi.mocked(apiRequest).mockResolvedValue(mockResponse)

      const result = await workOrderApi.release('1')

      expect(apiRequest).toHaveBeenCalledWith('/apps/kuaizhizao/work-orders/1/release', {
        method: 'POST',
      })
      expect(result).toEqual(mockResponse)
    })
  })
})


