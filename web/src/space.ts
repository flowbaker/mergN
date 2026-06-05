export const SPACE_ID = "default";

export function spaceHeaders(): Record<string, string> {
  return { "x-space-id": SPACE_ID };
}
