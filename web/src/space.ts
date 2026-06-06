const KEY = "space-id";
const SAFE = /^[A-Za-z0-9_-]+$/;

function read(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v && SAFE.test(v)) return v;
  } catch {
    void 0;
  }
  return "";
}

let current = read();

export function getSpace(): string {
  return current;
}

export function setSpace(id: string): void {
  if (id && !SAFE.test(id)) return;
  current = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    void 0;
  }
}

export function spaceHeaders(): Record<string, string> {
  return current ? { "x-space-id": current } : {};
}
