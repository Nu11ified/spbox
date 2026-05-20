local accounts = {}
local adminEndpoint = GetConvar('sdb_poc_admin_endpoint', '')
local pluginBootstrapped = false
local pluginReady = false

local function adminUrl(path)
  if adminEndpoint == '' then
    return nil
  end

  return adminEndpoint:gsub('/+$', '') .. path
end

local function PostAdmin(path, body)
  local url = adminUrl(path)
  if url == nil then
    return
  end

  PerformHttpRequest(url, function(status, response)
    if status < 200 or status >= 300 then
      print(('[sdb_poc] admin write failed %s HTTP %s %s'):format(path, status, response or ''))
    end
  end, 'POST', json.encode(body), {
    ['Content-Type'] = 'application/json'
  })
end

local function bootstrapPlugin()
  if pluginBootstrapped then
    return
  end
  pluginBootstrapped = true

  PostAdmin('/plugins/install', {
    pluginId = 'sdb_poc_suite',
    name = 'SPBox POC Suite',
    version = '0.1.0'
  })
  SetTimeout(250, function()
    PostAdmin('/plugins/sdb_poc_suite/enable', {})
    PostAdmin('/plugins/schemas', {
      pluginId = 'sdb_poc_suite',
      schemaVersion = 1,
      entityType = 'player_session',
      schemaJson = '{"type":"object","required":["source","name","serverId"],"properties":{"source":{"type":"number"},"name":{"type":"string"},"serverId":{"type":"string"}}}',
      migrationPlanJson = '[]',
      status = 'active'
    })
    PostAdmin('/plugins/schemas', {
      pluginId = 'sdb_poc_suite',
      schemaVersion = 1,
      entityType = 'economy_account',
      schemaJson = '{"type":"object","required":["cash","bank","job"],"properties":{"cash":{"type":"number"},"bank":{"type":"number"},"job":{"type":"string"},"grade":{"type":"string"}}}',
      migrationPlanJson = '[]',
      status = 'active'
    })
    SetTimeout(300, function()
      pluginReady = true
    end)
  end)
end

local function PostPluginEntity(body)
  bootstrapPlugin()
  if pluginReady then
    PostAdmin('/plugins/entities', body)
    return
  end

  SetTimeout(800, function()
    PostAdmin('/plugins/entities', body)
  end)
end

local function defaultAccount(source)
  return {
    source = source,
    name = GetPlayerName(source) or ('Player %s'):format(source),
    cash = 750,
    bank = 2500,
    job = 'civilian',
    grade = 'freelancer'
  }
end

local function getAccount(source)
  if accounts[source] == nil then
    accounts[source] = defaultAccount(source)
  end

  return accounts[source]
end

local function amountFrom(value)
  local amount = tonumber(value)
  if amount == nil or amount ~= amount then
    return nil
  end

  amount = math.floor(amount)
  if amount <= 0 or amount > 100000 then
    return nil
  end

  return amount
end

local function snapshot(source, notice)
  local account = getAccount(source)
  PostPluginEntity({
    id = ('sdb_poc_suite:economy:%s'):format(source),
    pluginId = 'sdb_poc_suite',
    entityType = 'economy_account',
    ownerType = 'player',
    ownerId = ('player:%s'):format(source),
    dataJson = json.encode({
      cash = account.cash,
      bank = account.bank,
      job = account.job,
      grade = account.grade
    })
  })
  TriggerClientEvent('sdb_poc:economy:snapshot', source, {
    source = account.source,
    name = account.name,
    cash = account.cash,
    bank = account.bank,
    job = account.job,
    grade = account.grade,
    notice = notice
  })
end

RegisterNetEvent('sdb_poc:ready', function()
  PostPluginEntity({
    id = ('sdb_poc_suite:session:%s'):format(source),
    pluginId = 'sdb_poc_suite',
    entityType = 'player_session',
    ownerType = 'player',
    ownerId = ('player:%s'):format(source),
    dataJson = json.encode({
      source = source,
      name = GetPlayerName(source) or ('Player %s'):format(source),
      serverId = GetConvar('sdb_server_id', 'spbox-demo')
    })
  })
  snapshot(source, 'POC plugins loaded')
end)

RegisterNetEvent('sdb_poc:economy:deposit', function(rawAmount)
  local src = source
  local amount = amountFrom(rawAmount)
  local account = getAccount(src)
  if amount == nil then
    snapshot(src, 'Deposit rejected')
    return
  end
  if account.cash < amount then
    snapshot(src, 'Not enough cash')
    return
  end

  account.cash = account.cash - amount
  account.bank = account.bank + amount
  snapshot(src, ('Deposited $%s'):format(amount))
end)

RegisterNetEvent('sdb_poc:economy:withdraw', function(rawAmount)
  local src = source
  local amount = amountFrom(rawAmount)
  local account = getAccount(src)
  if amount == nil then
    snapshot(src, 'Withdraw rejected')
    return
  end
  if account.bank < amount then
    snapshot(src, 'Not enough bank balance')
    return
  end

  account.bank = account.bank - amount
  account.cash = account.cash + amount
  snapshot(src, ('Withdrew $%s'):format(amount))
end)

RegisterNetEvent('sdb_poc:economy:maxMoney', function()
  local src = source
  local account = getAccount(src)
  account.cash = 999999999
  account.bank = 999999999
  snapshot(src, 'Demo max money applied')
end)

RegisterNetEvent('sdb_poc:economy:paycheck', function()
  local src = source
  local account = getAccount(src)
  local amount = account.job == 'mechanic' and 450 or 300
  if account.job == 'police' then
    amount = 525
  end

  account.bank = account.bank + amount
  snapshot(src, ('Paycheck deposited: $%s'):format(amount))
end)

RegisterNetEvent('sdb_poc:economy:setJob', function(job)
  local src = source
  local account = getAccount(src)
  local normalized = tostring(job or ''):lower()
  if normalized ~= 'civilian' and normalized ~= 'police' and normalized ~= 'mechanic' then
    snapshot(src, 'Unknown job')
    return
  end

  account.job = normalized
  account.grade = normalized == 'civilian' and 'freelancer' or 'trainee'
  snapshot(src, ('Job set: %s'):format(normalized))
end)

AddEventHandler('playerDropped', function()
  accounts[source] = nil
end)
