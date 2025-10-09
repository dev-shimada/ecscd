'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ApplicationCard } from '@/components/application-card';
import { DiffViewer } from '@/components/diff-viewer';
import { NewApplicationDialog } from '@/components/new-application-dialog';
import { EditApplicationDialog } from '@/components/edit-application-dialog';
import { ApplicationDomain, DiffDomain } from '@/lib/domain/application';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, GitBranch } from 'lucide-react';

export default function Home() {
  const [applications, setApplications] = useState<ApplicationDomain[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<{
    error: undefined;
    diffs: DiffDomain[];
    summary: string;
    current: unknown;
    target: unknown;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [showNewAppDialog, setShowNewAppDialog] = useState(false);
  const [showEditAppDialog, setShowEditAppDialog] = useState(false);
  const [editingApp, setEditingApp] = useState<ApplicationDomain | null>(null);
  const [deployingApps, setDeployingApps] = useState<Set<string>>(new Set());
  const previousApplicationsRef = useRef<ApplicationDomain[]>([]);

  useEffect(() => {
    loadApplications();
  }, []);

  // Poll for deployment status every 5 seconds when any app has IN_PROGRESS rolloutState
  useEffect(() => {
    const hasInProgressDeployment = applications.some(app =>
      app.service?.deployments.some(d => d.rolloutState === "IN_PROGRESS")
    );

    if (!hasInProgressDeployment) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/apps');
        const data = await response.json();
        const newApplications = data.applications || [];

        // Compare with previous state to only update if there are actual changes
        const hasChanges = JSON.stringify(newApplications) !== JSON.stringify(previousApplicationsRef.current);

        if (hasChanges) {
          previousApplicationsRef.current = newApplications;
          setApplications(newApplications);
        }
      } catch (error) {
        console.error('Failed to poll applications:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [applications]);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/apps');
      const data = await response.json();
      const newApplications = data.applications || [];
      previousApplicationsRef.current = newApplications;
      setApplications(newApplications);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDiff = async (appName: string) => {
    setSelectedApp(appName);
    setIsDiffLoading(true);
    try {
      const response = await fetch(`/api/apps/${appName}/diff`);
      const data = await response.json();
      setDiffData(data);
    } catch (error) {
      console.error('Failed to load diff:', error);
    } finally {
      setIsDiffLoading(false);
    }
  };

  const handleSync = async (appName: string) => {
    // Add the app to deploying state immediately
    setDeployingApps(prev => new Set(prev).add(appName));

    try {
      const response = await fetch(`/api/apps/${appName}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Sync failed');
      }

      await response.json();

      // Since the sync API is synchronous, handle completion immediately
      setDeployingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appName);
        return newSet;
      });

      // Refresh applications after successful sync
      loadApplications();
    } catch (error) {
      console.error('Failed to start sync:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Sync failed for ${appName}`, {
        description: errorMessage,
      });
      // Remove from deploying state on error
      setDeployingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appName);
        return newSet;
      });
      loadApplications();
    }
  };

  const handleRollback = async (appName: string) => {
    try {
      const response = await fetch(`/api/apps/${appName}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Rollback failed');
      }

      await response.json();

      // Refresh applications after successful rollback
      loadApplications();
    } catch (error) {
      console.error('Failed to start rollback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Rollback failed for ${appName}`, {
        description: errorMessage,
      });
      // Remove from deploying state on error
      setDeployingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(appName);
        return newSet;
      });
      loadApplications();
    }
  };

  const handleSyncFromDiff = async () => {
    if (!selectedApp) return;

    // Add the app to deploying state immediately
    setDeployingApps(prev => new Set(prev).add(selectedApp));

    try {
      const response = await fetch(`/api/apps/${selectedApp}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Sync failed');
      }

      await response.json();

      // Since the sync API is synchronous, handle completion immediately
      setDeployingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedApp);
        return newSet;
      });

      // Refresh applications and diff after successful sync
      loadApplications();
      if (selectedApp) {
        handleViewDiff(selectedApp);
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Sync failed for ${selectedApp}`, {
        description: errorMessage,
      });
      // Remove from deploying state on error
      setDeployingApps(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedApp);
        return newSet;
      });
    }
  };

  const handleEdit = (appName: string) => {
    const app = applications.find(a => a.name === appName);
    if (app) {
      setEditingApp(app);
      setShowEditAppDialog(true);
    }
  };

  const handleDelete = async (appName: string) => {
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appName)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Delete failed');
      }

      // If the deleted app was selected, clear the selection
      if (selectedApp === appName) {
        setSelectedApp(null);
        setDiffData(null);
      }

      // Refresh applications list
      loadApplications();
    } catch (error) {
      console.error('Failed to delete application:', error);
      // You could add toast notification here
    }
  };

  const handleDeploymentComplete = (appName: string) => () => {
    setDeployingApps(prev => {
      const newSet = new Set(prev);
      newSet.delete(appName);
      return newSet;
    });

    // Refresh applications and diff after deployment completes
    loadApplications();
    if (selectedApp === appName) {
      handleViewDiff(appName);
    }
  };

  const getOverallStatus = () => {
    if (applications.length === 0) return { active: 0, inSync: 0, total: 0 };

    const active = applications.filter(app => app.service?.status === 'ACTIVE').length;
    const inSync = applications.filter(app => app.sync.status === 'InSync').length;

    return { active, inSync, total: applications.length };
  };

  const status = getOverallStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <GitBranch className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">ecscd</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={loadApplications} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowNewAppDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Application
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{status.active}</div>
                <Badge variant={status.active === status.total ? 'success' : 'secondary'}>
                  {status.total > 0 ? Math.round((status.active / status.total) * 100) : 0}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                In Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{status.inSync}</div>
                <Badge variant={status.inSync === status.total ? 'success' : 'warning'}>
                  {status.total > 0 ? Math.round((status.inSync / status.total) * 100) : 0}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Applications List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Applications</h2>
              {applications.length > 0 && (
                <span className="text-sm text-gray-600">
                  {applications.length} application{applications.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-600" />
              </div>
            ) : applications.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-gray-600 mb-4">
                    No applications configured yet
                  </div>
                  <Button onClick={() => setShowNewAppDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first application
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <ApplicationCard
                    key={app.name}
                    application={app}
                    onSync={handleSync}
                    onViewDiff={handleViewDiff}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRollback={handleRollback}
                    isDeploymentActive={deployingApps.has(app.name) ||
                      app.service?.deployments.some(d => d.rolloutState === "IN_PROGRESS") ||
                      false}
                    onDeploymentComplete={handleDeploymentComplete(app.name)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Diff Viewer */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">
              {selectedApp ? `Diff: ${selectedApp}` : 'Configuration Diff'}
            </h2>

            {!selectedApp ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-gray-600">
                    Select an application to view its configuration diff
                  </div>
                </CardContent>
              </Card>
            ) : isDiffLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-4" />
                  <div className="text-gray-600">Loading diff...</div>
                </CardContent>
              </Card>
            ) : diffData ? (
              <DiffViewer
                diffs={diffData.diffs || []}
                summary={diffData.summary || 'No summary available'}
                onSync={handleSyncFromDiff}
                isLoading={selectedApp ? (deployingApps.has(selectedApp) ||
                  applications.find(app => app.name === selectedApp)?.service?.deployments.some(d => d.rolloutState === "IN_PROGRESS")) : false}
                error={diffData.error || undefined}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-gray-600">
                    Failed to load diff data
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <NewApplicationDialog
        open={showNewAppDialog}
        onOpenChange={setShowNewAppDialog}
        onSuccess={loadApplications}
      />

      <EditApplicationDialog
        open={showEditAppDialog}
        onOpenChange={setShowEditAppDialog}
        application={editingApp}
        onSuccess={loadApplications}
      />
    </div>
  );
}
