# Phase 04: Economy Core

## Goal

Create a reducer-first economy where money changes are represented as transactions and ledger entries, not random script mutations.

The mistake many FiveM economies make is letting arbitrary scripts directly mutate balances. This runtime should make balance changes flow through controlled reducers and produce a complete audit trail.

## Core Principle

```txt
economy actions create transactions
transactions create ledger entries
balances are derived or updated only through reducers
every privileged mutation is audited
```

## Data Model

```ts
accounts
- id
- owner_type // character, business, government, society, plugin
- owner_id
- currency
- balance
- status
- created_at
- updated_at

transactions
- id
- type
- actor_id
- status
- idempotency_key
- metadata_json
- created_at
- completed_at

ledger_entries
- id
- transaction_id
- account_id
- direction // debit, credit
- amount
- reason
- metadata_json
- created_at

invoices
- id
- issuer_account_id
- payer_account_id
- amount
- currency
- status
- due_at
- paid_at

economy_limits
- id
- permission_key
- action_type
- limit_json
- enabled
```

## Reducers

```txt
transfer_money
deposit_cash
withdraw_cash
pay_invoice
issue_invoice
pay_salary
buy_item
sell_item
charge_tax
fine_player
business_payout
admin_adjust_balance
void_transaction
```

Each reducer should:

1. Verify actor identity.
2. Check permission and action capability.
3. Validate payload.
4. Enforce economy limits.
5. Check account status and balances.
6. Write transaction and ledger rows.
7. Update account balances atomically.
8. Write audit log.

SpacetimeDB reducers are transactional, so failed mutations should roll back instead of leaving partial ledger state.

## Idempotency

Economy actions must be retry-safe:

```txt
same idempotency_key + same actor + same action
-> return existing transaction result

same idempotency_key + different payload
-> reject as idempotency conflict
```

This matters for web panels, game events, and network retries.

## Auditability

A ledger gives:

```txt
auditability
rollback support
anti-cheat visibility
admin investigation
business accounting
web dashboard analytics
```

The audit log should record:

- actor
- target account
- source account
- amount
- reason
- permission used
- plugin initiating the action
- transaction id
- before/after balances

## Plugin Integration

Plugins should never write balances directly. They should request economy actions:

```txt
mechanic plugin -> issue_invoice
job plugin -> pay_salary
shop plugin -> buy_item
police plugin -> fine_player
business plugin -> business_payout
```

Plugin capabilities should define which economy reducers a plugin can call:

```ts
plugin_capabilities
- plugin_id
- capability_key // economy.issue_invoice
- constraints_json
- enabled
```

Example constraints:

```json
{
  "max_amount": 25000,
  "allowed_account_owner_types": ["business", "character"],
  "requires_on_duty": true
}
```

## Web Dashboard

The dashboard should expose:

- account search
- transaction history
- ledger drilldown
- suspicious activity filters
- manual adjustments with reason required
- rollback workflow
- exportable business/account statements

Public subscriptions can expose safe summary data. Sensitive financial/audit tables should be private or scoped to admin clients.

## MVP Deliverables

- Account, transaction, and ledger tables.
- Transfer and admin adjustment reducers.
- Idempotency handling.
- Permission and capability checks.
- Economy admin menu entries.
- Audit dashboard.
- Plugin economy action API.

## References

- [SpacetimeDB reducers](https://spacetimedb.com/docs/functions/reducers/)
- [SpacetimeDB tables](https://spacetimedb.com/docs/tables/)
- [SpacetimeDB subscriptions](https://spacetimedb.com/docs/clients/subscriptions/)
- [FiveM server events](https://docs.fivem.net/docs/scripting-manual/working-with-events/triggering-events/)
