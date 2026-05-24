import type { NodeHandler, NodeHandlerInput, NodeHandlerResult, WorkflowEngineContext } from '../types'

class NodeRegistryClass {
  private handlers = new Map<string, NodeHandler>()

  register(nodeType: string, handler: NodeHandler): void {
    this.handlers.set(nodeType, handler)
  }

  has(nodeType: string): boolean {
    return this.handlers.has(nodeType)
  }

  async execute(
    nodeType: string,
    input: NodeHandlerInput,
    context: WorkflowEngineContext,
  ): Promise<NodeHandlerResult> {
    const handler = this.handlers.get(nodeType)
    if (!handler) {
      throw new Error(`Unknown node type: ${nodeType}`)
    }
    return handler(input, context)
  }

  listTypes(): string[] {
    return Array.from(this.handlers.keys())
  }
}

export const NodeRegistry = new NodeRegistryClass()
