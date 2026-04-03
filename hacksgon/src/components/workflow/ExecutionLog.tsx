import type { StepLog } from '@/lib/types/workflow';
import { CheckCircle2, XCircle, SkipForward, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  ok:      { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' },
  error:   { icon: XCircle,      color: 'text-destructive', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700' },
  skipped: { icon: SkipForward,  color: 'text-muted-foreground', bg: 'bg-muted border-border', badge: 'bg-muted text-muted-foreground' },
};

interface ExecutionLogProps {
  steps: StepLog[];
  status?: 'running' | 'completed' | 'failed';
}

export function ExecutionLog({ steps, status }: ExecutionLogProps) {
  if (!steps.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        No execution steps yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {status && (
        <div className="flex items-center gap-2 mb-2">
          {status === 'running' && <Clock size={14} className="text-primary animate-spin" />}
          <span className="text-xs font-semibold text-muted-foreground uppercase">Status: {status}</span>
        </div>
      )}
      {steps.map((step, i) => {
        const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.skipped;
        const Icon = cfg.icon;
        return (
          <div key={i} className={`border rounded-lg px-3 py-2 ${cfg.bg}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon size={14} className={`flex-shrink-0 ${cfg.color}`} />
                <span className="text-sm font-medium text-foreground truncate">{step.label}</span>
              </div>
              <Badge className={`text-[10px] flex-shrink-0 ${cfg.badge} border-0`}>{step.status}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 ml-5">{step.message}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5 ml-5 font-mono">
              {new Date(step.timestamp).toLocaleTimeString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
