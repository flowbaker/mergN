import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, openBillingPortal } from "./billing";
import { EnterpriseDialog } from "./EnterpriseDialog";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

export function BillingPage() {
  const { spaceId } = useParams({ strict: false }) as { spaceId?: string };
  const navigate = useNavigate();
  const { data: sub, isLoading } = useSubscription(spaceId ?? "");
  const [managing, setManaging] = useState(false);
  const [enterprise, setEnterprise] = useState(false);

  const manage = async () => {
    if (!spaceId) return;
    setManaging(true);
    try {
      await openBillingPortal(spaceId);
    } catch {
      setManaging(false);
    }
  };

  const usageLine = (() => {
    if (!sub) return null;
    const { limits, usage } = sub;
    if (limits.chats_limit >= 0)
      return `${usage.chats} / ${limits.chats_limit} chats this month`;
    if (limits.ai_tokens_limit >= 0)
      return `${(usage.ai_tokens / 1_000_000).toFixed(2)}M / ${(
        limits.ai_tokens_limit / 1_000_000
      ).toFixed(0)}M AI tokens this month`;
    return null;
  })();

  return (
    <div className="flex min-h-screen w-full justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-lg">
        <button
          onClick={() =>
            void navigate({
              to: "/s/$spaceId",
              params: { spaceId: spaceId ?? "" },
            })
          }
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <h1 className="mb-1 text-lg font-semibold">Billing</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Manage your subscription.
        </p>

        {isLoading || !sub ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground/70" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">
                    {sub.plan_name}
                  </span>
                  {sub.price_monthly != null && sub.price_monthly > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ${sub.price_monthly}/mo
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {sub.plan_description}
                </p>
                {usageLine && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {usageLine}
                  </p>
                )}
                {sub.current_period_end && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sub.cancel_at_period_end ? "Ends on " : "Renews on "}
                    {fmtDate(sub.current_period_end)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Button
                onClick={manage}
                disabled={managing || !sub.billing_enabled}
                className="gap-1.5"
              >
                {managing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Manage
              </Button>
              {!sub.billing_enabled && (
                <span className="text-xs text-muted-foreground">
                  Billing isn't configured yet.
                </span>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Need higher limits or Enterprise?{" "}
          <button
            onClick={() => setEnterprise(true)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Contact us
          </button>
        </p>
      </div>

      {enterprise && <EnterpriseDialog onClose={() => setEnterprise(false)} />}
    </div>
  );
}
