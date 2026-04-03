import type { WorkflowNode } from '@/lib/types/workflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  onChange: (nodeId: string, params: Record<string, string>) => void;
}

export function PropertiesPanel({ node, onChange }: PropertiesPanelProps) {
  if (!node) {
    return (
      <div className="w-72 border-l border-border bg-card h-full p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">Select a node to configure its properties</p>
      </div>
    );
  }

  const { params } = node.data;

  return (
    <div className="w-72 border-l border-border bg-card h-full overflow-y-auto p-4 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-foreground">{node.data.label}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{node.data.description}</p>
        <div className="text-[10px] font-mono text-muted-foreground/60 mt-1">ID: {node.id}</div>
      </div>
      <div className="border-t border-border pt-3 flex flex-col gap-3">
        {Object.keys(params).length === 0 && (
          <p className="text-[12px] text-muted-foreground italic">No configurable parameters</p>
        )}
        {Object.entries(params).map(([key, value]) => (
          <div key={key}>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {key.replace(/_/g, ' ')}
            </Label>
            <Input
              className="mt-1 text-sm h-8"
              value={value}
              onChange={e => onChange(node.id, { ...params, [key]: e.target.value })}
              placeholder={key.replace(/_/g, ' ')}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
