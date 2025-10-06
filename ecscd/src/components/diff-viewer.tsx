'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'Removed':
        return <Minus className="h-4 w-4 text-red-600" />;
      case 'Modified':
        return <Edit3 className="h-4 w-4 text-yellow-600" />;
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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="destructive">Error</Badge>
            Configuration Diff Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-2">{error}</p>
          <p className="text-muted-foreground text-sm">
            Please check your application configuration and try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!diffs || diffs.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="success">In Sync</Badge>
            No Changes Detected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The current task definition matches the target configuration in the repository.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Badge variant="warning">Out of Sync</Badge>
            Configuration Diff
          </CardTitle>
          <Button
            onClick={onSync}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Play className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Deploying...' : 'Sync Changes'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {diffs?.map((diff, index) => (
            <div key={index} className={`border rounded-lg p-4 ${getDiffColor(diff.type)}`}>
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => toggleExpanded(`${index}-${diff.path}`)}
              >
                {expandedItems.has(`${index}-${diff.path}`) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {getDiffIcon(diff.type)}
                <span className="font-medium">{diff.path}</span>
                <Badge variant="outline" className="ml-auto">
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
      </CardContent>
    </Card>
  );
}
