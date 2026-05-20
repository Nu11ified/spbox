local function clean(value)
  return tostring(value or ''):gsub('[\r\n]', ' '):sub(1, 180)
end

local adminEndpoint = GetConvar('sdb_poc_admin_endpoint', '')
local pluginBootstrapped = false
local pluginReady = false
local messageCount = 0

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
      print(('[sdb_poc_chat] admin write failed %s HTTP %s %s'):format(path, status, response or ''))
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
    pluginId = 'sdb_poc_chat',
    name = 'SPBox POC Chat',
    version = '0.1.0'
  })
  SetTimeout(250, function()
    PostAdmin('/plugins/sdb_poc_chat/enable', {})
    PostAdmin('/plugins/schemas', {
      pluginId = 'sdb_poc_chat',
      schemaVersion = 1,
      entityType = 'chat_message',
      schemaJson = '{"type":"object","required":["name","message","source"],"properties":{"name":{"type":"string"},"message":{"type":"string"},"source":{"type":"number"}}}',
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

RegisterNetEvent('sdb_poc_chat:message', function(message)
  local src = source
  local text = clean(message)
  if text == '' then
    return
  end

  local name = clean(GetPlayerName(src) or ('Player %s'):format(src))
  messageCount = messageCount + 1
  PostPluginEntity({
    id = ('sdb_poc_chat:message:%s:%s'):format(src, messageCount),
    pluginId = 'sdb_poc_chat',
    entityType = 'chat_message',
    ownerType = 'player',
    ownerId = ('player:%s'):format(src),
    dataJson = json.encode({
      name = name,
      message = text,
      source = src
    })
  })
  TriggerClientEvent('sdb_poc_chat:message', -1, {
    name = name,
    message = text
  })
end)

AddEventHandler('playerJoining', function()
  bootstrapPlugin()
  local src = source
  TriggerClientEvent('sdb_poc_chat:message', -1, {
    name = 'server',
    message = ('%s joined'):format(clean(GetPlayerName(src) or src))
  })
end)
