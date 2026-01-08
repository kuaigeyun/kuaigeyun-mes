/**
 * 客户管理服务测试
 * 
 * 测试客户相关的API调用。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { customerApi } from '../../src/apps/master-data/services/supply-chain'
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

describe('客户管理服务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('customerApi.list', () => {
    it('应该成功获取客户列表', async () => {
      const mockCustomers = [
        {
          id: 1,
          uuid: 'uuid-123',
          code: 'CUST001',
          name: '测试客户1',
        },
        {
          id: 2,
          uuid: 'uuid-456',
          code: 'CUST002',
          name: '测试客户2',
        },
      ]

      vi.mocked(api.get).mockResolvedValue(mockCustomers)

      const result = await customerApi.list({ skip: 0, limit: 20 })

      expect(api.get).toHaveBeenCalledWith('/apps/master-data/supply-chain/customers', {
        params: { skip: 0, limit: 20 },
      })
      expect(result).toEqual(mockCustomers)
    })

    it('应该支持筛选参数', async () => {
      const mockCustomers = [
        {
          id: 1,
          uuid: 'uuid-123',
          code: 'CUST001',
          name: '测试客户1',
          is_active: true,
        },
      ]

      vi.mocked(api.get).mockResolvedValue(mockCustomers)

      const result = await customerApi.list({
        skip: 0,
        limit: 20,
        is_active: true,
      })

      expect(api.get).toHaveBeenCalledWith('/apps/master-data/supply-chain/customers', {
        params: {
          skip: 0,
          limit: 20,
          is_active: true,
        },
      })
      expect(result).toEqual(mockCustomers)
    })
  })

  describe('customerApi.create', () => {
    it('应该成功创建客户', async () => {
      const customerData = {
        code: 'CUST001',
        name: '测试客户',
        contact_person: '联系人',
        phone: '13800000000',
      }

      const mockResponse = {
        id: 1,
        uuid: 'uuid-123',
        ...customerData,
      }

      vi.mocked(api.post).mockResolvedValue(mockResponse)

      const result = await customerApi.create(customerData as any)

      expect(api.post).toHaveBeenCalledWith(
        '/apps/master-data/supply-chain/customers',
        customerData
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('customerApi.get', () => {
    it('应该成功获取客户详情', async () => {
      const mockCustomer = {
        id: 1,
        uuid: 'uuid-123',
        code: 'CUST001',
        name: '测试客户',
      }

      vi.mocked(api.get).mockResolvedValue(mockCustomer)

      const result = await customerApi.get('uuid-123')

      expect(api.get).toHaveBeenCalledWith('/apps/master-data/supply-chain/customers/uuid-123')
      expect(result).toEqual(mockCustomer)
    })
  })

  describe('customerApi.update', () => {
    it('应该成功更新客户', async () => {
      const updateData = {
        name: '更新后的客户名称',
      }

      const mockResponse = {
        id: 1,
        uuid: 'uuid-123',
        code: 'CUST001',
        ...updateData,
      }

      vi.mocked(api.put).mockResolvedValue(mockResponse)

      const result = await customerApi.update('uuid-123', updateData as any)

      expect(api.put).toHaveBeenCalledWith(
        '/apps/master-data/supply-chain/customers/uuid-123',
        updateData
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('customerApi.delete', () => {
    it('应该成功删除客户', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined)

      await customerApi.delete('uuid-123')

      expect(api.delete).toHaveBeenCalledWith('/apps/master-data/supply-chain/customers/uuid-123')
    })
  })
})







