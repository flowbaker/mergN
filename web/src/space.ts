const KEY = "space-id";
const SAFE = /^[A-Za-z0-9_-]+$/;

function read(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v && SAFE.test(v)) return v;
  } catch {
    void 0;
  }
  return "default";
}

let current = read();

export function getSpace(): string {
  return current;
}

export function setSpace(id: string): void {
  if (!SAFE.test(id)) return;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    void 0;
  }
}

export function spaceHeaders(): Record<string, string> {
  return { "x-space-id": current };
}
