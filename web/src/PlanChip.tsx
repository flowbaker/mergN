import { useNavigate } from "@tanstack/react-router";
import { useSubscription } from "./billing";
import { getSpace } from "./space";

// Small current-plan chip shown next to the space switcher. Click → billing.
export function PlanChip() {
  const navigate = useNavigate();
  const spaceId = getSpace();
  const { data: sub } = useSubscription(spaceId);
  if (!spaceId || !sub) return null;

  return (
    <button
      type="button"
      onClick={() =>
        void navigate({ to: "/s/$spaceId/billing", params: { spaceId } })
      }
      title="Manage billing"
      className="rounded-md border border-border/50 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
    >
      {sub.plan_name}
    </button>
  );
}
