'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, XCircle, Loader2 } from 'lucide-react';

interface DeploymentEvent {
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error';
}

interface DeploymentProgress {
  current: number;
  total: number;
  message: string;
}

interface DeploymentStatus {
  id: string;
  status: 'InProgress' | 'Successful' | 'Failed' | 'Stopped';
  message: string;
  startedAt: Date;
  finishedAt?: Date;
  progress: DeploymentProgress;
  events: DeploymentEvent[];
}

interface DeploymentProgressProps {
  applicationName: string;
  isDeploymentActive: boolean;
  onDeploymentComplete?: (status: 'Successful' | 'Failed') => void;
}

export function DeploymentProgress({ 
  applicationName, 
  isDeploymentActive, 
  onDeploymentComplete 
}: DeploymentProgressProps) {
  const [deployment, setDeployment] = useState<DeploymentStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDeploymentActive) {
      setDeployment(null);
      setIsConnected(false);
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectToDeploymentStream = () => {
      setError(null);
      let deploymentCompleted = false;
      
      try {
        eventSource = new EventSource(`/api/apps/${applicationName}/sync-stream`);
        
        eventSource.onopen = () => {
          console.log('SSE connection opened');
          setIsConnected(true);
          reconnectAttempts = 0; // Reset on successful connection
        };

        eventSource.onmessage = (event) => {
          console.log('SSE message received:', {
            rawData: event.data,
            dataLength: event.data?.length || 0,
            dataType: typeof event.data
          });
          try {
            // Check if we received empty or invalid data
            if (!event.data || event.data.trim() === '' || event.data === '{}') {
              console.warn('Received empty or invalid SSE data:', {
                rawData: event.data,
                isEmpty: !event.data,
                isWhitespace: event.data?.trim() === '',
                isEmptyObject: event.data === '{}'
              });
              // Don't set error for empty data, just ignore it
              return;
            }
            
            const data = JSON.parse(event.data);
            console.log('Parsed SSE data:', {
              type: data?.type,
              hasMessage: !!data?.message,
              hasError: !!data?.error,
              keys: data && typeof data === 'object' ? Object.keys(data) : 'N/A'
            });
            
            // Check if parsed data is empty or missing required fields
            if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
              console.warn('Received empty or invalid parsed data:', data);
              // Don't set error for empty objects, just ignore them
              return;
            }
            
            // Check if it's missing the type field entirely
            if (!data.type) {
              console.warn('Received data without type field:', data);
              // Try to infer if this is an error based on content
              if (data.status === 'Failed' || data.error || data.message?.includes('error') || data.message?.includes('fail')) {
                data.type = 'error';
              } else {
                // Don't treat missing type as a hard error - just ignore the message
                console.warn('Ignoring malformed message from server (no type field)');
                return;
              }
            }
            
            switch (data.type) {
              case 'status':
              case 'progress':
                setDeployment(prev => ({
                  ...data,
                  startedAt: new Date(data.startedAt),
                  finishedAt: data.finishedAt ? new Date(data.finishedAt) : undefined,
                  events: data.events?.map((e: Omit<DeploymentEvent, 'timestamp'> & { timestamp: string }) => ({
                    ...e,
                    timestamp: new Date(e.timestamp)
                  })) || prev?.events || []
                }));
                break;
                
              case 'complete':
                deploymentCompleted = true;
                setDeployment({
                  ...data,
                  startedAt: new Date(data.startedAt),
                  finishedAt: data.finishedAt ? new Date(data.finishedAt) : undefined,
                  events: data.events?.map((e: Omit<DeploymentEvent, 'timestamp'> & { timestamp: string }) => ({
                    ...e,
                    timestamp: new Date(e.timestamp)
                  }))
                });
                setIsConnected(false);
                // Close the EventSource connection
                if (eventSource) {
                  eventSource.close();
                }
                onDeploymentComplete?.(data.status);
                break;
                
              case 'error':
                deploymentCompleted = true;
                
                // Helper function to check if error data is meaningful
                const isValidErrorData = (errorData: unknown): boolean => {
                  if (!errorData || typeof errorData !== 'object') {
                    return typeof errorData === 'string' && errorData.trim().length > 0;
                  }

                  const errorObj = errorData as Record<string, unknown>;
                  const keys = Object.keys(errorObj);
                  // Must have more than just 'type' field
                  const meaningfulKeys = keys.filter(key => key !== 'type');

                  if (meaningfulKeys.length === 0) return false;

                  // Check if any meaningful field has actual content
                  return meaningfulKeys.some(key => {
                    const value = errorObj[key];
                    if (typeof value === 'string') return value.trim().length > 0;
                    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
                    return value !== undefined && value !== null;
                  });
                };
                
                // Early return for invalid/empty error data
                if (!isValidErrorData(data)) {
                  console.warn('Deployment failed - received empty or invalid error data from server');
                  const fallbackError = 'Deployment failed with no error details provided';
                  
                  setDeployment(prev => prev ? {
                    ...prev,
                    status: 'Failed',
                    message: fallbackError,
                    finishedAt: new Date()
                  } : {
                    id: 'unknown',
                    status: 'Failed',
                    message: fallbackError,
                    startedAt: new Date(),
                    finishedAt: new Date(),
                    progress: { current: 0, total: 4, message: 'Deployment failed' },
                    events: [{
                      timestamp: new Date(),
                      message: fallbackError,
                      type: 'error'
                    }]
                  });
                  setError(fallbackError);
                  setIsConnected(false);
                  if (eventSource) eventSource.close();
                  onDeploymentComplete?.('Failed');
                  return;
                }
                
                // Extract error message with proper fallbacks
                const extractErrorMessage = (errorData: unknown): string => {
                  if (typeof errorData === 'string') return errorData.trim();

                  if (errorData && typeof errorData === 'object') {
                    const errorObj = errorData as Record<string, unknown>;
                    // Try common error message fields in order of preference
                    const messageFields = ['message', 'error', 'errorMessage', 'details', 'reason', 'cause'];
                    for (const field of messageFields) {
                      const value = errorObj[field];
                      if (typeof value === 'string' && value.trim().length > 0) {
                        return value.trim();
                      }
                    }
                  }
                  
                  return 'Deployment failed with unspecified error';
                };
                
                const errorMessage = extractErrorMessage(data);
                
                // Log error with structured information
                console.error('Deployment failed:', {
                  message: errorMessage,
                  deploymentId: data?.deploymentId,
                  status: data?.status,
                  timestamp: new Date().toISOString(),
                  ...(data?.finishedAt && { finishedAt: data.finishedAt })
                });
                
                setDeployment(prev => prev ? {
                  ...prev,
                  status: 'Failed',
                  message: errorMessage,
                  finishedAt: new Date(data?.finishedAt || Date.now())
                } : {
                  id: data?.deploymentId || 'unknown',
                  status: 'Failed',
                  message: errorMessage,
                  startedAt: new Date(),
                  finishedAt: new Date(data?.finishedAt || Date.now()),
                  progress: { current: 0, total: 4, message: 'Deployment failed' },
                  events: [{
                    timestamp: new Date(),
                    message: errorMessage,
                    type: 'error'
                  }]
                });
                setError(errorMessage);
                setIsConnected(false);
                if (eventSource) {
                  eventSource.close();
                }
                onDeploymentComplete?.('Failed');
                break;
                
              default:
                // Handle unknown message types or malformed data
                console.warn('Unknown deployment message type:', {
                  type: data.type,
                  data: data
                });
                // If this looks like an error but wasn't caught above
                if (data && (data.status === 'Failed' || data.error || data.message?.includes('error') || data.message?.includes('fail'))) {
                  deploymentCompleted = true;
                  const fallbackErrorMessage = data.message || data.error || 'Deployment failed with unknown error';
                  console.error('Fallback error handling triggered:', {
                    message: fallbackErrorMessage,
                    originalType: data.type,
                    dataKeys: Object.keys(data || {})
                  });
                  
                  setDeployment(prev => prev ? {
                    ...prev,
                    status: 'Failed',
                    message: fallbackErrorMessage,
                    finishedAt: new Date()
                  } : {
                    id: data?.deploymentId || 'unknown',
                    status: 'Failed',
                    message: fallbackErrorMessage,
                    startedAt: new Date(),
                    finishedAt: new Date(),
                    progress: { current: 0, total: 4, message: 'Deployment failed' },
                    events: [{
                      timestamp: new Date(),
                      message: fallbackErrorMessage,
                      type: 'error'
                    }]
                  });
                  setError(fallbackErrorMessage);
                  setIsConnected(false);
                  if (eventSource) {
                    eventSource.close();
                  }
                  onDeploymentComplete?.('Failed');
                }
                break;
            }
          } catch (err) {
            console.error('Error parsing deployment event:', {
              error: err instanceof Error ? err.message : String(err),
              rawData: event.data,
              eventType: event.type
            });
            setError(`Invalid response format from server: ${event.data.substring(0, 100)}${event.data.length > 100 ? '...' : ''}`);
          }
        };

        eventSource.onerror = (event) => {
          console.log('SSE error event:', event, 'ReadyState:', eventSource?.readyState);
          setIsConnected(false);
          
          // Check if the deployment has already completed
          if (deploymentCompleted) {
            console.log('SSE closed after deployment completion - this is normal');
            return; // Don't treat this as an error
          }
          
          if (eventSource?.readyState === EventSource.CLOSED) {
            if (reconnectAttempts < maxReconnectAttempts) {
              setError(`Connection lost. Retrying... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
              reconnectAttempts++;
              
              reconnectTimeout = setTimeout(() => {
                connectToDeploymentStream();
              }, 2000 * reconnectAttempts); // Exponential backoff
            } else {
              setError('Connection to deployment stream lost. Max retries exceeded.');
            }
          } else {
            setError('Connection to deployment stream lost');
          }
        };
      } catch (err) {
        console.error('Error creating EventSource:', err);
        setError('Failed to establish connection to deployment stream');
      }
    };

    // Start the deployment stream immediately
    connectToDeploymentStream();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [applicationName, isDeploymentActive, onDeploymentComplete]);

  if (!isDeploymentActive && !deployment) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'InProgress':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'Successful':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Stopped':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'InProgress':
        return 'bg-blue-500';
      case 'Successful':
        return 'bg-green-500';
      case 'Failed':
        return 'bg-red-500';
      case 'Stopped':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
      default:
        return <CheckCircle className="h-3 w-3 text-blue-500" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {deployment && getStatusIcon(deployment.status)}
          Deployment Progress
          {deployment && (
            <Badge variant={deployment.status === 'Successful' ? 'default' : 
                          deployment.status === 'Failed' ? 'destructive' : 'secondary'}>
              {deployment.status}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {deployment?.message || 'Initializing deployment...'}
          {(!isConnected && error) && (
            <span className="text-red-600 ml-2">({error})</span>
          )}
          {deployment?.status === 'Failed' && deployment?.message && (
            <div className="text-red-600 mt-1 text-sm">
              Error: {deployment.message}
            </div>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {deployment && (
          <>
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{deployment.progress.current}/{deployment.progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(deployment.status)}`}
                  style={{ 
                    width: `${(deployment.progress.current / deployment.progress.total) * 100}%` 
                  }}
                />
              </div>
              <p className="text-sm text-gray-600">{deployment.progress.message}</p>
            </div>

            {/* AWS Deployment Status */}
            {deployment.progress.current >= 4 && deployment.status === 'InProgress' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="font-medium text-blue-800">AWS ECS Deployment in Progress</span>
                </div>
                <p className="text-sm text-blue-700">
                  Monitoring AWS ECS deployment status. This may take several minutes as new tasks are started and health checks are performed.
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Deployment Events</h4>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {deployment.events.map((event, index) => {
                  const isAwsEvent = event.message.includes('AWS Deployment');
                  return (
                    <div key={index} className={`flex items-start gap-2 text-sm ${isAwsEvent ? 'bg-blue-50 p-2 rounded' : ''}`}>
                      {getEventIcon(event.type)}
                      <div className="flex-1">
                        <span className={`${isAwsEvent ? 'text-blue-900 font-medium' : 'text-gray-900'}`}>
                          {event.message}
                        </span>
                        <span className={`ml-2 ${isAwsEvent ? 'text-blue-600' : 'text-gray-500'}`}>
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timing Information */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Started:</span>
                <span className="ml-2">{deployment.startedAt.toLocaleString()}</span>
              </div>
              {deployment.finishedAt && (
                <div>
                  <span className="text-gray-600">Finished:</span>
                  <span className="ml-2">{deployment.finishedAt.toLocaleString()}</span>
                </div>
              )}
            </div>
          </>
        )}

        {error && !deployment && (
          <div className="text-center py-4">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
