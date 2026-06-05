import { join } from "node:path";
import { authorFunc } from "./func-author";
import { createRegistry } from "../providers/registry";
import { FileStore } from "../store/docstore";

async function main(): Promise<void> {
  console.log("Authoring func with AI...\n");

  const registry = createRegistry(new FileStore(join(process.cwd(), "data", "spaces")));
  const { def } = await authorFunc(registry, {
    spaceId: "default",
    intent:
      "Given a signup object ({firstName, lastName, email, plan}), produce a readable Slack message. Only transform data, do not call any external service.",
  });

  console.log("=== GENERATED FUNC ===");
  console.log(JSON.stringify(def, null, 2));

  console.log("\n=== RUNNING BODY (sample input) ===");
  const fn = new Function(
    "ctx",
    "input",
    `return (async () => { ${def.body.source} })()`,
  );
  const output = await fn(
    { connections: {} },
    { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", plan: "pro" },
  );
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
