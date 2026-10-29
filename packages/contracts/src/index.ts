// Public DTOs are derived exclusively from generated OpenAPI contracts.
import type * as Operations from './generated/operations'
export type Todo = Operations.GetTodoSuccess['body']['todo']
export type User = Operations.GetMeSuccess['body']['user']
export type Key = Operations.ListKeysSuccess['body']['keys'][number]
export type KeyScope = Key['scope']
export type BillingStatus = Operations.GetBillingSuccess['body']
export type CheckoutConfig = Operations.GetCheckoutConfigSuccess['body']
export type CheckoutSession = Operations.CreateCheckoutSuccess['body']
export type OrderStatus = Operations.GetOrderSuccess['body']
