const chat = document.querySelector(".chat");
const messages = document.querySelector("#messages");
const form = document.querySelector("#form");
const input = document.querySelector("#input");

window.addEventListener("message", (event) => {
  if (event.data?.type === "sdb_poc_chat:open") {
    chat.classList.toggle("open", Boolean(event.data.open));
    input.value = event.data.slash ? "/" : "";
    if (event.data.open) {
      setTimeout(() => input.focus(), 0);
    }
  }

  if (event.data?.type === "sdb_poc_chat:message") {
    appendMessage(event.data.entry || {});
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  fetch(`https://${GetParentResourceName()}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ message: input.value })
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    fetch(`https://${GetParentResourceName()}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: "{}"
    });
  }
});

function appendMessage(entry) {
  const item = document.createElement("li");
  const name = document.createElement("strong");
  const text = document.createElement("span");
  name.textContent = entry.name || "server";
  text.textContent = entry.message || "";
  item.append(name, text);
  messages.append(item);
  while (messages.children.length > 10) {
    messages.firstElementChild.remove();
  }
  messages.scrollTop = messages.scrollHeight;
}
