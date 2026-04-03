import { NODE_CATALOGUE } from '@/lib/workflow/nodeCatalogue';
import type { NodeBlueprint } from '@/lib/types/workflow';

const CATEGORY_CONFIG = {
  triggers:   { label: 'Triggers',    color: 'bg-blue-50 border-blue-200 text-blue-700',    badge: 'bg-blue-100 text-blue-700' },
  conditions: { label: 'Conditions',  color: 'bg-amber-50 border-amber-200 text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  actions:    { label: 'Actions',     color: 'bg-primary/5 border-primary/20 text-primary',  badge: 'bg-primary/10 text-primary' },
  outputs:    { label: 'Outputs',     color: 'bg-muted border-border text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
};

const grouped = Object.values(NODE_CATALOGUE).reduce<Record<string, NodeBlueprint[]>>((acc, node) => {
  if (!acc[node.category]) acc[node.category] = [];
  acc[node.category].push(node);
  return acc;
}, {});

interface NodePaletteProps {
  onAdd: (blueprint: NodeBlueprint) => void;
}

export function NodePalette({ onAdd }: NodePaletteProps) {
  return (
    <div className="w-64 border-r border-border bg-card h-full overflow-y-auto p-3 flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Node Palette</h3>
        <p className="text-[11px] text-muted-foreground">Click to add nodes to the canvas</p>
      </div>
      {(Object.keys(CATEGORY_CONFIG) as (keyof typeof CATEGORY_CONFIG)[]).map(cat => {
        const cfg = CATEGORY_CONFIG[cat];
        const nodes = grouped[cat] || [];
        return (
          <div key={cat}>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{cfg.label}</div>
            <div className="flex flex-col gap-1">
              {nodes.map(node => (
                <button
                  key={node.nodeType}
                  onClick={() => onAdd(node)}
                  className={`w-full text-left border rounded-lg px-3 py-2 text-sm hover:shadow-sm transition-all ${cfg.color}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{node.icon}</span>
                    <span className="font-medium text-[12px]">{node.label}</span>
                  </div>
                  <div className="text-[10px] opacity-70 mt-0.5 truncate">{node.description}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
