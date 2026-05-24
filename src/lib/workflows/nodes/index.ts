import { NodeRegistry } from '../core/NodeRegistry'
import { scheduleTriggerHandler } from './trigger/ScheduleNode'
import { eventTriggerHandler } from './trigger/EventNode'
import { webhookTriggerHandler, manualTriggerHandler } from './trigger/WebhookNode'
import { sendNotificationHandler } from './action/SendNotificationNode'
import { updateRecordHandler } from './action/UpdateRecordNode'
import { generateDocumentHandler } from './action/GenerateDocumentNode'
import { aiDecisionHandler } from './action/AIDecisionNode'
import { conditionHandler } from './control/ConditionNode'
import { delayHandler } from './control/DelayNode'
import { loopHandler } from './control/LoopNode'
import { httpRequestHandler } from './integration/HttpRequestNode'

let registered = false

export function registerAllNodes(): void {
  if (registered) return
  registered = true

  NodeRegistry.register('trigger.schedule', scheduleTriggerHandler)
  NodeRegistry.register('trigger.event', eventTriggerHandler)
  NodeRegistry.register('trigger.webhook', webhookTriggerHandler)
  NodeRegistry.register('trigger.manual', manualTriggerHandler)

  NodeRegistry.register('action.send_notification', sendNotificationHandler)
  NodeRegistry.register('action.update_record', updateRecordHandler)
  NodeRegistry.register('action.generate_document', generateDocumentHandler)
  NodeRegistry.register('action.ai_decision', aiDecisionHandler)

  NodeRegistry.register('control.condition', conditionHandler)
  NodeRegistry.register('control.delay', delayHandler)
  NodeRegistry.register('control.loop', loopHandler)

  NodeRegistry.register('integration.http_request', httpRequestHandler)
}

registerAllNodes()
