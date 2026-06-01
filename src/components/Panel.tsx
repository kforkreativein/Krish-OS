import { ReactNode } from "react";

interface PanelProps {
  num?: string;          // "01"
  name?: string;         // "OPERATOR"
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}

export default function Panel({ num, name, action, children, className = "", bodyClass = "p-4" }: PanelProps) {
  return (
    <section className={`card panel-sheen ${className}`}>
      {(num || name || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="card-head flex min-w-0 flex-1 items-center gap-2">
            {num && <span className="text-muted">{num}</span>}
            {num && name && <span className="text-dim">//</span>}
            {name && <span className="text-soft">{name}</span>}
            <span className="h-px flex-1 bg-line/70" />
          </div>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
