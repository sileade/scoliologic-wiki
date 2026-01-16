/**
 * Batch Embeddings Manager Component
 * 
 * UI for managing batch embedding generation for all wiki pages.
 * Shows progress, statistics, and controls for start/stop/resume.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Database, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  BarChart3,
} from 'lucide-react';

export function BatchEmbeddingsManager() {
  const { t } = useTranslation();
  const [isPolling, setIsPolling] = useState(false);
  
  // Queries
  // @ts-ignore - types will be regenerated after server restart
  const { data: progress, refetch: refetchProgress } = trpc.ai.batchProgress.useQuery(undefined, {
    refetchInterval: isPolling ? 2000 : false,
  });
  
  // @ts-ignore - types will be regenerated after server restart
  const { data: stats, refetch: refetchStats } = trpc.ai.embeddingsStats.useQuery();
  
  // Mutations
  // @ts-ignore - types will be regenerated after server restart
  const startMutation = trpc.ai.batchStart.useMutation({
    onSuccess: () => {
      setIsPolling(true);
      refetchProgress();
    },
  });
  
  // @ts-ignore - types will be regenerated
  const stopMutation = trpc.ai.batchStop.useMutation({
    onSuccess: () => {
      setIsPolling(false);
      refetchProgress();
    },
  });
  
  // @ts-ignore - types will be regenerated
  const resumeMutation = trpc.ai.batchResume.useMutation({
    onSuccess: () => {
      setIsPolling(true);
      refetchProgress();
    },
  });
  
  // Auto-stop polling when completed
  useEffect(() => {
    if (progress?.status === 'completed' || progress?.status === 'error') {
      setIsPolling(false);
      refetchStats();
    }
  }, [progress?.status, refetchStats]);
  
  // Calculate progress percentage
  const progressPercent = progress?.total ? Math.round((progress.processed / progress.total) * 100) : 0;
  
  // Format time remaining
  const formatTimeRemaining = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Statistics Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('batchEmbeddings.statistics', 'Embeddings Statistics')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats?.totalPages || 0}</div>
              <div className="text-sm text-muted-foreground">
                {t('batchEmbeddings.totalPages', 'Total Pages')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats?.pagesWithEmbeddings || 0}</div>
              <div className="text-sm text-muted-foreground">
                {t('batchEmbeddings.indexed', 'Indexed')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats?.pagesWithoutEmbeddings || 0}</div>
              <div className="text-sm text-muted-foreground">
                {t('batchEmbeddings.pending', 'Pending')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats?.coveragePercent || 0}%</div>
              <div className="text-sm text-muted-foreground">
                {t('batchEmbeddings.coverage', 'Coverage')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Progress Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              {t('batchEmbeddings.title', 'Batch Embedding Generation')}
            </CardTitle>
            <Badge className={getStatusColor(progress?.status || 'idle')}>
              {progress?.status || 'idle'}
            </Badge>
          </div>
          <CardDescription>
            {t('batchEmbeddings.description', 'Generate embeddings for all wiki pages to enable AI-powered search')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {progress?.status === 'running' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.processed} / {progress.total}</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {t('batchEmbeddings.batch', 'Batch')} {progress.currentBatch} / {progress.totalBatches}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeRemaining(progress.estimatedTimeRemaining)}
                </span>
              </div>
            </div>
          )}
          
          {/* Stats during processing */}
          {progress?.status === 'running' && (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="p-2 bg-muted rounded">
                <div className="font-medium text-green-600">{progress.processed - progress.failed}</div>
                <div className="text-xs text-muted-foreground">{t('batchEmbeddings.success', 'Success')}</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium text-blue-600">{progress.cached}</div>
                <div className="text-xs text-muted-foreground">{t('batchEmbeddings.cached', 'Cached')}</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium text-red-600">{progress.failed}</div>
                <div className="text-xs text-muted-foreground">{t('batchEmbeddings.failed', 'Failed')}</div>
              </div>
            </div>
          )}
          
          {/* Completed message */}
          {progress?.status === 'completed' && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                {t('batchEmbeddings.completed', 'Completed!')} {progress.processed} {t('batchEmbeddings.pagesProcessed', 'pages processed')}
                {progress.cached > 0 && ` (${progress.cached} ${t('batchEmbeddings.fromCache', 'from cache')})`}
              </span>
            </div>
          )}
          
          {/* Error message */}
          {progress?.status === 'error' && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>{t('batchEmbeddings.error', 'Error occurred during processing')}</span>
            </div>
          )}
          
          {/* Errors list */}
          {progress?.errors && progress.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-xs space-y-1">
              {progress.errors.slice(0, 10).map((err: { pageId: number; error: string }, i: number) => (
                <div key={i} className="text-red-500">
                  Page {err.pageId}: {err.error}
                </div>
              ))}
              {progress.errors.length > 10 && (
                <div className="text-muted-foreground">
                  ...and {progress.errors.length - 10} more errors
                </div>
              )}
            </div>
          )}
          
          {/* Control Buttons */}
          <div className="flex gap-2">
            {(progress?.status === 'idle' || progress?.status === 'completed' || progress?.status === 'error') && (
              <Button 
                onClick={() => startMutation.mutate({})}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {t('batchEmbeddings.start', 'Start')}
              </Button>
            )}
            
            {progress?.status === 'running' && (
              <Button 
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                {stopMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                {t('batchEmbeddings.stop', 'Stop')}
              </Button>
            )}
            
            {progress?.status === 'paused' && (
              <Button 
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
              >
                {resumeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {t('batchEmbeddings.resume', 'Resume')}
              </Button>
            )}
            
            <Button 
              variant="outline"
              onClick={() => startMutation.mutate({ forceRegenerate: true })}
              disabled={progress?.status === 'running' || startMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('batchEmbeddings.regenerateAll', 'Regenerate All')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
