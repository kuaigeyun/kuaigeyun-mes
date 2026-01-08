/**
 * 销售订单服务测试
 * 
 * 测试销售订单相关的API调用。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listSalesOrders, createSalesOrder, getSalesOrder, updateSalesOrder } from '../../src/apps/kuaizhizao/services/sales'
import { api } from '../../src/services/api'

// Mock API模块
vi.mock('../../src/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('销售订单服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listSalesOrders', () => {
    it('应该成功获取销售订单列表', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'SO202601150001',
          customer_id: 1,
          customer_name: '测试客户',
          order_type: 'MTO',
          status: '草稿',
        },
        {
          id: 2,
          order_code: 'SO202601150002',
          customer_id: 1,
          customer_name: '测试客户',
          order_type: 'MTS',
          status: '已审核',
        },
      ]

      vi.mocked(api.get).mockResolvedValue(mockOrders)

      const result = await listSalesOrders({ skip: 0, limit: 20 })

      expect(api.get).toHaveBeenCalledWith('/apps/kuaizhizao/sales-orders', {
        params: { skip: 0, limit: 20 },
      })
      expect(result).toEqual(mockOrders)
    })

    it('应该支持筛选参数', async () => {
      const mockOrders = [
        {
          id: 1,
          order_code: 'SO202601150001',
          customer_id: 1,
          customer_name: '测试客户',
          order_type: 'MTO',
          status: '草稿',
        },
      ]

      vi.mocked(api.get).mockResolvedValue(mockOrders)

      const result = await listSalesOrders({
        skip: 0,
        limit: 20,
        status: '草稿',
        customer_id: 1,
      })

      expect(api.get).toHaveBeenCalledWith('/apps/kuaizhizao/sales-orders', {
        params: {
          skip: 0,
          limit: 20,
          status: '草稿',
          customer_id: 1,
        },
      })
      expect(result).toEqual(mockOrders)
    })
  })

  describe('createSalesOrder', () => {
    it('应该成功创建销售订单', async () => {
      const orderData = {
        customer_id: 1,
        customer_name: '测试客户',
        order_date: '2026-01-15',
        delivery_date: '2026-02-15',
        order_type: 'MTO' as const,
        items: [
          {
            material_id: 1,
            material_code: 'MAT001',
            material_name: '测试物料',
            material_unit: '个',
            ordered_quantity: 100,
            unit_price: 10,
            delivery_date: '2026-02-15',
          },
        ],
      }

      const mockResponse = {
        id: 1,
        order_code: 'SO202601150001',
        ...orderData,
        status: '草稿',
        total_quantity: 100,
        total_amount: 1000,
      }

      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const result = await createSalesOrder(orderData as any)

      expect(api.post).toHaveBeenCalledWith('/apps/kuaizhizao/sales-orders', orderData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getSalesOrder', () => {
    it('应该成功获取销售订单详情', async () => {
      const mockOrder = {
        id: 1,
        order_code: 'SO202601150001',
        customer_id: 1,
        customer_name: '测试客户',
        order_type: 'MTO',
        status: '草稿',
        items: [],
      }

      vi.mocked(api.get).mockResolvedValue(mockOrder)

      const result = await getSalesOrder(1)

      expect(api.get).toHaveBeenCalledWith('/apps/kuaizhizao/sales-orders/1')
      expect(result).toEqual(mockOrder)
    })
  })

  describe('updateSalesOrder', () => {
    it('应该成功更新销售订单', async () => {
      const updateData = {
        notes: '更新后的备注',
        shipping_address: '新地址',
      }

      const mockResponse = {
        id: 1,
        order_code: 'SO202601150001',
        ...updateData,
      }

      vi.mocked(api.put).mockResolvedValue(mockResponse)

      const result = await updateSalesOrder(1, updateData)

      expect(api.put).toHaveBeenCalledWith('/apps/kuaizhizao/sales-orders/1', updateData)
      expect(result).toEqual(mockResponse)
    })
  })
})







