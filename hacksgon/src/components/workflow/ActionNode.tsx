import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { WorkflowNodeData } from '@/lib/types/workflow';

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className={`min-w-[180px] rounded-xl border-2 bg-card border-primary/30 shadow-sm px-4 py-3 ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">⚙</span>
        <span className="text-xs font-bold text-primary uppercase tracking-wide">Action</span>
      </div>
      <div className="text-sm font-semibold text-foreground">{d.label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{d.description}</div>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
