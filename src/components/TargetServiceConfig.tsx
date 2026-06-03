import { useEffect, useState } from "react";
import { Target, Sparkles } from "lucide-react";
import { DEFAULT_TARGET_SERVICE, getTargetService, setTargetService } from "@/lib/target-service";

export function TargetServiceConfig() {
  const [value, setValue] = useState(DEFAULT_TARGET_SERVICE);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setValue(getTargetService());
  }, []);

  function save() {
    setTargetService(value.trim() || DEFAULT_TARGET_SERVICE);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">Your Target Service</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            AI evaluates each company&apos;s fit for this solution based on growth signals.
          </p>
          {editing ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Describe the service or solution you sell…"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setValue(getTargetService());
                    setEditing(false);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed">{value}</p>
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
