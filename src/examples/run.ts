import type {
  FuncNode,
  StepRecord,
  FuncDefinition,
  FuncContext,
  ProviderClient,
} from "../atoms/index";
import type { Workflow, Runtime, ConnectionResolver } from "../engine/index";
import {
  Scheduler,
  Worker,
  InMemoryQueue,
  InMemoryRunLog,
  InMemoryFuncRegistry,
} from "../engine/index";
import { fullNameAdapter, slackPostFunc, sendEmailFunc } from "./send-email";

const nodeFullName: FuncNode = {
  nodeId: "node_full_name",
  funcId: "fn_full_name",
  funcVersion: 1,
  bindings: {
    firstName: { mode: "ref", path: "trigger.output.firstName" },
    lastName: { mode: "ref", path: "trigger.output.lastName" },
  },
  connections: {},
  dependsOn: [],
};

const nodeSlack: FuncNode = {
  nodeId: "node_notify_slack",
  funcId: "fn_slack_post",
  funcVersion: 1,
  bindings: {
    channel: { mode: "literal", value: "#signups" },
    text: { mode: "ref", path: "node_full_name.output.fullName" },
  },
  connections: { slack: "conn_slack_acme" },
  dependsOn: [],
};

const nodeEmail: FuncNode = {
  nodeId: "node_send_email",
  funcId: "fn_send_email",
  funcVersion: 1,
  bindings: {
    to: { mode: "ref", path: "trigger.output.email" },
    subject: { mode: "literal", value: "Hoş geldin!" },
    body: { mode: "literal", value: "Merhaba, aramıza hoş geldin." },
  },
  connections: { smtp: "conn_smtp_acme" },
  dependsOn: [],
};

const workflow: Workflow = {
  id: "wf_signup",
  nodes: [nodeFullName, nodeSlack, nodeEmail],
};

class EvalRuntime implements Runtime {
  async run(
    def: FuncDefinition,
    ctx: FuncContext,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const fn = new Function(
      "ctx",
      "input",
      `return (async () => { ${def.body.source} })()`,
    );
    return await fn(ctx, input);
  }
}

let receipt = 0;

const stubClients: Record<string, ProviderClient> = {
  slack: {
    postMessage: async (channel: string, text: string) => {
      console.log(`    [slack] ${channel} <- "${text}"`);
      receipt += 1;
      return `1717400000.000${receipt}`;
    },
  },
  smtp: {
    send: async (to: string, subject: string, body: string) => {
      console.log(`    [smtp]  ${to} <- "${subject}: ${body}"`);
      receipt += 1;
      return `msg_${receipt}`;
    },
  },
};

class StubConnections implements ConnectionResolver {
  async inject(node: FuncNode): Promise<Record<string, ProviderClient>> {
    const clients: Record<string, ProviderClient> = {};
    for (const name of Object.keys(node.connections))
      clients[name] = stubClients[name];
    return clients;
  }
}

const registry = new InMemoryFuncRegistry();
registry.register(fullNameAdapter);
registry.register(slackPostFunc);
registry.register(sendEmailFunc);

const queue = new InMemoryQueue();
const log = new InMemoryRunLog();
const scheduler = new Scheduler(workflow, log, queue);
const worker = new Worker(
  workflow,
  registry,
  new StubConnections(),
  new EvalRuntime(),
  log,
  queue,
  scheduler,
);

async function main(): Promise<void> {
  const runId = "run_demo";

  const triggerRecord: StepRecord = {
    runId,
    nodeId: "trigger",
    funcId: "trigger",
    funcVersion: 1,
    attempt: 1,
    status: "done",
    resolvedInput: {},
    output: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    },
  };
  await log.append(triggerRecord);
  await scheduler.tick(runId);

  let item = await queue.pop();
  while (item) {
    console.log(`> step: ${item.nodeId}`);
    await worker.process(item);
    item = await queue.pop();
  }

  const final = await log.get(runId);
  console.log("\n=== RUN LOG ===");
  for (const r of final.records) {
    console.log(
      `${r.status.padEnd(8)} ${r.nodeId.padEnd(20)} -> ${JSON.stringify(r.output ?? {})}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
