#[reducer]
pub fn register_item(
    ctx: &ReducerContext,
    key: String,
    plugin_id: String,
    label: String,
    stackable: bool,
    max_stack: u64,
) -> Result<(), String> {
    validate_item_registration_identity(&key, &plugin_id, &label)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before item writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before item writes".to_string());
    }
    ctx.db.items().insert(Item {
        key,
        plugin_id,
        label,
        stackable,
        max_stack,
    });
    Ok(())
}

fn validate_item_registration_identity(key: &str, plugin_id: &str, label: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("item key is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("item plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("item label is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_job(
    ctx: &ReducerContext,
    key: String,
    plugin_id: String,
    label: String,
    grades_json: String,
) -> Result<(), String> {
    validate_job_registration_identity(&key, &plugin_id, &label, &grades_json)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before job writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before job writes".to_string());
    }
    ctx.db.jobs().insert(Job {
        key,
        plugin_id,
        label,
        grades_json,
    });
    Ok(())
}

fn validate_job_registration_identity(key: &str, plugin_id: &str, label: &str, grades_json: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("job key is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("job plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("job label is required".to_string());
    }
    if grades_json.trim().is_empty() {
        return Err("job grades json is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_vehicle(
    ctx: &ReducerContext,
    model: String,
    plugin_id: String,
    label: String,
    category: String,
) -> Result<(), String> {
    validate_vehicle_registration_identity(&model, &plugin_id, &label, &category)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before vehicle writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before vehicle writes".to_string());
    }
    ctx.db.vehicles().insert(Vehicle {
        model,
        plugin_id,
        label,
        category,
    });
    Ok(())
}

fn validate_vehicle_registration_identity(model: &str, plugin_id: &str, label: &str, category: &str) -> Result<(), String> {
    if model.trim().is_empty() {
        return Err("vehicle model is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("vehicle plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("vehicle label is required".to_string());
    }
    if category.trim().is_empty() {
        return Err("vehicle category is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn register_location(
    ctx: &ReducerContext,
    key: String,
    plugin_id: String,
    label: String,
    x: f64,
    y: f64,
    z: f64,
) -> Result<(), String> {
    validate_location_registration_identity(&key, &plugin_id, &label)?;
    if !plugin_exists(ctx, &plugin_id) {
        return Err("plugin must exist before location writes".to_string());
    }
    if !plugin_is_active(ctx, &plugin_id) {
        return Err("plugin must be active before location writes".to_string());
    }
    ctx.db.locations().insert(Location {
        key,
        plugin_id,
        label,
        x,
        y,
        z,
    });
    Ok(())
}

fn validate_location_registration_identity(key: &str, plugin_id: &str, label: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("location key is required".to_string());
    }
    if plugin_id.trim().is_empty() {
        return Err("location plugin id is required".to_string());
    }
    if label.trim().is_empty() {
        return Err("location label is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn upsert_character(
    ctx: &ReducerContext,
    id: String,
    player_principal_id: String,
    citizen_id: String,
    cid: u64,
    slot: u64,
    license: String,
    name: String,
    charinfo_json: String,
    metadata_json: String,
    gang_json: String,
    position_json: String,
    phone_number: String,
    account_number: String,
    selected: bool,
) -> Result<(), String> {
    validate_character_identity(&id, &player_principal_id, &citizen_id, cid, slot)?;

    if selected {
        for mut character in ctx.db.characters().iter() {
            if character.player_principal_id == player_principal_id && character.id != id && character.selected {
                character.selected = false;
                character.updated_at = ctx.timestamp;
                ctx.db.characters().id().update(character);
            }
        }
    }

    let character = Character {
        id: id.clone(),
        player_principal_id,
        citizen_id,
        cid,
        slot,
        license,
        name,
        charinfo_json,
        metadata_json,
        gang_json,
        position_json,
        phone_number,
        account_number,
        selected,
        updated_at: ctx.timestamp,
    };

    if ctx.db.characters().id().find(id).is_some() {
        ctx.db.characters().id().update(character);
    } else {
        ctx.db.characters().insert(character);
    }
    Ok(())
}

fn validate_character_identity(
    id: &str,
    player_principal_id: &str,
    citizen_id: &str,
    cid: u64,
    slot: u64,
) -> Result<(), String> {
    if id.trim().is_empty() {
        return Err("character id is required".to_string());
    }
    if player_principal_id.trim().is_empty() {
        return Err("character player principal id is required".to_string());
    }
    if citizen_id.trim().is_empty() {
        return Err("character citizen id is required".to_string());
    }
    if cid == 0 {
        return Err("character cid must be positive".to_string());
    }
    if slot == 0 {
        return Err("character slot must be positive".to_string());
    }
    Ok(())
}

#[reducer]
pub fn grant_item(
    ctx: &ReducerContext,
    _id: String,
    owner_id: String,
    item_key: String,
    quantity: u64,
) -> Result<(), String> {
    validate_inventory_grant_identity(&owner_id, &item_key)?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    let Some(item) = ctx.db.items().key().find(item_key.clone()) else {
        return Err("unknown item".to_string());
    };
    let stack_id = inventory_stack_id(&owner_id, &item_key);

    if let Some(mut existing) = ctx.db.inventory_stacks().id().find(stack_id.clone()) {
        let next_quantity = existing.quantity + quantity;
        if item.max_stack > 0 && next_quantity > item.max_stack {
            return Err("item stack limit exceeded".to_string());
        }

        existing.quantity += quantity;
        existing.updated_at = ctx.timestamp;
        ctx.db.inventory_stacks().id().update(existing);
        return Ok(());
    }

    if item.max_stack > 0 && quantity > item.max_stack {
        return Err("item stack limit exceeded".to_string());
    }

    ctx.db.inventory_stacks().insert(InventoryStack {
        id: stack_id,
        owner_id,
        item_key,
        quantity,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

#[reducer]
pub fn remove_item(
    ctx: &ReducerContext,
    _id: String,
    owner_id: String,
    item_key: String,
    quantity: u64,
) -> Result<(), String> {
    validate_inventory_grant_identity(&owner_id, &item_key)?;
    if quantity == 0 {
        return Err("quantity must be positive".to_string());
    }

    let stack_id = inventory_stack_id(&owner_id, &item_key);
    let Some(mut existing) = ctx.db.inventory_stacks().id().find(stack_id.clone()) else {
        return Err("inventory stack not found".to_string());
    };
    if existing.quantity < quantity {
        return Err("insufficient item quantity".to_string());
    }

    if existing.quantity == quantity {
        ctx.db.inventory_stacks().id().delete(stack_id);
        return Ok(());
    }

    existing.quantity -= quantity;
    existing.updated_at = ctx.timestamp;
    ctx.db.inventory_stacks().id().update(existing);
    Ok(())
}

fn validate_inventory_grant_identity(owner_id: &str, item_key: &str) -> Result<(), String> {
    if owner_id.trim().is_empty() {
        return Err("inventory grant owner id is required".to_string());
    }
    if item_key.trim().is_empty() {
        return Err("inventory grant item key is required".to_string());
    }
    Ok(())
}

#[reducer]
pub fn assign_job(
    ctx: &ReducerContext,
    character_id: String,
    job_key: String,
    grade: String,
    on_duty: bool,
) -> Result<(), String> {
    validate_job_assignment_identity(&character_id, &job_key, &grade)?;
    let Some(job) = ctx.db.jobs().key().find(job_key.clone()) else {
        return Err("unknown job".to_string());
    };
    if !grade_exists(&job.grades_json, &grade) {
        return Err("unknown job grade".to_string());
    }

    if let Some(mut existing) = ctx.db.character_jobs().character_id().find(character_id.clone()) {
        existing.job_key = job_key;
        existing.grade = grade;
        existing.on_duty = on_duty;
        existing.updated_at = ctx.timestamp;
        ctx.db.character_jobs().character_id().update(existing);
        return Ok(());
    }

    ctx.db.character_jobs().insert(CharacterJob {
        character_id,
        job_key,
        grade,
        on_duty,
        updated_at: ctx.timestamp,
    });
    Ok(())
}

fn validate_job_assignment_identity(character_id: &str, job_key: &str, grade: &str) -> Result<(), String> {
    if character_id.trim().is_empty() {
        return Err("job assignment character id is required".to_string());
    }
    if job_key.trim().is_empty() {
        return Err("job assignment job key is required".to_string());
    }
    if grade.trim().is_empty() {
        return Err("job assignment grade is required".to_string());
    }
    Ok(())
}

fn inventory_stack_id(owner_id: &str, item_key: &str) -> String {
    format!("{owner_id}:{item_key}")
}

fn grade_exists(grades_json: &str, grade: &str) -> bool {
    grades_json
        .split(|character| character == ',' || character == '[' || character == ']')
        .map(|candidate| candidate.trim().trim_matches('"'))
        .any(|candidate| candidate == grade)
}
