#[reducer]
pub fn create_account(
    ctx: &ReducerContext,
    id: String,
    owner_type: String,
    owner_id: String,
    currency: String,
    balance: i128,
) -> Result<(), String> {
    validate_account_creation_identity(&id, &owner_type, &owner_id, &currency)?;
    validate_account_owner_type(&owner_type)?;
    if balance < 0 {
        return Err("balance cannot be negative".to_string());
    }

    ctx.db.accounts().insert(Account {
        id,
        owner_type,
        owner_id,
        currency,
        balance,
        status: "active".to_string(),
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_account_creation_identity(id: &str, owner_type: &str, owner_id: &str, currency: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("account id is required".to_string());
    }
    if owner_type.trim().is_empty() {
        return Err("account owner type is required".to_string());
    }
    if owner_id.trim().is_empty() {
        return Err("account owner id is required".to_string());
    }
    if currency.trim().is_empty() {
        return Err("account currency is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_economy_limit(
    ctx: &ReducerContext,
    id: String,
    permission_key: String,
    action_type: String,
    limit_json: String,
    enabled: bool,
) -> Result<(), String> {
    validate_economy_limit_identity(&id, &permission_key, &action_type, &limit_json)?;
    if !permission_key_exists(ctx, &permission_key) {
        return Err("permission must exist before economy limit writes".to_string());
    }
    validate_economy_limit_json(&limit_json)?;

    ctx.db.economy_limits().insert(EconomyLimit {
        id,
        permission_key,
        action_type,
        limit_json,
        enabled,
    });
    Ok(())
}

fn validate_economy_limit_identity(id: &str, permission_key: &str, action_type: &str, limit_json: &str) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("economy limit id is required".to_string());
    }
    if permission_key.trim().is_empty() {
        return Err("economy limit permission key is required".to_string());
    }
    if action_type.trim().is_empty() {
        return Err("economy limit action type is required".to_string());
    }
    if limit_json.trim().is_empty() {
        return Err("economy limit json is required".to_string());
    }
    Ok(())
}

fn validate_economy_limit_json(limit_json: &str) -> Result<(), String> {
    let trimmed = limit_json.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Err("economy limit json must be an object".to_string());
    }

    let has_max_amount = trimmed.contains("\"max_amount\"") || trimmed.contains("\"maxAmount\"");
    let has_allowed_owner_types =
        trimmed.contains("\"allowed_account_owner_types\"") || trimmed.contains("\"allowedAccountOwnerTypes\"");
    if !has_max_amount && !has_allowed_owner_types {
        return Err("economy limit json must define max_amount or allowed_account_owner_types".to_string());
    }

    if has_max_amount {
        let Some(max_amount) = parse_limit_max_amount(trimmed) else {
            return Err("economy limit max_amount must be positive".to_string());
        };
        if max_amount <= 0 {
            return Err("economy limit max_amount must be positive".to_string());
        }
    }

    if has_allowed_owner_types {
        let Some(allowed_owner_types) = parse_limit_allowed_owner_types(trimmed) else {
            return Err("economy limit allowed_account_owner_types must be a non-empty string array".to_string());
        };
        if allowed_owner_types.is_empty() {
            return Err("economy limit allowed_account_owner_types must be a non-empty string array".to_string());
        }
        for owner_type in allowed_owner_types {
            if validate_account_owner_type(&owner_type).is_err() {
                return Err("economy limit allowed_account_owner_types contains invalid owner type".to_string());
            }
        }
    }

    Ok(())
}

#[reducer]
pub fn transfer_money(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    from_account_id: String,
    to_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.transfer".to_string(),
        from_account_id,
        to_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn deposit_cash(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_single_account_transaction(
        ctx,
        transaction_id,
        actor_id,
        "economy.deposit_cash".to_string(),
        account_id,
        "credit".to_string(),
        amount,
        reason,
        idempotency_key,
    )
}

#[reducer]
pub fn withdraw_cash(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_single_account_transaction(
        ctx,
        transaction_id,
        actor_id,
        "economy.withdraw_cash".to_string(),
        account_id,
        "debit".to_string(),
        amount,
        reason,
        idempotency_key,
    )
}

#[reducer]
pub fn pay_salary(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    employer_account_id: String,
    employee_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.pay_salary".to_string(),
        employer_account_id,
        employee_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn fine_player(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    player_account_id: String,
    destination_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.fine_player".to_string(),
        player_account_id,
        destination_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn buy_item(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    buyer_account_id: String,
    seller_account_id: String,
    amount: i128,
    item_key: String,
    quantity: u64,
    idempotency_key: String,
) -> Result<(), String> {
    validate_item_transaction_identity(&item_key, "purchased item key")?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.buy_item".to_string(),
        buyer_account_id,
        seller_account_id,
        amount,
        item_transaction_reason("buy_item", &item_key),
        idempotency_key,
        Some(item_transaction_metadata_json(&item_key, quantity)),
    )
}

#[reducer]
pub fn sell_item(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    seller_account_id: String,
    buyer_account_id: String,
    amount: i128,
    item_key: String,
    quantity: u64,
    idempotency_key: String,
) -> Result<(), String> {
    validate_item_transaction_identity(&item_key, "sold item key")?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.sell_item".to_string(),
        buyer_account_id,
        seller_account_id,
        amount,
        item_transaction_reason("sell_item", &item_key),
        idempotency_key,
        Some(item_transaction_metadata_json(&item_key, quantity)),
    )
}

#[reducer]
pub fn charge_tax(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    payer_account_id: String,
    government_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.charge_tax".to_string(),
        payer_account_id,
        government_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn business_payout(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    business_account_id: String,
    destination_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    post_account_transfer(
        ctx,
        transaction_id,
        actor_id,
        "economy.business_payout".to_string(),
        business_account_id,
        destination_account_id,
        amount,
        reason,
        idempotency_key,
        None,
    )
}

#[reducer]
pub fn admin_adjust_balance(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    account_id: String,
    direction: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    if direction != "debit" && direction != "credit" {
        return Err("direction must be debit or credit".to_string());
    }

    post_single_account_transaction(
        ctx,
        transaction_id,
        actor_id,
        "economy.admin_adjust_balance".to_string(),
        account_id,
        direction,
        amount,
        reason,
        idempotency_key,
    )
}

fn post_account_transfer(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    transaction_type: String,
    from_account_id: String,
    to_account_id: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
    metadata_json: Option<String>,
) -> Result<(), String> {
    validate_account_transfer_identity(&transaction_id, &actor_id, &transaction_type, &from_account_id, &to_account_id, &idempotency_key)?;
    if amount <= 0 {
        return Err("amount must be positive".to_string());
    }
    validate_economy_reason(&reason)?;

    let metadata_json = metadata_json.unwrap_or_else(|| {
        transfer_metadata_json(
            &from_account_id,
            &to_account_id,
            amount,
            &reason,
        )
    });

    let already_processed = if transaction_type == "economy.transfer" {
        ensure_idempotent_transfer(ctx, &idempotency_key, &actor_id, &metadata_json)?
    } else {
        ensure_idempotent_economy_action(
            ctx,
            &idempotency_key,
            &actor_id,
            &transaction_type,
            &metadata_json,
        )?
    };
    if already_processed {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, &transaction_type)?;

    let Some(mut from) = ctx.db.accounts().id().find(from_account_id.clone()) else {
        return Err("unknown source account".to_string());
    };
    let Some(mut to) = ctx.db.accounts().id().find(to_account_id.clone()) else {
        return Err("unknown destination account".to_string());
    };

    if from.status != "active" || to.status != "active" {
        return Err("account is not active".to_string());
    }

    if from.currency != to.currency {
        return Err("currency mismatch".to_string());
    }

    enforce_economy_limits(
        ctx,
        &transaction_type,
        &transaction_type,
        amount,
        &[&from, &to],
    )?;

    if from.balance < amount {
        return Err("insufficient funds".to_string());
    }

    let before_json = account_pair_balance_json(&from_account_id, from.balance, &to_account_id, to.balance);
    from.balance -= amount;
    to.balance += amount;
    let after_json = account_pair_balance_json(&from_account_id, from.balance, &to_account_id, to.balance);
    from.updated_at = ctx.timestamp;
    to.updated_at = ctx.timestamp;
    ctx.db.accounts().id().update(from);
    ctx.db.accounts().id().update(to);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: transaction_type.clone(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:debit"),
        transaction_id: transaction_id.clone(),
        account_id: from_account_id.clone(),
        direction: "debit".to_string(),
        amount,
        reason: reason.clone(),
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:credit"),
        transaction_id: transaction_id.clone(),
        account_id: to_account_id.clone(),
        direction: "credit".to_string(),
        amount,
        reason,
        metadata_json,
        created_at: ctx.timestamp,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: transaction_type.clone(),
        permission_key: economy_permission_key(&transaction_type).to_string(),
        target_type: "account_transfer".to_string(),
        target_id: format!("{from_account_id}->{to_account_id}"),
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_account_transfer_identity(
    transaction_id: &str,
    actor_id: &str,
    transaction_type: &str,
    from_account_id: &str,
    to_account_id: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("account transfer transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("account transfer actor id is required".to_string());
    }
    if transaction_type.trim().is_empty() {
        return Err("account transfer type is required".to_string());
    }
    if from_account_id.trim().is_empty() {
        return Err("account transfer source account id is required".to_string());
    }
    if to_account_id.trim().is_empty() {
        return Err("account transfer destination account id is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("account transfer idempotency key is required".to_string());
    }
    Ok(())
}

fn post_single_account_transaction(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    transaction_type: String,
    account_id: String,
    direction: String,
    amount: i128,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    validate_single_account_transaction_identity(&transaction_id, &actor_id, &transaction_type, &account_id, &direction, &idempotency_key)?;
    if amount <= 0 {
        return Err("amount must be positive".to_string());
    }
    validate_economy_reason(&reason)?;

    let metadata_json = single_account_metadata_json(&account_id, &direction, amount, &reason);
    if ensure_idempotent_economy_action(
        ctx,
        &idempotency_key,
        &actor_id,
        &transaction_type,
        &metadata_json,
    )? {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, &transaction_type)?;

    let Some(mut account) = ctx.db.accounts().id().find(account_id.clone()) else {
        return Err("unknown account".to_string());
    };
    if account.status != "active" {
        return Err("account is not active".to_string());
    }
    enforce_economy_limits(
        ctx,
        &transaction_type,
        &transaction_type,
        amount,
        &[&account],
    )?;
    if direction == "debit" && account.balance < amount {
        return Err("insufficient funds".to_string());
    }

    let before_json = account_balance_json(&account_id, account.balance);
    if direction == "debit" {
        account.balance -= amount;
    } else {
        account.balance += amount;
    }
    let after_json = account_balance_json(&account_id, account.balance);
    account.updated_at = ctx.timestamp;
    ctx.db.accounts().id().update(account);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: transaction_type.clone(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:{direction}"),
        transaction_id: transaction_id.clone(),
        account_id: account_id.clone(),
        direction,
        amount,
        reason,
        metadata_json,
        created_at: ctx.timestamp,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: transaction_type.clone(),
        permission_key: economy_permission_key(&transaction_type).to_string(),
        target_type: "account".to_string(),
        target_id: account_id.clone(),
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_single_account_transaction_identity(
    transaction_id: &str,
    actor_id: &str,
    transaction_type: &str,
    account_id: &str,
    direction: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("single-account transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("single-account actor id is required".to_string());
    }
    if transaction_type.trim().is_empty() {
        return Err("single-account transaction type is required".to_string());
    }
    if account_id.trim().is_empty() {
        return Err("single-account account id is required".to_string());
    }
    if direction.trim().is_empty() {
        return Err("single-account direction is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("single-account idempotency key is required".to_string());
    }
    Ok(())
}

fn enforce_economy_limits(
    ctx: &ReducerContext,
    permission_key: &str,
    action_type: &str,
    amount: i128,
    accounts: &[&Account],
) -> Result<(), String> {
    for limit in ctx.db.economy_limits().iter() {
        if !limit.enabled {
            continue;
        }
        if !(limit.permission_key == permission_key && limit.action_type == action_type) {
            continue;
        }

        if let Some(max_amount) = parse_limit_max_amount(&limit.limit_json) {
            if amount > max_amount {
                return Err(format!("economy limit exceeded: max amount {max_amount}"));
            }
        }

        if let Some(allowed_owner_types) = parse_limit_allowed_owner_types(&limit.limit_json) {
            for account in accounts {
                if !allowed_owner_types.iter().any(|owner_type| owner_type == &account.owner_type) {
                    return Err(format!("economy limit exceeded: account owner type {} is not allowed", account.owner_type));
                }
            }
        }
    }

    Ok(())
}

fn assert_economy_permission(
    ctx: &ReducerContext,
    actor_id: &str,
    transaction_type: &str,
) -> Result<(), String> {
    let permission_key = economy_permission_key(transaction_type);
    let mut principals_to_check = vec![actor_id.to_string()];
    let mut visited_principals: Vec<String> = Vec::new();
    let mut allowed = false;

    while let Some(principal_id) = principals_to_check.pop() {
        if visited_principals.iter().any(|visited| visited == &principal_id) {
            continue;
        }
        visited_principals.push(principal_id.clone());

        for grant in ctx.db.permission_grants().iter() {
            if grant.principal_id != principal_id || grant.permission_key != permission_key {
                continue;
            }
            if grant.expires_at.is_some_and(|expires_at| expires_at <= ctx.timestamp) {
                continue;
            }
            if grant.effect == "deny" {
                return Err("economy permission denied".to_string());
            }
            if grant.effect == "allow" {
                allowed = true;
            }
        }

        for edge in ctx.db.principal_edges().iter() {
            if edge.child_principal_id == principal_id {
                if edge.expires_at.is_some_and(|expires_at| expires_at <= ctx.timestamp) {
                    continue;
                }
                principals_to_check.push(edge.parent_principal_id);
            }
        }
    }

    if allowed {
        return Ok(());
    }

    return Err("economy permission denied".to_string());
}

fn economy_permission_key(transaction_type: &str) -> &str {
    match transaction_type {
        "economy.admin_adjust_balance" => "economy.admin.adjust_balance",
        _ => transaction_type,
    }
}

fn parse_limit_max_amount(limit_json: &str) -> Option<i128> {
    let trimmed = limit_json.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Some(0);
    }

    extract_i128_field(trimmed, "\"max_amount\"")
        .or_else(|| extract_i128_field(trimmed, "\"maxAmount\""))
}

fn parse_limit_allowed_owner_types(limit_json: &str) -> Option<Vec<String>> {
    let trimmed = limit_json.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Some(Vec::new());
    }

    extract_string_array_field(trimmed, "\"allowed_account_owner_types\"")
        .or_else(|| extract_string_array_field(trimmed, "\"allowedAccountOwnerTypes\""))
}

fn extract_i128_field(json: &str, key: &str) -> Option<i128> {
    let key_index = json.find(key)?;
    let after_key = &json[key_index + key.len()..];
    let colon_index = after_key.find(':')?;
    let after_colon = after_key[colon_index + 1..].trim_start();
    let number: String = after_colon
        .chars()
        .take_while(|character| character.is_ascii_digit() || *character == '-')
        .collect();
    number.parse::<i128>().ok()
}

fn extract_string_array_field(json: &str, key: &str) -> Option<Vec<String>> {
    let key_index = json.find(key)?;
    let after_key = &json[key_index + key.len()..];
    let colon_index = after_key.find(':')?;
    let after_colon = after_key[colon_index + 1..].trim_start();
    let array_start = after_colon.find('[')?;
    let after_array_start = &after_colon[array_start + 1..];
    let array_end = after_array_start.find(']')?;
    let array_body = &after_array_start[..array_end];
    Some(
        array_body
            .split(',')
            .map(|value| value.trim().trim_matches('"').to_string())
            .filter(|value| !value.is_empty())
            .collect()
    )
}

fn transaction_exists(ctx: &ReducerContext, idempotency_key: &str) -> bool {
    ctx.db
        .transactions()
        .iter()
        .any(|transaction| transaction.idempotency_key == idempotency_key)
}

fn ensure_idempotent_transfer(
    ctx: &ReducerContext,
    idempotency_key: &str,
    actor_id: &str,
    metadata_json: &str,
) -> Result<bool, String> {
    ensure_idempotent_economy_action(
        ctx,
        idempotency_key,
        actor_id,
        "economy.transfer",
        metadata_json,
    )
}

fn ensure_idempotent_economy_action(
    ctx: &ReducerContext,
    idempotency_key: &str,
    actor_id: &str,
    transaction_type: &str,
    metadata_json: &str,
) -> Result<bool, String> {
    if !transaction_exists(ctx, idempotency_key) {
        return Ok(false);
    }

    for transaction in ctx.db.transactions().iter() {
        if transaction.idempotency_key != idempotency_key {
            continue;
        }

        if transaction.transaction_type == transaction_type
            && transaction.actor_id == actor_id
            && transaction.metadata_json == metadata_json
        {
            return Ok(true);
        }

        return Err("idempotency conflict".to_string());
    }

    Ok(false)
}

fn transfer_metadata_json(
    from_account_id: &str,
    to_account_id: &str,
    amount: i128,
    reason: &str,
) -> String {
    format!(
        "{{\"amount\":{},\"from_account_id\":\"{}\",\"reason\":\"{}\",\"to_account_id\":\"{}\"}}",
        amount,
        json_escape(from_account_id),
        json_escape(reason),
        json_escape(to_account_id)
    )
}

fn single_account_metadata_json(
    account_id: &str,
    direction: &str,
    amount: i128,
    reason: &str,
) -> String {
    format!(
        "{{\"account_id\":\"{}\",\"amount\":{},\"direction\":\"{}\",\"reason\":\"{}\"}}",
        json_escape(account_id),
        amount,
        json_escape(direction),
        json_escape(reason)
    )
}

fn account_pair_balance_json(
    from_account_id: &str,
    from_balance: i128,
    to_account_id: &str,
    to_balance: i128,
) -> String {
    format!(
        "{{\"{}\":{},\"{}\":{}}}",
        json_escape(from_account_id),
        from_balance,
        json_escape(to_account_id),
        to_balance
    )
}

fn account_balance_json(account_id: &str, balance: i128) -> String {
    format!("{{\"{}\":{}}}", json_escape(account_id), balance)
}

fn account_balances_json(balances: &[(String, i128)]) -> String {
    let entries: Vec<String> = balances
        .iter()
        .map(|(account_id, balance)| format!("\"{}\":{}", json_escape(account_id), balance))
        .collect();
    format!("{{{}}}", entries.join(","))
}

fn item_transaction_reason(action: &str, item_key: &str) -> String {
    format!("{action}:{}", json_escape(item_key))
}

fn validate_item_transaction_identity(item_key: &str, field_name: &str) -> Result<(), String> {
    if item_key.trim().is_empty() {
        return Err(format!("{field_name} is required"));
    }
    Ok(())
}

fn item_transaction_metadata_json(item_key: &str, quantity: u64) -> String {
    format!(
        "{{\"item_key\":\"{}\",\"quantity\":{}}}",
        json_escape(item_key),
        quantity
    )
}

#[reducer]
pub fn void_transaction(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    voided_transaction_id: String,
    reason: String,
    idempotency_key: String,
) -> Result<(), String> {
    validate_void_transaction_identity(&transaction_id, &actor_id, &voided_transaction_id, &idempotency_key)?;
    validate_economy_reason(&reason)?;
    let metadata_json = format!(
        "{{\"reason\":\"{}\",\"voided_transaction_id\":\"{}\"}}",
        json_escape(&reason),
        json_escape(&voided_transaction_id)
    );
    if ensure_idempotent_economy_action(
        ctx,
        &idempotency_key,
        &actor_id,
        "economy.void_transaction",
        &metadata_json,
    )? {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, "economy.void_transaction")?;

    if ctx
        .db
        .transactions()
        .iter()
        .any(|transaction| {
            transaction.transaction_type == "economy.void_transaction"
                && transaction.metadata_json.contains(&format!(
                    "\"voided_transaction_id\":\"{}\"",
                    json_escape(&voided_transaction_id)
                ))
        })
    {
        return Err("transaction is already voided".to_string());
    }

    let Some(voided_transaction) = ctx.db.transactions().id().find(voided_transaction_id.clone()) else {
        return Err("unknown transaction".to_string());
    };
    if voided_transaction.status != "completed" {
        return Err("transaction is not completed".to_string());
    }

    let mut reversals: Vec<(String, String, i128, String)> = Vec::new();
    for entry in ctx.db.ledger_entries().iter() {
        if entry.transaction_id == voided_transaction_id {
            reversals.push((
                entry.id,
                entry.account_id,
                entry.amount,
                reverse_ledger_direction(&entry.direction)?,
            ));
        }
    }
    if reversals.is_empty() {
        return Err("transaction has no ledger entries".to_string());
    }

    let mut before_balances: Vec<(String, i128)> = Vec::new();
    for (_entry_id, account_id, amount, direction) in &reversals {
        let Some(account) = ctx.db.accounts().id().find(account_id.clone()) else {
            return Err("unknown account".to_string());
        };
        if account.status != "active" {
            return Err("account is not active".to_string());
        }
        if direction == "debit" && account.balance < *amount {
            return Err("insufficient funds".to_string());
        }
        before_balances.push((account_id.clone(), account.balance));
    }
    let before_json = account_balances_json(&before_balances);

    let mut after_balances: Vec<(String, i128)> = Vec::new();
    for (entry_id, account_id, amount, direction) in reversals {
        let mut account = ctx.db.accounts().id().find(account_id.clone()).unwrap();
        if direction == "debit" {
            account.balance -= amount;
        } else {
            account.balance += amount;
        }
        account.updated_at = ctx.timestamp;
        after_balances.push((account_id.clone(), account.balance));
        ctx.db.accounts().id().update(account);
        ctx.db.ledger_entries().insert(LedgerEntry {
            id: format!("{transaction_id}:void:{entry_id}"),
            transaction_id: transaction_id.clone(),
            account_id,
            direction,
            amount,
            reason: reason.clone(),
            metadata_json: metadata_json.clone(),
            created_at: ctx.timestamp,
        });
    }
    let after_json = account_balances_json(&after_balances);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: "economy.void_transaction".to_string(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: "economy.void_transaction".to_string(),
        permission_key: "economy.void_transaction".to_string(),
        target_type: "transaction".to_string(),
        target_id: voided_transaction_id,
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_void_transaction_identity(
    transaction_id: &str,
    actor_id: &str,
    voided_transaction_id: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("void transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("void transaction actor id is required".to_string());
    }
    if voided_transaction_id.trim().is_empty() {
        return Err("voided transaction id is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("void transaction idempotency key is required".to_string());
    }
    Ok(())
}

fn reverse_ledger_direction(direction: &str) -> Result<String, String> {
    match direction {
        "debit" => Ok("credit".to_string()),
        "credit" => Ok("debit".to_string()),
        _ => Err("invalid ledger direction".to_string()),
    }
}

fn json_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[reducer]
pub fn issue_invoice(
    ctx: &ReducerContext,
    id: String,
    issuer_account_id: String,
    payer_account_id: String,
    amount: i128,
    currency: String,
    reason: String,
    issued_by: String,
    idempotency_key: String,
    due_at: Option<Timestamp>,
) -> Result<(), String> {
    validate_invoice_issue_identity(&id, &issuer_account_id, &payer_account_id, &currency, &issued_by, &idempotency_key)?;
    validate_economy_reason(&reason)?;
    let metadata_json = invoice_issue_metadata_json(
        &issuer_account_id,
        &payer_account_id,
        amount,
        &currency,
        &reason,
        &issued_by,
        due_at.is_some(),
    );
    if ensure_idempotent_invoice_issue(ctx, &idempotency_key, &metadata_json)? {
        return Ok(());
    }

    if amount <= 0 {
        return Err("amount must be positive".to_string());
    }
    assert_economy_permission(ctx, &issued_by, "economy.issue_invoice")?;
    let Some(issuer) = ctx.db.accounts().id().find(issuer_account_id.clone()) else {
        return Err("unknown issuer account".to_string());
    };
    let Some(payer) = ctx.db.accounts().id().find(payer_account_id.clone()) else {
        return Err("unknown payer account".to_string());
    };
    if issuer.status != "active" || payer.status != "active" {
        return Err("account is not active".to_string());
    }
    if issuer.currency != currency || payer.currency != currency {
        return Err("currency mismatch".to_string());
    }

    let after_json = invoice_issue_audit_json(&id, &metadata_json);
    ctx.db.invoices().insert(Invoice {
        id: id.clone(),
        issuer_account_id,
        payer_account_id,
        amount,
        currency,
        reason,
        status: "issued".to_string(),
        issued_by: issued_by.clone(),
        idempotency_key,
        issued_at: ctx.timestamp,
        due_at,
        paid_at: None,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{id}:audit"),
        server_id: "global".to_string(),
        actor_id: issued_by.clone(),
        plugin_id: String::new(),
        action_type: "economy.issue_invoice".to_string(),
        permission_key: "economy.issue_invoice".to_string(),
        target_type: "invoice".to_string(),
        target_id: id,
        before_json: "{}".to_string(),
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_invoice_issue_identity(
    id: &str,
    issuer_account_id: &str,
    payer_account_id: &str,
    currency: &str,
    issued_by: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("invoice id is required".to_string());
    }
    if issuer_account_id.trim().is_empty() {
        return Err("invoice issuer account id is required".to_string());
    }
    if payer_account_id.trim().is_empty() {
        return Err("invoice payer account id is required".to_string());
    }
    if currency.trim().is_empty() {
        return Err("invoice currency is required".to_string());
    }
    if issued_by.trim().is_empty() {
        return Err("invoice issuer actor is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("invoice idempotency key is required".to_string());
    }
    Ok(())
}

fn validate_economy_reason(reason: &str) -> Result<(), String> {
    if reason.trim().is_empty() {
        return Err("reason must be a non-empty string".to_string());
    }

    Ok(())
}

fn ensure_idempotent_invoice_issue(
    ctx: &ReducerContext,
    idempotency_key: &str,
    metadata_json: &str,
) -> Result<bool, String> {
    for invoice in ctx.db.invoices().iter() {
        if invoice.idempotency_key != idempotency_key {
            continue;
        }

        if invoice_issue_metadata_json(
            &invoice.issuer_account_id,
            &invoice.payer_account_id,
            invoice.amount,
            &invoice.currency,
            &invoice.reason,
            &invoice.issued_by,
            invoice.due_at.is_some(),
        ) == metadata_json
        {
            return Ok(true);
        }

        return Err("invoice idempotency conflict".to_string());
    }

    Ok(false)
}

fn invoice_issue_metadata_json(
    issuer_account_id: &str,
    payer_account_id: &str,
    amount: i128,
    currency: &str,
    reason: &str,
    issued_by: &str,
    has_due_at: bool,
) -> String {
    format!(
        "{{\"amount\":{},\"currency\":\"{}\",\"due_at\":{},\"issued_by\":\"{}\",\"issuer_account_id\":\"{}\",\"payer_account_id\":\"{}\",\"reason\":\"{}\"}}",
        amount,
        json_escape(currency),
        if has_due_at { "true" } else { "false" },
        json_escape(issued_by),
        json_escape(issuer_account_id),
        json_escape(payer_account_id),
        json_escape(reason)
    )
}

fn invoice_issue_audit_json(id: &str, metadata_json: &str) -> String {
    format!(
        "{{\"invoice_id\":\"{}\",\"invoice\":{}}}",
        json_escape(id),
        metadata_json
    )
}

#[reducer]
pub fn pay_invoice(
    ctx: &ReducerContext,
    transaction_id: String,
    actor_id: String,
    invoice_id: String,
    idempotency_key: String,
) -> Result<(), String> {
    validate_invoice_payment_identity(&transaction_id, &actor_id, &invoice_id, &idempotency_key)?;

    let Some(mut invoice) = ctx.db.invoices().id().find(invoice_id) else {
        return Err("unknown invoice".to_string());
    };

    let metadata_json = invoice_payment_metadata_json(&invoice);
    if ensure_idempotent_economy_action(
        ctx,
        &idempotency_key,
        &actor_id,
        "economy.pay_invoice",
        &metadata_json,
    )? {
        return Ok(());
    }
    assert_economy_permission(ctx, &actor_id, "economy.pay_invoice")?;

    if invoice.status != "issued" {
        return Err("invoice is not payable".to_string());
    }
    if invoice.amount <= 0 {
        return Err("amount must be positive".to_string());
    }

    let Some(mut payer) = ctx.db.accounts().id().find(invoice.payer_account_id.clone()) else {
        return Err("unknown payer account".to_string());
    };
    let Some(mut issuer) = ctx.db.accounts().id().find(invoice.issuer_account_id.clone()) else {
        return Err("unknown issuer account".to_string());
    };

    if payer.status != "active" || issuer.status != "active" {
        return Err("account is not active".to_string());
    }
    if payer.currency != invoice.currency || issuer.currency != invoice.currency {
        return Err("currency mismatch".to_string());
    }

    enforce_economy_limits(
        ctx,
        "economy.pay_invoice",
        "economy.pay_invoice",
        invoice.amount,
        &[&payer, &issuer],
    )?;

    if payer.balance < invoice.amount {
        return Err("insufficient funds".to_string());
    }

    let before_json = account_pair_balance_json(&invoice.payer_account_id, payer.balance, &invoice.issuer_account_id, issuer.balance);
    payer.balance -= invoice.amount;
    issuer.balance += invoice.amount;
    let after_json = account_pair_balance_json(&invoice.payer_account_id, payer.balance, &invoice.issuer_account_id, issuer.balance);
    payer.updated_at = ctx.timestamp;
    issuer.updated_at = ctx.timestamp;
    ctx.db.accounts().id().update(payer);
    ctx.db.accounts().id().update(issuer);

    ctx.db.transactions().insert(Transaction {
        id: transaction_id.clone(),
        transaction_type: "economy.pay_invoice".to_string(),
        actor_id: actor_id.clone(),
        status: "completed".to_string(),
        idempotency_key,
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
        completed_at: Some(ctx.timestamp),
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:invoice_debit"),
        transaction_id: transaction_id.clone(),
        account_id: invoice.payer_account_id.clone(),
        direction: "debit".to_string(),
        amount: invoice.amount,
        reason: invoice.reason.clone(),
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
    });
    ctx.db.ledger_entries().insert(LedgerEntry {
        id: format!("{transaction_id}:invoice_credit"),
        transaction_id: transaction_id.clone(),
        account_id: invoice.issuer_account_id.clone(),
        direction: "credit".to_string(),
        amount: invoice.amount,
        reason: invoice.reason.clone(),
        metadata_json: metadata_json.clone(),
        created_at: ctx.timestamp,
    });
    ctx.db.audit_logs().insert(AuditLog {
        id: format!("{transaction_id}:audit"),
        server_id: "global".to_string(),
        actor_id,
        plugin_id: String::new(),
        action_type: "economy.pay_invoice".to_string(),
        permission_key: "economy.pay_invoice".to_string(),
        target_type: "invoice".to_string(),
        target_id: invoice.id.clone(),
        before_json,
        after_json,
        status: "succeeded".to_string(),
        created_at: ctx.timestamp,
    });

    invoice.status = "paid".to_string();
    invoice.paid_at = Some(ctx.timestamp);
    ctx.db.invoices().id().update(invoice);
    Ok(())
}

fn validate_invoice_payment_identity(
    transaction_id: &str,
    actor_id: &str,
    invoice_id: &str,
    idempotency_key: &str,
) -> Result<(), String> {
    if transaction_id.trim().is_empty() {
        return Err("invoice payment transaction id is required".to_string());
    }
    if actor_id.trim().is_empty() {
        return Err("invoice payment actor id is required".to_string());
    }
    if invoice_id.trim().is_empty() {
        return Err("paid invoice id is required".to_string());
    }
    if idempotency_key.trim().is_empty() {
        return Err("invoice payment idempotency key is required".to_string());
    }
    Ok(())
}

fn invoice_payment_metadata_json(invoice: &Invoice) -> String {
    format!(
        "{{\"amount\":{},\"due_at\":{},\"invoice_id\":\"{}\",\"issuer_account_id\":\"{}\",\"payer_account_id\":\"{}\",\"reason\":\"{}\"}}",
        invoice.amount,
        invoice_due_metadata_json(invoice),
        json_escape(&invoice.id),
        json_escape(&invoice.issuer_account_id),
        json_escape(&invoice.payer_account_id),
        json_escape(&invoice.reason)
    )
}

fn invoice_due_metadata_json(invoice: &Invoice) -> &'static str {
    if invoice.due_at.is_some() {
        "true"
    } else {
        "false"
    }
}
