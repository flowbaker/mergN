import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthoredFunc, Wire } from "./types";

export interface WorkflowMeta {
  id: string;
  name: string;
  funcCount: number;
  updatedAt: string;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  funcs: AuthoredFunc[];
  wires: Wire[];
  positions: Record<string, { x: number; y: number }>;
  config: Record<string, Record<string, string>>;
  createdAt: string;
  updatedAt: string;
}

export interface SaveInput {
  id: string;
  name: string;
  funcs: AuthoredFunc[];
  wires: Wire[];
  positions: Record<string, { x: number; y: number }>;
  config: Record<string, Record<string, string>>;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: () => json<WorkflowMeta[]>("/api/workflows"),
  });
}

export function useSaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveInput) =>
      json<SavedWorkflow>(`/api/workflows/${input.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      json<{ ok: boolean }>(`/api/workflows/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function fetchWorkflow(id: string): Promise<SavedWorkflow> {
  return json<SavedWorkflow>(`/api/workflows/${id}`);
}

export interface ConnectionMeta {
  id: string;
  provider: string;
  account?: string;
  createdAt: string;
}

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => json<ConnectionMeta[]>("/api/connections"),
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { provider: string; key: string; account?: string }) =>
      json<ConnectionMeta>("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      json<{ ok: boolean }>(`/api/connections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
}
