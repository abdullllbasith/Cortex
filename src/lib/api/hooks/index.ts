export { useCustomers, useCustomer, useMutateCustomer } from './useCustomers'
export { useProducts, useProduct, useMutateProduct } from './useProducts'
export { useSuppliers, useSupplier } from './useSuppliers'
export {
  useExecutiveAnalytics,
  useSalesAnalytics,
  useCustomerAnalytics,
  useInventoryAnalytics,
  useSupplierAnalytics,
} from './useAnalytics'

/** @deprecated Use useExecutiveAnalytics or domain-specific hooks */
export { useExecutiveAnalytics as useAnalytics } from './useAnalytics'

export {
  useSalesPredictions,
  useInventoryPredictions,
  useCustomerChurnPredictions,
  useSupplierRiskPredictions,
  useRefreshPredictions,
} from './usePredictions'
export { useAgents, useAgentLogs } from './useAgents'
export { useWorkflows, useWorkflow, useWorkflowExecutions } from './useWorkflows'
export { useAlerts, useMutateAlerts } from './useAlerts'
export { useCurrentUser, useTenant, useTeamMembers } from './useSession'
