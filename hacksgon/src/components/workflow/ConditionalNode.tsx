import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { WorkflowNodeData } from '@/lib/types/workflow';

export function ConditionalNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className={`min-w-[180px] rounded-xl border-2 bg-amber-50 border-amber-300 shadow-sm px-4 py-3 ${selected ? 'ring-2 ring-amber-500' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">◇</span>
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Condition</span>
      </div>
      <div className="text-sm font-semibold text-amber-900">{d.label}</div>
      <div className="text-[11px] text-amber-600 mt-0.5">{d.description}</div>
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <Handle type="source" id="true" position={Position.Bottom} style={{ left: '30%' }} className="!bg-green-500" />
      <Handle type="source" id="false" position={Position.Bottom} style={{ left: '70%' }} className="!bg-red-400" />
      <div className="flex justify-between text-[10px] mt-2 px-1">
        <span className="text-green-600 font-semibold">TRUE</span>
        <span className="text-red-500 font-semibold">FALSE</span>
      </div>
    </div>
  );
}
