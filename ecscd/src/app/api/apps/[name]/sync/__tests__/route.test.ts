import { NextRequest } from 'next/server'
import { POST } from '../route'
import { DatabaseFactory } from '@/lib/database/factory'
import { GitHubService } from '@/lib/github'
import { DeploymentService } from '@/lib/deployment'

jest.mock('@/lib/database/factory')
jest.mock('@/lib/github')
jest.mock('@/lib/deployment')

const mockDb = {
  getApplicationByName: jest.fn(),
  createOrUpdateSyncStatus: jest.fn(),
}

const mockGitHubService = {
  getFileContent: jest.fn(),
}

const mockDeploymentService = {
  executeDeploymentSync: jest.fn(),
}

describe('/api/apps/[name]/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(DatabaseFactory.getInstance as jest.Mock).mockReturnValue(mockDb)
    ;(GitHubService as jest.MockedClass<typeof GitHubService>).mockImplementation(() => mockGitHubService as any)
    ;(DeploymentService as jest.MockedClass<typeof DeploymentService>).mockImplementation(() => mockDeploymentService as any)
  })

  const mockApp = {
    id: '1',
    name: 'test-app',
    gitRepository: {
      owner: 'test',
      repo: 'repo',
      branch: 'main',
      token: 'test-token',
    },
    taskDefinitionPath: 'task-def.json',
    ecsCluster: 'test-cluster',
    ecsService: 'test-service',
  }

  const mockTaskDef = {
    family: 'test-task',
    taskDefinitionArn: 'arn:aws:ecs:region:account:task-definition/test-task:1',
    containerDefinitions: [
      {
        name: 'test-container',
        image: 'nginx:latest',
      },
    ],
  }

  describe('POST', () => {
    it('should perform dry run successfully', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockResolvedValue(JSON.stringify(mockTaskDef))

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      })

      const response = await POST(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.dryRun).toBe(true)
      expect(data.message).toBe('Dry run completed successfully')
      expect(data.application).toBe('test-app')
      expect(mockDeploymentService.executeDeploymentSync).not.toHaveBeenCalled()
    })

    it('should sync application successfully', async () => {
      const mockDeployment = {
        status: 'Successful',
        message: 'Deployment completed',
        startedAt: new Date('2023-01-01T00:00:00Z'),
        finishedAt: new Date('2023-01-01T00:05:00Z'),
        progress: 100,
        events: ['Deployment started', 'Service updated'],
        registeredTaskDefArn: 'arn:aws:ecs:region:account:task-definition/test-task:2',
      }

      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockResolvedValue(JSON.stringify(mockTaskDef))
      mockDeploymentService.executeDeploymentSync.mockResolvedValue(mockDeployment)

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({ dryRun: false }),
      })

      const response = await POST(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.application).toBe('test-app')
      expect(data.status).toBe('Successful')
      expect(data.message).toBe('Deployment completed')
      expect(data.startedAt).toBe('2023-01-01T00:00:00.000Z')
      expect(data.finishedAt).toBe('2023-01-01T00:05:00.000Z')

      expect(mockDeploymentService.executeDeploymentSync).toHaveBeenCalledWith(
        expect.stringContaining('deployment-'),
        '1',
        'test-cluster',
        'test-service',
        mockTaskDef
      )

      expect(mockDb.createOrUpdateSyncStatus).toHaveBeenCalledWith({
        applicationId: '1',
        status: 'Synced',
        revision: 'arn:aws:ecs:region:account:task-definition/test-task:2',
        lastSyncedAt: expect.any(Date),
        message: 'Deployment completed',
      })
    })

    it('should return 404 if application not found', async () => {
      mockDb.getApplicationByName.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/apps/nonexistent/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request, { params: Promise.resolve({ name: 'nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Application not found')
    })

    it('should return 404 if task definition not found in repository', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Target task definition not found in repository')
    })

    it('should return 400 for invalid task definition format', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockResolvedValue('invalid json')

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid task definition format in repository')
    })

    it('should handle deployment failure', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockResolvedValue(JSON.stringify(mockTaskDef))
      mockDeploymentService.executeDeploymentSync.mockRejectedValue(new Error('ECS deployment failed'))

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to sync application')

      expect(mockDb.createOrUpdateSyncStatus).toHaveBeenCalledWith({
        applicationId: '1',
        status: 'OutOfSync',
        revision: 'arn:aws:ecs:region:account:task-definition/test-task:1',
        lastSyncedAt: expect.any(Date),
        message: 'ECS deployment failed',
      })
    })

    it('should use correct revision ARN priority', async () => {
      const mockDeployment = {
        status: 'Successful',
        message: 'Deployment completed',
        startedAt: new Date(),
        finishedAt: new Date(),
        progress: 100,
        events: [],
        registeredTaskDefArn: 'arn:aws:ecs:region:account:task-definition/test-task:3',
      }

      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockResolvedValue(JSON.stringify(mockTaskDef))
      mockDeploymentService.executeDeploymentSync.mockResolvedValue(mockDeployment)

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      await POST(request, { params: Promise.resolve({ name: 'test-app' }) })

      expect(mockDb.createOrUpdateSyncStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          revision: 'arn:aws:ecs:region:account:task-definition/test-task:3',
        })
      )
    })

    it('should fallback to target task definition ARN if no registered ARN', async () => {
      const mockDeployment = {
        status: 'Successful',
        message: 'Deployment completed',
        startedAt: new Date(),
        finishedAt: new Date(),
        progress: 100,
        events: [],
        registeredTaskDefArn: null,
      }

      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockResolvedValue(JSON.stringify(mockTaskDef))
      mockDeploymentService.executeDeploymentSync.mockResolvedValue(mockDeployment)

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      await POST(request, { params: Promise.resolve({ name: 'test-app' }) })

      expect(mockDb.createOrUpdateSyncStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          revision: 'arn:aws:ecs:region:account:task-definition/test-task:1',
        })
      )
    })

    it('should handle GitHub API errors', async () => {
      mockDb.getApplicationByName.mockResolvedValue(mockApp)
      mockGitHubService.getFileContent.mockRejectedValue(new Error('GitHub API error'))

      const request = new NextRequest('http://localhost/api/apps/test-app/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request, { params: Promise.resolve({ name: 'test-app' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to sync application')
    })
  })
})