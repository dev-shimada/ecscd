'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApplicationDomain, DiffDomain } from '@/lib/domain/application';
import { ChevronDown, ChevronRight, Plus, Minus, Edit3, Play } from 'lucide-react';

interface DiffViewerProps {
  application?: ApplicationDomain;
  diffs: DiffDomain[];
  summary: string;
  onSync?: () => void;
  isLoading?: boolean;
  error?: string;
  deploymentUrl?: string;
}

export function DiffViewer({
  application,
  diffs,
  summary,
  onSync,
  isLoading,
  error,
  deploymentUrl,
}: DiffViewerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedItems(newExpanded);
  };

  const getDiffIcon = (type: 'Added' | 'Removed' | 'Modified') => {
    switch (type) {
      case 'Added':
        return <Plus className="h-4 w-4 shrink-0 text-emerald-800" />;
      case 'Removed':
        return <Minus className="h-4 w-4 shrink-0 text-rose-800" />;
      case 'Modified':
        return <Edit3 className="h-4 w-4 shrink-0 text-amber-800" />;
    }
  };

  const getDiffColor = (type: 'Added' | 'Removed' | 'Modified') => {
    switch (type) {
      case 'Added':
        return 'border-emerald-800/12 bg-[rgba(16,185,129,0.03)]';
      case 'Removed':
        return 'border-rose-800/12 bg-[rgba(244,63,94,0.03)]';
      case 'Modified':
        return 'border-amber-800/12 bg-[rgba(245,158,11,0.04)]';
    }
  };

  const getDiffValueClass = (type: 'Added' | 'Removed' | 'Modified') => {
    switch (type) {
      case 'Added':
        return 'border-emerald-800/12';
      case 'Removed':
        return 'border-rose-800/12';
      case 'Modified':
        return 'border-amber-800/12';
    }
  };

  const getDiffTextClass = (type: 'Added' | 'Removed' | 'Modified') => {
    switch (type) {
      case 'Added':
        return 'text-emerald-800';
      case 'Removed':
        return 'text-rose-800';
      case 'Modified':
        return 'text-amber-800';
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  if (error) {
    return (
      <section className="w-full">
        <h2 className="text-lg font-semibold text-gray-900">Configuration Diff</h2>
        <div className="mt-3">
          <p className="text-red-600 mb-2">{error}</p>
          <p className="text-muted-foreground text-sm">
            Please check your application configuration and try again.
          </p>
        </div>
      </section>
    );
  }

  if (!diffs || diffs.length === 0) {
    const status = application?.status;
    const statusTextClass =
      status === 'Failed'
        ? 'text-rose-700'
        : status === 'Deploying'
          ? 'text-amber-700'
          : 'text-muted-foreground';

    return (
      <section className="w-full">
        <h2 className="text-lg font-semibold text-gray-900">Configuration Diff</h2>
        <div className="mt-3">
          {status === 'Loading' ? (
            <p className="text-muted-foreground">
              Loading configuration diff...
            </p>
          ) : status === 'Deploying' ? (
            <>
              <p className={statusTextClass}>
                Deployment is currently in progress.
              </p>
              {deploymentUrl ? (
                <a
                  href={deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-sm text-gray-900 hover:underline"
                >
                  View latest deployment
                </a>
              ) : null}
            </>
          ) : status === 'Failed' ? (
            <>
              <p className={statusTextClass}>
                Last deployment failed.
              </p>
              {deploymentUrl ? (
                <a
                  href={deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-sm text-gray-900 hover:underline"
                >
                  View last deployment
                </a>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">
              The current task definition matches the target configuration in the repository.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Configuration Diff</h2>
          {onSync && (
            <Button
              onClick={onSync}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Play className={`h-4 w-4 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Deploying...' : 'Sync Changes'}
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      </div>

      <div className="mt-4 space-y-4">
        {diffs?.map((diff, index) => (
          <div key={index} className={`border rounded-lg p-4 ${getDiffColor(diff.type)}`}>
            <div
              className="flex items-center gap-2 cursor-pointer min-w-0"
              onClick={() => toggleExpanded(`${index}-${diff.path}`)}
            >
              {expandedItems.has(`${index}-${diff.path}`) ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              {getDiffIcon(diff.type)}
              <span className="font-medium min-w-0 break-all">{diff.path}</span>
            </div>

            {expandedItems.has(`${index}-${diff.path}`) && (
              <div className="mt-4 ml-6 space-y-3">
                {diff.type === 'Removed' && diff.current !== undefined && (
                  <div>
                    <div className={`text-sm font-medium mb-1 ${getDiffTextClass(diff.type)}`}>Current (will be removed):</div>
                    <pre className={`text-xs text-gray-900 p-3 rounded border overflow-x-auto ${getDiffValueClass(diff.type)}`}>
                      {formatValue(diff.current)}
                    </pre>
                  </div>
                )}

                {diff.type === 'Added' && diff.target !== undefined && (
                  <div>
                    <div className={`text-sm font-medium mb-1 ${getDiffTextClass(diff.type)}`}>New (will be added):</div>
                    <pre className={`text-xs text-gray-900 p-3 rounded border overflow-x-auto ${getDiffValueClass(diff.type)}`}>
                      {formatValue(diff.target)}
                    </pre>
                  </div>
                )}

                {diff.type === 'Modified' && (
                  <>
                    {diff.current !== undefined && (
                      <div>
                        <div className={`text-sm font-medium mb-1 ${getDiffTextClass(diff.type)}`}>Current:</div>
                        <pre className={`text-xs text-gray-900 p-3 rounded border overflow-x-auto ${getDiffValueClass(diff.type)}`}>
                          {formatValue(diff.current)}
                        </pre>
                      </div>
                    )}
                    {diff.target !== undefined && (
                      <div>
                        <div className={`text-sm font-medium mb-1 ${getDiffTextClass(diff.type)}`}>Target:</div>
                        <pre className={`text-xs text-gray-900 p-3 rounded border overflow-x-auto ${getDiffValueClass(diff.type)}`}>
                          {formatValue(diff.target)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
