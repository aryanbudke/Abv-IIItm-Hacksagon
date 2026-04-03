import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { WorkflowNodeData } from '@/lib/types/workflow';

export function EndpointNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className={`min-w-[180px] rounded-xl border-2 bg-muted border-border shadow-sm px-4 py-3 ${selected ? 'ring-2 ring-foreground/30' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">■</span>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Output</span>
      </div>
      <div className="text-sm font-semibold text-foreground">{d.label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{d.description}</div>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
    </div>
  );
}
