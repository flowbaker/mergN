import { useQuery } from "@tanstack/react-query";
import { spaceHeaders } from "./space";
import { useAuth } from "./authContext";

export interface SubscriptionView {
  plan_slug: string;
  plan_name: string;
  plan_description: string;
  price_monthly: number | null;
  currency: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  limits: { chats_limit: number; ai_tokens_limit: number };
  usage: { chats: number; ai_tokens: number };
  billing_enabled: boolean;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...spaceHeaders(), ...init?.headers },
  });
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useSubscription(spaceId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subscription", spaceId],
    queryFn: () =>
      api<SubscriptionView>(`/api/spaces/${spaceId}/billing/subscription`),
    enabled: !!user && !!spaceId,
    staleTime: 30_000,
  });
}

// Opens the Stripe customer portal (manage / change / cancel plan).
export async function openBillingPortal(spaceId: string): Promise<void> {
  const { portal_url } = await api<{ portal_url: string }>(
    `/api/spaces/${spaceId}/billing/portal`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  window.location.href = portal_url;
}

// True when the space has hit a plan limit (Free chats or Pro tokens).
export function atPlanLimit(sub: SubscriptionView | undefined): boolean {
  if (!sub || !sub.billing_enabled) return false;
  const { limits, usage } = sub;
  if (limits.chats_limit >= 0 && usage.chats >= limits.chats_limit) return true;
  if (limits.ai_tokens_limit >= 0 && usage.ai_tokens >= limits.ai_tokens_limit)
    return true;
  return false;
}
