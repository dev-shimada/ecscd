import { NextRequest } from 'next/server'
import { GET, POST, DELETE } from '../route'
import { DatabaseFactory } from '@/lib/database/factory'
import { AWSService } from '@/lib/aws'
import { GitHubService } from '@/lib/github'
import { DiffService } from '@/lib/diff'

// Mock dependencies
jest.mock('@/lib/database/factory')
jest.mock('@/lib/aws')
jest.mock('@/lib/github')
jest.mock('@/lib/diff')

const mockDb = {
  getAllApplications: jest.fn(),
  getSyncStatus: jest.fn(),
  getApplicationStatus: jest.fn(),
  createOrUpdateSyncStatus: jest.fn(),
  getApplicationByName: jest.fn(),
  createApplication: jest.fn(),
  createOrUpdateApplicationStatus: jest.fn(),
  deleteSyncStatus: jest.fn(),
  deleteApplicationStatus: jest.fn(),
  getDeploymentsByApplication: jest.fn(),
  deleteDeploymentEvents: jest.fn(),
  deleteDeployment: jest.fn(),
  deleteApplication: jest.fn(),
}

const mockAWSService = {
  getService: jest.fn(),
  getTaskDefinition: jest.fn(),
  getDeploymentInfo: jest.fn(),
}

const mockGitHubService = {
  getFileContent: jest.fn(),
}

describe('/api/apps', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(DatabaseFactory.getInstance as jest.Mock).mockReturnValue(mockDb)
    ;(AWSService as jest.MockedClass<typeof AWSService>).mockImplementation(() => mockAWSService as any)
    ;(GitHubService as jest.MockedClass<typeof GitHubService>).mockImplementation(() => mockGitHubService as any)
  })

  describe('GET', () => {
    it('should return empty applications list when no applications exist', async () => {
      mockDb.getAllApplications.mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ applications: [] })
    })

    it('should return applications with sync status', async () => {
      const mockDbApp = {
        id: '1',
        name: 'test-app',
        gitRepository: { owner: 'test', repo: 'repo', branch: 'main' },
        ecsCluster: 'test-cluster',
        ecsService: 'test-service',
        taskDefinitionPath: 'task-def.json',
        autoSync: false,
        syncPolicy: { automated: false, selfHeal: false, prune: false },
        awsConfig: undefined,
      }

      const mockSyncStatus = {
        status: 'Synced',
        revision: 'task-def:1',
        lastSyncedAt: '2023-01-01T00:00:00Z',
        message: 'Configuration matches target',
      }

      const mockAppStatus = {
        health: 'Healthy',
        operationState: undefined,
      }

      const mockECSService = {
        taskDefinition: 'task-def:1',
      }

      const mockTaskDef = {
        family: 'test-task',
        revision: 1,
      }

      const mockTargetTaskDef = JSON.stringify({
        family: 'test-task',
        revision: 1,
      })

      mockDb.getAllApplications.mockResolvedValue([mockDbApp])
      mockDb.getSyncStatus.mockResolvedValue(mockSyncStatus)
      mockDb.getApplicationStatus.mockResolvedValue(mockAppStatus)
      mockAWSService.getService.mockResolvedValue(mockECSService)
      mockAWSService.getTaskDefinition.mockResolvedValue(mockTaskDef)
      mockAWSService.getDeploymentInfo.mockResolvedValue([])
      mockGitHubService.getFileContent.mockResolvedValue(mockTargetTaskDef)
      ;(DiffService.compareTaskDefinitions as jest.Mock).mockReturnValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.applications).toHaveLength(1)
      expect(data.applications[0].metadata.name).toBe('test-app')
      expect(data.applications[0].status.sync.status).toBe('Synced')
    })

    it('should handle AWS service errors gracefully', async () => {
      const mockDbApp = {
        id: '1',
        name: 'test-app',
        gitRepository: { owner: 'test', repo: 'repo', branch: 'main' },
        ecsCluster: 'test-cluster',
        ecsService: 'test-service',
        taskDefinitionPath: 'task-def.json',
        autoSync: false,
        syncPolicy: { automated: false, selfHeal: false, prune: false },
        awsConfig: undefined,
      }

      mockDb.getAllApplications.mockResolvedValue([mockDbApp])
      mockDb.getSyncStatus.mockResolvedValue(null)
      mockDb.getApplicationStatus.mockResolvedValue(null)
      mockAWSService.getService.mockRejectedValue(new Error('AWS Error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.applications[0].status.sync.status).toBe('Error')
      expect(data.applications[0].status.sync.message).toContain('Failed to connect to ECS')
    })

    it('should handle database errors', async () => {
      mockDb.getAllApplications.mockRejectedValue(new Error('Database error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch applications')
    })
  })

  describe('POST', () => {
    const validRequestBody = {
      name: 'new-app',
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

    it('should create a new application successfully', async () => {
      const mockCreatedApp = {
        id: '1',
        name: 'new-app',
        gitRepository: { owner: 'test', repo: 'repo', branch: 'main' },
        ecsCluster: 'test-cluster',
        ecsService: 'test-service',
        taskDefinitionPath: 'task-def.json',
        autoSync: false,
        syncPolicy: { automated: false, selfHeal: false, prune: false },
        awsConfig: undefined,
      }

      mockDb.getApplicationByName.mockResolvedValue(null)
      mockDb.createApplication.mockResolvedValue(mockCreatedApp)

      const request = new NextRequest('http://localhost/api/apps', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.application.metadata.name).toBe('new-app')
      expect(mockDb.createApplication).toHaveBeenCalled()
      expect(mockDb.createOrUpdateSyncStatus).toHaveBeenCalled()
      expect(mockDb.createOrUpdateApplicationStatus).toHaveBeenCalled()
    })

    it('should return 400 for missing required fields', async () => {
      const invalidBody = {
        name: 'new-app',
      }

      const request = new NextRequest('http://localhost/api/apps', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required fields')
    })

    it('should return 409 if application already exists', async () => {
      mockDb.getApplicationByName.mockResolvedValue({ id: '1', name: 'new-app' })

      const request = new NextRequest('http://localhost/api/apps', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Application with this name already exists')
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

      mockDb.getApplicationByName.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/apps', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid repository URL format')
    })

    it('should handle database errors during creation', async () => {
      mockDb.getApplicationByName.mockResolvedValue(null)
      mockDb.createApplication.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/apps', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to create application')
    })
  })

  describe('DELETE', () => {
    it('should delete an existing application successfully', async () => {
      const mockApp = {
        id: '1',
        name: 'test-app',
      }

      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockDb.getDeploymentsByApplication.mockResolvedValue([])
      mockDb.deleteApplication.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/apps?name=test-app', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Application deleted successfully')
      expect(mockDb.deleteSyncStatus).toHaveBeenCalledWith('1')
      expect(mockDb.deleteApplicationStatus).toHaveBeenCalledWith('1')
      expect(mockDb.deleteApplication).toHaveBeenCalledWith('1')
    })

    it('should return 400 if name parameter is missing', async () => {
      const request = new NextRequest('http://localhost/api/apps', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Application name is required')
    })

    it('should return 404 if application does not exist', async () => {
      mockDb.getApplicationByName.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/apps?name=nonexistent', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Application not found')
    })

    it('should delete related deployments and events', async () => {
      const mockApp = {
        id: '1',
        name: 'test-app',
      }

      const mockDeployments = [
        { id: 'dep1' },
        { id: 'dep2' },
      ]

      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockDb.getDeploymentsByApplication.mockResolvedValue(mockDeployments)
      mockDb.deleteApplication.mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/apps?name=test-app', {
        method: 'DELETE',
      })

      const response = await DELETE(request)

      expect(response.status).toBe(200)
      expect(mockDb.deleteDeploymentEvents).toHaveBeenCalledWith('dep1')
      expect(mockDb.deleteDeploymentEvents).toHaveBeenCalledWith('dep2')
      expect(mockDb.deleteDeployment).toHaveBeenCalledWith('dep1')
      expect(mockDb.deleteDeployment).toHaveBeenCalledWith('dep2')
    })

    it('should handle database errors during deletion', async () => {
      const mockApp = {
        id: '1',
        name: 'test-app',
      }

      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockDb.getDeploymentsByApplication.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/apps?name=test-app', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete application')
    })
  })
})