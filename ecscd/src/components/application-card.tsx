'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Application } from '@/types/ecs';
import { DeploymentProgress } from '@/components/deployment-progress';
import { GitBranch, RefreshCw, Play, ExternalLink, Clock, Trash2, Edit } from 'lucide-react';

interface ApplicationCardProps {
  application: Application;
  onSync?: (appName: string) => void;
  onViewDiff?: (appName: string) => void;
  onEdit?: (appName: string) => void;
  onDelete?: (appName: string) => void;
  isDeploymentActive?: boolean;
  onDeploymentComplete?: (status: 'Successful' | 'Failed') => void;
}

export function ApplicationCard({ 
  application, 
  onSync, 
  onViewDiff,
  onEdit,
  onDelete,
  isDeploymentActive = false,
  onDeploymentComplete 
}: ApplicationCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'Synced':
        return 'success';
      case 'OutOfSync':
        return 'warning';
      case 'Error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getHealthStatusColor = (health: string) => {
    switch (health) {
      case 'Healthy':
        return 'success';
      case 'Progressing':
        return 'warning';
      case 'Degraded':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getDeploymentStatusColor = (status: string) => {
    switch (status) {
      case 'PRIMARY':
        return 'success';
      case 'ACTIVE':
        return 'success';
      case 'PENDING':
      case 'RUNNING':
        return 'warning';
      case 'DRAINING':
        return 'warning';
      case 'INACTIVE':
      case 'STOPPED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getRolloutStateColor = (rolloutState: string) => {
    switch (rolloutState) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'warning';
      case 'FAILED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const handleSync = () => {
    setIsLoading(true);
    onSync?.(application.metadata.name);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    onDelete?.(application.metadata.name);
  };

  const handleLocalDeploymentComplete = (status: 'Successful' | 'Failed') => {
    setIsLoading(false);
    
    // Call parent callback
    onDeploymentComplete?.(status);
  };

  const formatLastSyncTime = (date?: Date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const dateObj = date instanceof Date ? date : new Date(date);
    const diff = now.getTime() - dateObj.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const extractRevisionFromArn = (revision?: string) => {
    console.log('extractRevisionFromArn input:', revision);
    
    if (!revision) return null;
    
    // If it's a task definition ARN, extract the revision number
    if (revision.includes(':task-definition/')) {
      const parts = revision.split(':');
      const familyAndRevision = parts[parts.length - 1]; // e.g., "my-task:123"
      const revisionPart = familyAndRevision.split(':')[1]; // e.g., "123"
      const result = revisionPart || familyAndRevision;
      console.log('Extracted from task definition ARN:', result);
      return result;
    }
    
    // If it starts with "deployment-", show first 8 characters
    if (revision.startsWith('deployment-')) {
      const result = revision.substring(0, 8);
      console.log('Extracted from deployment ID:', result);
      return result;
    }
    
    // Otherwise, show first 8 characters
    const result = revision.substring(0, 8);
    console.log('Extracted fallback:', result);
    return result;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {application.metadata.name}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant={getHealthStatusColor(application.status?.health || 'Unknown')}>
              {application.status?.health || 'Unknown'}
            </Badge>
            <Badge variant={getSyncStatusColor(application.status?.sync.status || 'Unknown')}>
              {application.status?.sync.status || 'Unknown'}
            </Badge>
          </div>
        </div>
        <CardDescription className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          {application.spec.gitRepository.owner}/{application.spec.gitRepository.repo}
          {application.spec.gitRepository.branch && (
            <span className="text-gray-500">
              @ {application.spec.gitRepository.branch}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-600">ECS Cluster</div>
              <div>{application.spec.ecsCluster}</div>
            </div>
            <div>
              <div className="font-medium text-gray-600">ECS Service</div>
              <div>{application.spec.ecsService}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            Last synced: {formatLastSyncTime(application.status?.sync.lastSyncedAt)}
          </div>

          {application.status?.sync.revision && (
            <div className="text-sm">
              <span className="font-medium text-gray-600">Revision: </span>
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                {extractRevisionFromArn(application.status.sync.revision)}
              </code>
            </div>
          )}

          {application.status?.sync.deploymentStatus && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-600">Latest Deployment</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span>
                  <Badge 
                    variant={getDeploymentStatusColor(application.status.sync.deploymentStatus.status)}
                    className="ml-2"
                  >
                    {application.status.sync.deploymentStatus.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-500">Tasks:</span>
                  <span className="ml-2 font-mono">
                    {application.status.sync.deploymentStatus.runningCount}/
                    {application.status.sync.deploymentStatus.desiredCount}
                  </span>
                </div>
              </div>
              {application.status.sync.deploymentStatus.rolloutState && (
                <div className="text-sm">
                  <span className="text-gray-500">Rollout:</span>
                  <Badge 
                    variant={getRolloutStateColor(application.status.sync.deploymentStatus.rolloutState)}
                    className="ml-2"
                  >
                    {application.status.sync.deploymentStatus.rolloutState}
                  </Badge>
                  {application.status.sync.deploymentStatus.rolloutStateReason && (
                    <div className="text-xs text-gray-500 mt-1">
                      {application.status.sync.deploymentStatus.rolloutStateReason}
                    </div>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500">
                <div>
                  Created: {formatLastSyncTime(application.status.sync.deploymentStatus.createdAt)}
                </div>
                <div>
                  Updated: {formatLastSyncTime(application.status.sync.deploymentStatus.updatedAt)}
                </div>
              </div>
            </div>
          )}

          {application.status?.operationState && (
            <div className="p-3 bg-gray-100 rounded-md">
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${
                  application.status.operationState.phase === 'Running' ? 'animate-spin' : ''
                }`} />
                <span className="font-medium">
                  {application.status.operationState.phase}
                </span>
              </div>
              {application.status.operationState.message && (
                <p className="text-sm text-gray-600 mt-1">
                  {application.status.operationState.message}
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Deployment Progress */}
        {isDeploymentActive && (
          <div className="mt-4">
            <DeploymentProgress
              applicationName={application.metadata.name}
              isDeploymentActive={isDeploymentActive}
              onDeploymentComplete={handleLocalDeploymentComplete}
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiff?.(application.metadata.name)}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          View Diff
        </Button>
        
        <Button
          size="sm"
          onClick={handleSync}
          disabled={isLoading || isDeploymentActive || application.status?.operationState?.phase === 'Running'}
          className="flex items-center gap-2"
        >
          <Play className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isDeploymentActive ? 'Deploying...' : isLoading ? 'Starting...' : 'Sync'}
        </Button>

        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit?.(application.metadata.name)}
            disabled={isDeploymentActive || application.status?.operationState?.phase === 'Running'}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}

        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeploymentActive || application.status?.operationState?.phase === 'Running'}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}

        {application.spec.autoSync && (
          <Badge variant="outline" className="ml-auto">
            Auto-sync
          </Badge>
        )}
      </CardFooter>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Application</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete &quot;{application.metadata.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}