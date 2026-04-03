import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { WorkflowNodeData } from '@/lib/types/workflow';

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className={`min-w-[180px] rounded-xl border-2 bg-blue-50 border-blue-300 shadow-sm px-4 py-3 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">⚡</span>
        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Trigger</span>
      </div>
      <div className="text-sm font-semibold text-blue-900">{d.label}</div>
      <div className="text-[11px] text-blue-600 mt-0.5">{d.description}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
    </div>
  );
}
