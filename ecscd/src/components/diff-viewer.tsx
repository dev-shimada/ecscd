'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DiffDomain } from '@/lib/domain/application';
import { ChevronDown, ChevronRight, Plus, Minus, Edit3, Play } from 'lucide-react';

interface DiffViewerProps {
  diffs: DiffDomain[];
  summary: string;
  onSync?: () => void;
  isLoading?: boolean;
  error?: string;
}

export function DiffViewer({ diffs, summary, onSync, isLoading, error }: DiffViewerProps) {
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
        return <Plus className="h-4 w-4 shrink-0 text-green-600" />;
      case 'Removed':
        return <Minus className="h-4 w-4 shrink-0 text-red-600" />;
      case 'Modified':
        return <Edit3 className="h-4 w-4 shrink-0 text-yellow-600" />;
    }
  };

  const getDiffColor = (type: 'Added' | 'Removed' | 'Modified') => {
    switch (type) {
      case 'Added':
        return 'border-green-200 bg-green-50';
      case 'Removed':
        return 'border-red-200 bg-red-50';
      case 'Modified':
        return 'border-yellow-200 bg-yellow-50';
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
        <div className="flex items-center gap-2">
          <Badge variant="destructive">Error</Badge>
          <h3 className="text-base font-semibold text-gray-900">Configuration Diff Error</h3>
        </div>
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
    return (
      <section className="w-full">
        <div className="flex items-center gap-2">
          <Badge variant="success">In Sync</Badge>
          <h3 className="text-base font-semibold text-gray-900">No Changes Detected</h3>
        </div>
        <div className="mt-3">
          <p className="text-muted-foreground">
            The current task definition matches the target configuration in the repository.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Badge variant="warning">Out of Sync</Badge>
            Configuration Diff
          </h3>
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
              <Badge variant="outline" className="shrink-0">
                {diff.type}
              </Badge>
            </div>

            {expandedItems.has(`${index}-${diff.path}`) && (
              <div className="mt-4 ml-6 space-y-3">
                {diff.type === 'Removed' && diff.current !== undefined && (
                  <div>
                    <div className="text-sm font-medium text-red-700 mb-1">Current (will be removed):</div>
                    <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                      {formatValue(diff.current)}
                    </pre>
                  </div>
                )}

                {diff.type === 'Added' && diff.target !== undefined && (
                  <div>
                    <div className="text-sm font-medium text-green-700 mb-1">New (will be added):</div>
                    <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                      {formatValue(diff.target)}
                    </pre>
                  </div>
                )}

                {diff.type === 'Modified' && (
                  <>
                    {diff.current !== undefined && (
                      <div>
                        <div className="text-sm font-medium text-red-700 mb-1">Current:</div>
                        <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                          {formatValue(diff.current)}
                        </pre>
                      </div>
                    )}
                    {diff.target !== undefined && (
                      <div>
                        <div className="text-sm font-medium text-green-700 mb-1">Target:</div>
                        <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
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
