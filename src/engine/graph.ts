import type { FuncNode } from '../atoms/index'

export interface Workflow {
  id: string
  nodes: FuncNode[]
}

export function dependenciesOf(node: FuncNode): string[] {
  const refDeps: string[] = []
  for (const binding of Object.values(node.bindings)) {
    if (binding.mode === 'ref') refDeps.push(binding.path.split('.')[0])
  }
  return [...new Set([...refDeps, ...node.dependsOn])]
}
