"use client";
import React, { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

type JsonTreeProps = {
  data: any;
  depth?: number;
};

function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export default function JsonTree({ data, depth = 0 }: JsonTreeProps) {
  if (data === null) return <span className="text-slate-500">null</span>;
  if (data === undefined) return <span className="text-slate-500">undefined</span>;
  if (typeof data === "string") return <span className="text-emerald-600">"{data}"</span>;
  if (typeof data === "number") return <span className="text-indigo-600">{String(data)}</span>;
  if (typeof data === "boolean") return <span className="text-rose-600">{String(data)}</span>;

  if (Array.isArray(data)) {
    const [open, setOpen] = useState(false);
    return (
      <div className={`ml-${Math.min(depth, 6) * 4}`}>
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : "rotate-0"}`} />
              <span>Array[{data.length}]</span>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="pl-4">
              {data.map((item: any, idx: number) => (
                <div key={idx} className="py-1">
                  <div className="text-xs text-slate-500">[{idx}]</div>
                  <JsonTree data={item} depth={depth + 1} />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  if (isPlainObject(data)) {
    const entries = Object.entries(data);
    const [open, setOpen] = useState(false);
    return (
      <div className={`ml-${Math.min(depth, 6) * 4}`}>
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : "rotate-0"}`} />
              <span>{`Object{${entries.length}}`}</span>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="pl-4">
              {entries.map(([k, v]) => (
                <div key={k} className="py-1">
                  <div className="text-xs text-slate-500">{k}:</div>
                  <JsonTree data={v} depth={depth + 1} />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  return <span className="text-slate-700">{String(data)}</span>;
}
