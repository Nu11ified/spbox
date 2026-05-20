const panel = document.querySelector(".panel");
const notice = document.querySelector("#notice");
const cash = document.querySelector("#cash");
const bank = document.querySelector("#bank");
const job = document.querySelector("#job");
const amount = document.querySelector("#amount");
const jobSelect = document.querySelector("#job-select");
const vehicle = document.querySelector("#vehicle");
const weather = document.querySelector("#weather");
const hour = document.querySelector("#hour");
const noclip = document.querySelector("#noclip");

let state = {
  account: {},
  vehicles: ["sultan"],
  weather: ["CLEAR"],
  noclip: false
};

window.addEventListener("message", (event) => {
  if (event.data?.type !== "sdb_poc:state") {
    return;
  }

  state = {
    ...state,
    account: event.data.account || state.account,
    vehicles: event.data.vehicles || state.vehicles,
    weather: event.data.weather || state.weather,
    noclip: Boolean(event.data.noclip)
  };
  panel.classList.toggle("visible", Boolean(event.data.visible));
  render(event.data.notice);
});

document.querySelector("#close").addEventListener("click", () => post("close"));

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === "deposit") {
    post("economyDeposit", { amount: amount.value });
  }
  if (action === "withdraw") {
    post("economyWithdraw", { amount: amount.value });
  }
  if (action === "paycheck") {
    post("economyPaycheck");
  }
  if (action === "maxMoney") {
    post("economyMaxMoney");
  }
  if (action === "setJob") {
    post("setJob", { job: jobSelect.value });
  }
  if (action === "spawnVehicle") {
    post("spawnVehicle", { model: vehicle.value });
  }
  if (action === "repairVehicle") {
    post("repairVehicle");
  }
  if (action === "spawnPlayer") {
    post("spawnPlayer");
  }
  if (action === "teleportWaypoint") {
    post("teleportWaypoint");
  }
  if (action === "setWeather") {
    post("setWeather", { weather: weather.value });
  }
  if (action === "setTime") {
    post("setTime", { hour: hour.value });
  }
  if (action === "toggleNoclip") {
    post("toggleNoclip");
  }
});

function post(action, payload = {}) {
  return fetch(`https://${GetParentResourceName()}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(payload)
  });
}

function render(nextNotice) {
  cash.textContent = money(state.account.cash);
  bank.textContent = money(state.account.bank);
  job.textContent = state.account.job || "civilian";
  notice.textContent = nextNotice || state.account.notice || "Ready";
  noclip.classList.toggle("active", state.noclip);
  syncOptions(vehicle, state.vehicles);
  syncOptions(weather, state.weather);
}

function syncOptions(select, values) {
  const current = select.value;
  select.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    return option;
  }));
  if (values.includes(current)) {
    select.value = current;
  }
}

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}
