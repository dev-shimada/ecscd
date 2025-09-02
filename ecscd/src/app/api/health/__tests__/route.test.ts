import { GET } from '../route'
import { DatabaseFactory } from '@/lib/database/factory'

jest.mock('@/lib/database/factory')

const mockDb = {
  healthCheck: jest.fn(),
}

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(DatabaseFactory.getInstance as jest.Mock).mockReturnValue(mockDb)
  })

  it('should return healthy status when database is healthy', async () => {
    mockDb.healthCheck.mockResolvedValue(true)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.database.healthy).toBe(true)
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('uptime')
    expect(data).toHaveProperty('memory')
  })

  it('should return unhealthy status when database is unhealthy', async () => {
    mockDb.healthCheck.mockResolvedValue(false)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.database.healthy).toBe(false)
    expect(data.error).toBe('Database connection failed')
  })

  it('should handle database healthCheck errors', async () => {
    mockDb.healthCheck.mockRejectedValue(new Error('Database connection error'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.error).toContain('Health check failed: Database connection error')
  })

  it('should include system information in healthy response', async () => {
    mockDb.healthCheck.mockResolvedValue(true)

    const response = await GET()
    const data = await response.json()

    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('environment')
    expect(data.database).toHaveProperty('type')
    expect(data.memory).toHaveProperty('used')
    expect(data.memory).toHaveProperty('total')
    expect(data.memory).toHaveProperty('external')
  })
})