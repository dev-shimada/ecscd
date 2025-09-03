import { NextRequest } from 'next/server'
import { PUT } from '../route'
import { DatabaseFactory } from '@/lib/database/factory'

jest.mock('@/lib/database/factory')

const mockDb = {
  getApplicationByName: jest.fn(),
  updateApplication: jest.fn(),
  createOrUpdateSyncStatus: jest.fn(),
}

describe('/api/apps/[name]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(DatabaseFactory.getInstance as jest.Mock).mockReturnValue(mockDb)
  })

  describe('PUT', () => {
    const validRequestBody = {
      spec: {
        source: {
          repoURL: 'https://github.com/test/repo.git',
          targetRevision: 'main',
        },
        taskDefinitionPath: 'task-def.json',
      },
      metadata: {
        labels: {
          'ecscd.io/cluster': 'test-cluster',
          'ecscd.io/service': 'test-service',
        },
      },
    }

    const mockExistingApp = {
      id: '1',
      name: 'test-app',
      gitRepository: {
        owner: 'test',
        repo: 'repo',
        branch: 'main',
        token: 'existing-token',
      },
      ecsCluster: 'old-cluster',
      ecsService: 'old-service',
      taskDefinitionPath: 'old-task-def.json',
    }

    it('should update an existing application successfully', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockExistingApp)
      mockDb.updateApplication.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/apps/test-app', {
        method: 'PUT',
        body: JSON.stringify(validRequestBody),
      })

      const response = await PUT(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Application updated successfully')
      
      expect(mockDb.updateApplication).toHaveBeenCalledWith('1', {
        gitRepository: {
          owner: 'test',
          repo: 'repo',
          branch: 'main',
          path: 'task-def.json',
          token: 'existing-token',
        },
        ecsCluster: 'test-cluster',
        ecsService: 'test-service',
        taskDefinitionPath: 'task-def.json',
      })

      expect(mockDb.createOrUpdateSyncStatus).toHaveBeenCalledWith({
        applicationId: '1',
        status: 'OutOfSync',
        revision: '',
        message: 'Configuration updated',
      })
    })

    it('should return 400 for missing required fields', async () => {
      const invalidBody = {
        spec: {
          source: {
            repoURL: 'https://github.com/test/repo.git',
          },
        },
      }

      const request = new NextRequest('http://localhost/api/apps/test-app', {
        method: 'PUT',
        body: JSON.stringify(invalidBody),
      })

      const response = await PUT(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required fields')
    })

    it('should return 404 if application does not exist', async () => {
      mockDb.getApplicationByName.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/apps/nonexistent', {
        method: 'PUT',
        body: JSON.stringify(validRequestBody),
      })

      const response = await PUT(request, { params: Promise.resolve({ name: 'nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Application not found')
    })

    it('should return 400 for invalid repository URL', async () => {
      const invalidBody = {
        ...validRequestBody,
        spec: {
          ...validRequestBody.spec,
          source: {
            repoURL: 'invalid-url',
            targetRevision: 'main',
          },
        },
      }

      mockDb.getApplicationByName.mockResolvedValue(mockExistingApp)

      const request = new NextRequest('http://localhost/api/apps/test-app', {
        method: 'PUT',
        body: JSON.stringify(invalidBody),
      })

      const response = await PUT(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid repository URL format')
    })

    it('should handle database update failure', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockExistingApp)
      mockDb.updateApplication.mockResolvedValue(false)

      const request = new NextRequest('http://localhost/api/apps/test-app', {
        method: 'PUT',
        body: JSON.stringify(validRequestBody),
      })

      const response = await PUT(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update application')
    })

    it('should handle database errors during update', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockExistingApp)
      mockDb.updateApplication.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/apps/test-app', {
        method: 'PUT',
        body: JSON.stringify(validRequestBody),
      })

      const response = await PUT(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update application')
    })

    it('should preserve existing git token when updating', async () => {
      const appWithToken = {
        ...mockExistingApp,
        gitRepository: {
          ...mockExistingApp.gitRepository,
          token: 'secret-token',
        },
      }

      mockDb.getApplicationByName.mockResolvedValue(appWithToken)
      mockDb.updateApplication.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/apps/test-app', {
        method: 'PUT',
        body: JSON.stringify(validRequestBody),
      })

      await PUT(request, { params: Promise.resolve({ name: 'test-app' }) })

      expect(mockDb.updateApplication).toHaveBeenCalledWith('1', expect.objectContaining({
        gitRepository: expect.objectContaining({
          token: 'secret-token',
        }),
      }))
    })
  })
})