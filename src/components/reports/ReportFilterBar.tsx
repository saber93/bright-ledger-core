import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useBranches } from "@/features/branches/hooks";
import type { ReportFilters } from "@/features/reports/hooks";
import { Calendar } from "lucide-react";

const ALL_BRANCHES = "__all__";

function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultFilters(): ReportFilters {
  return { from: firstOfMonth(), to: today(), branchId: null };
}

export function ReportFilterBar({
  value,
  onChange,
  showBranch = true,
  trailing,
}: {
  value: ReportFilters;
  onChange: (next: ReportFilters) => void;
  showBranch?: boolean;
  trailing?: ReactNode;
}) {
  const { data: branches } = useBranches();
  const [local, setLocal] = useState<ReportFilters>(value);

  const apply = () => onChange(local);
  const setPreset = (preset: "this_month" | "last_month" | "this_quarter" | "ytd") => {
    const now = new Date();
    let from: Date;
    let to: Date;
    if (preset === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
    } else if (preset === "last_month") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "this_quarter") {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      to = now;
    } else {
      from = new Date(now.getFullYear(), 0, 1);
      to = now;
    }
    const next = {
      ...local,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={local.from}
          onChange={(e) => setLocal({ ...local, from: e.target.value })}
          className="h-9 w-[150px]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={local.to}
          onChange={(e) => setLocal({ ...local, to: e.target.value })}
          className="h-9 w-[150px]"
        />
      </div>
      {showBranch && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Branch</Label>
          <Select
            value={local.branchId ?? ALL_BRANCHES}
            onValueChange={(v) =>
              setLocal({ ...local, branchId: v === ALL_BRANCHES ? null : v })
            }
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BRANCHES}>All branches</SelectItem>
              {(branches ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button size="sm" onClick={apply} className="h-9">
        Apply
      </Button>

      <div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <button onClick={() => setPreset("this_month")} className="hover:text-foreground">
          This month
        </button>
        <span>·</span>
        <button onClick={() => setPreset("last_month")} className="hover:text-foreground">
          Last month
        </button>
        <span>·</span>
        <button onClick={() => setPreset("this_quarter")} className="hover:text-foreground">
          This quarter
        </button>
        <span>·</span>
        <button onClick={() => setPreset("ytd")} className="hover:text-foreground">
          YTD
        </button>
      </div>

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
