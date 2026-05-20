const result = document.querySelector("#result");
const closeButton = document.querySelector("#close");
const menuTree = document.querySelector("#menu-tree");
let pendingActionId = null;
let runtimeContext = {};

window.addEventListener("message", (event) => {
  if (event.data?.type === "sdb_runtime:setVisible") {
    document.body.classList.toggle("visible", Boolean(event.data.visible));
  }

  if (event.data?.type === "sdb_runtime:menuTree") {
    renderMenuTree(event.data.tree || []);
  }

  if (event.data?.type === "sdb_runtime:context") {
    runtimeContext = event.data.context || {};
    applyRuntimeContextDefaults();
  }

  if (event.data?.type === "sdb_runtime:actionResult") {
    renderActionResult(event.data.result);
    clearPendingAction();
  }
});

menuTree.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action-id]");
  if (!button) {
    return;
  }

  if (pendingActionId !== null) {
    return;
  }

  if (button.dataset.confirmationRequired === "true" && !window.confirm(`Run ${button.textContent}?`)) {
    return;
  }

  const validation = validateActionPayload(button.closest("li"));
  if (!validation.ok) {
    renderValidationError(validation.error);
    return;
  }

  pendingActionId = button.dataset.actionId;
  button.disabled = true;

  fetch(`https://${GetParentResourceName()}/callAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      actionName: button.dataset.actionId,
      payload: collectActionPayload(button.closest("li"))
    })
  }).catch(() => {
    renderValidationError("Action request failed");
    clearPendingAction();
  });
});

closeButton.addEventListener("click", () => {
  fetch(`https://${GetParentResourceName()}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: "{}"
  });
});

function renderMenuTree(nodes) {
  menuTree.replaceChildren(renderNodes(nodes));
  applyPendingActionState();
}

function renderNodes(nodes) {
  const list = document.createElement("ul");

  for (const node of nodes) {
    const item = document.createElement("li");
    const label = document.createElement(node.actionId ? "button" : "strong");
    label.textContent = node.label;

    if (node.actionId) {
      label.className = "menu-action";
      label.dataset.actionId = node.actionId;
      if (node.confirmationRequired === true) {
        label.dataset.confirmationRequired = "true";
      }
    }

    item.append(label);
    renderActionPayloadFields(item, node.payloadSchema);
    if (Array.isArray(node.children) && node.children.length > 0) {
      item.append(renderNodes(node.children));
    }
    list.append(item);
  }

  return list;
}

function renderActionPayloadFields(item, schema) {
  if (!schema || schema.type !== "object" || !schema.properties) {
    return;
  }

  const requiredKeys = new Set(schema.required || []);
  const fieldKeys = [...new Set([...(schema.required || []), ...Object.keys(schema.properties)])];
  for (const key of fieldKeys) {
    const definition = schema.properties[key];
    if (!definition || !["string", "number", "boolean"].includes(definition.type)) {
      continue;
    }

    const field = document.createElement("label");
    field.className = "payload-field";
    field.textContent = key;

    const input = Array.isArray(definition.enum) ? document.createElement("select") : document.createElement("input");
    input.name = key;
    input.dataset.payloadKey = key;
    input.dataset.payloadType = definition.type;
    input.required = requiredKeys.has(key);
    if (Array.isArray(definition.enum)) {
      if (!input.required) {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "";
        input.append(emptyOption);
      }
      for (const optionValue of definition.enum) {
        const option = document.createElement("option");
        option.value = String(optionValue);
        option.textContent = String(optionValue);
        input.append(option);
      }
    } else {
      input.type = definition.type === "number" ? "number" : "text";
      if (definition.type === "boolean") {
        input.type = "checkbox";
      }
    }

    field.append(input);
    applyRuntimeContextDefault(input);
    item.append(field);
  }
}

function validateActionPayload(container) {
  if (!container) {
    return { ok: true };
  }

  for (const input of container.querySelectorAll("[data-payload-key]")) {
    if (input.dataset.payloadType === "boolean") {
      continue;
    }
    if (input.value.trim() === "") {
      if (!input.required) {
        continue;
      }
      return { ok: false, error: `${input.name} is required` };
    }
    if (input.dataset.payloadType === "number" && !Number.isFinite(Number(input.value))) {
      return { ok: false, error: `${input.name} must be a number` };
    }
  }

  return { ok: true };
}

function renderValidationError(message) {
  result.className = "result error";
  result.textContent = message;
}

function renderActionResult(actionResult) {
  if (!actionResult || typeof actionResult !== "object") {
    result.className = "result error";
    result.textContent = "Action failed";
    return;
  }

  result.className = actionResult.ok ? "result success" : "result error";
  result.textContent = actionResult.ok ? "Action completed" : formatActionError(actionResult.result);
}

function clearPendingAction() {
  if (pendingActionId === null) {
    return;
  }

  const button = menuTree.querySelector(`[data-action-id="${pendingActionId}"]`);
  if (button) {
    button.disabled = false;
  }
  pendingActionId = null;
}

function applyPendingActionState() {
  if (pendingActionId === null) {
    return;
  }

  const pendingButton = menuTree.querySelector(`[data-action-id="${pendingActionId}"]`);
  if (pendingButton) {
    pendingButton.disabled = true;
  }
}

function applyRuntimeContextDefault(input) {
  const contextValue = runtimeContext[input.dataset.payloadKey];
  if (contextValue === undefined || contextValue === null || input.value !== "") {
    return;
  }

  if (input.dataset.payloadType === "boolean") {
    input.checked = Boolean(contextValue);
    return;
  }

  input.value = String(contextValue);
}

function applyRuntimeContextDefaults() {
  for (const input of menuTree.querySelectorAll("[data-payload-key]")) {
    applyRuntimeContextDefault(input);
  }
}

function formatActionError(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value.message === "string") {
    return value.message;
  }

  if (value === undefined || value === null) {
    return "Action failed";
  }

  return JSON.stringify(value, null, 2);
}

function collectActionPayload(container) {
  const payload = {};
  if (!container) {
    return payload;
  }

  for (const input of container.querySelectorAll("[data-payload-key]")) {
    if (!input.required && input.value.trim() === "") {
      continue;
    }
    if (input.dataset.payloadType === "number") {
      const numberValue = Number(input.value);
      payload[input.dataset.payloadKey] = numberValue;
    } else if (input.dataset.payloadType === "boolean") {
      payload[input.dataset.payloadKey] = input.checked;
    } else {
      payload[input.dataset.payloadKey] = input.value;
    }
  }

  return payload;
}
