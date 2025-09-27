'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
// import { AWSService } from '@/lib/infrastructure/aws';

interface NewApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ApplicationFormData {
  name: string;
  clusterName: string;
  serviceName: string;
  repository: string;
  branch: string;
  taskDefinitionPath: string;
  roleArn: string;
  externalId: string;
  region?: string;
  sessionName?: string;
}

export function NewApplicationDialog({ open, onOpenChange, onSuccess }: NewApplicationDialogProps) {
  const [formData, setFormData] = useState<ApplicationFormData>({
    name: '',
    clusterName: '',
    serviceName: '',
    repository: '',
    branch: 'main',
    taskDefinitionPath: 'task-definition.json',
    roleArn: '',
    externalId: Math.random().toString(36).substring(2, 15),
    region: 'ap-northeast-1',
    sessionName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<ApplicationFormData>>({});

  const handleInputChange = (field: keyof ApplicationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ApplicationFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Application name is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.name)) {
      newErrors.name = 'Name must contain only lowercase letters, numbers, and hyphens';
    }

    if (!formData.clusterName.trim()) {
      newErrors.clusterName = 'Cluster name is required';
    }

    if (!formData.serviceName.trim()) {
      newErrors.serviceName = 'Service name is required';
    }

    if (!formData.repository.trim()) {
      newErrors.repository = 'Repository URL is required';
    } else if (!isValidGitUrl(formData.repository)) {
      newErrors.repository = 'Please enter a valid Git repository URL';
    }

    if (!formData.branch.trim()) {
      newErrors.branch = 'Branch name is required';
    }

    if (!formData.taskDefinitionPath.trim()) {
      newErrors.taskDefinitionPath = 'Task definition path is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidGitUrl = (url: string): boolean => {
    const gitUrlPattern = /^(https?:\/\/)?([\w\.-]+@)?([\w\.-]+)(:\d+)?(\/.*)?\.git$/i;
    const githubPattern = /^https?:\/\/github\.com\/[\w\.-]+\/[\w\.-]+\/?$/i;
    return gitUrlPattern.test(url) || githubPattern.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          gitConfig: {
            repo: formData.repository,
            branch: formData.branch,
            path: formData.taskDefinitionPath,
          },
          ecsConfig: {
            cluster: formData.clusterName,
            service: formData.serviceName,
          },
          awsConfig: {
            region: formData.region,
            roleArn: formData.roleArn,
            externalId: formData.externalId,
            sessionName: formData.sessionName,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create application');
      }

      // Reset form
      setFormData({
        name: '',
        clusterName: '',
        serviceName: '',
        repository: '',
        branch: 'main',
        taskDefinitionPath: 'task-definition.json',
        roleArn: '',
        externalId: Math.random().toString(36).substring(2, 15),
        region: 'ap-northeast-1',
        sessionName: '',
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create application:', error);
      setErrors({ name: error instanceof Error ? error.message : 'Failed to create application' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setErrors({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogClose onClick={handleClose} />
        <DialogHeader>
          <DialogTitle>Add New Application</DialogTitle>
          <DialogDescription>
            Configure a new ECS service for continuous deployment
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Application Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="my-app"
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clusterName">ECS Cluster</Label>
              <Input
                id="clusterName"
                value={formData.clusterName}
                onChange={(e) => handleInputChange('clusterName', e.target.value)}
                placeholder="production"
                disabled={isSubmitting}
              />
              {errors.clusterName && (
                <p className="text-sm text-red-600">{errors.clusterName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceName">ECS Service</Label>
              <Input
                id="serviceName"
                value={formData.serviceName}
                onChange={(e) => handleInputChange('serviceName', e.target.value)}
                placeholder="my-app-service"
                disabled={isSubmitting}
              />
              {errors.serviceName && (
                <p className="text-sm text-red-600">{errors.serviceName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repository">Git Repository</Label>
            <Input
              id="repository"
              value={formData.repository}
              onChange={(e) => handleInputChange('repository', e.target.value)}
              placeholder="https://github.com/user/repo.git"
              disabled={isSubmitting}
            />
            {errors.repository && (
              <p className="text-sm text-red-600">{errors.repository}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                value={formData.branch}
                onChange={(e) => handleInputChange('branch', e.target.value)}
                placeholder="main"
                disabled={isSubmitting}
              />
              {errors.branch && (
                <p className="text-sm text-red-600">{errors.branch}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskDefinitionPath">Task Definition Path</Label>
              <Input
                id="taskDefinitionPath"
                value={formData.taskDefinitionPath}
                onChange={(e) => handleInputChange('taskDefinitionPath', e.target.value)}
                placeholder="task-definition.json"
                disabled={isSubmitting}
              />
              {errors.taskDefinitionPath && (
                <p className="text-sm text-red-600">{errors.taskDefinitionPath}</p>
              )}
            </div>
          
            <div className="space-y-2">
              <Label htmlFor="roleArn">Role arn</Label>
              <Input
                id="roleArn"
                value={formData.roleArn}
                onChange={(e) => handleInputChange('roleArn', e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/service-role"
                disabled={isSubmitting}
              />
              {errors.roleArn && (
                <p className="text-sm text-red-600">{errors.roleArn}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalId">External ID</Label>
              <Input
                id="externalId"
                value={formData.externalId}
                // onChange={(e) => handleInputChange('awsConfig', e.target.value)}
                readOnly={true}
                placeholder="external-id"
                disabled={true}
              />
              {errors.externalId && (
                <p className="text-sm text-red-600">{errors.externalId}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Application
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
