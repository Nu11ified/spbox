local QBCore = {
  Players = {},
  Functions = {},
  Shared = exports.sdb_runtime:GetQbShared(),
  Config = {
    Server = {
      Permissions = { 'god', 'admin', 'mod', 'user' }
    }
  },
  Commands = {
    List = {},
    IgnoreList = {
      god = true,
      user = true
    }
  },
  Player = {},
  Player_Buckets = {},
  Entity_Buckets = {},
  PlayerOptIns = {},
  ServerCallbacks = {},
  ClientCallbacks = {},
  UseableItems = {}
}

local function IsFunction(value)
  return type(value) == 'function' or (type(value) == 'table' and rawget(value, '__cfx_functionReference') ~= nil)
end

local function EnsureSharedHelpers()
  QBCore.Shared = QBCore.Shared or exports.sdb_runtime:GetQbShared()

  function QBCore.Shared.Trim(value)
    if type(value) ~= 'string' then
      return value
    end

    return value:match('^%s*(.-)%s*$')
  end
end

EnsureSharedHelpers()

local function DistanceBetween(left, right)
  local dx = (left.x or 0.0) - (right.x or 0.0)
  local dy = (left.y or 0.0) - (right.y or 0.0)
  local dz = (left.z or 0.0) - (right.z or 0.0)
  return math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
end

local function ResolveCoords(source, coords)
  if type(coords) == 'table' and coords.x ~= nil and coords.y ~= nil and coords.z ~= nil then
    return coords
  end

  return GetEntityCoords(GetPlayerPed(source))
end

local function GetClosestEntityFromPool(pool, source, coords, ignoredEntity)
  local origin = ResolveCoords(source, coords)
  local closestEntity = 0
  local closestDistance = -1

  for _, entity in ipairs(pool or {}) do
    if entity ~= ignoredEntity then
      local distance = DistanceBetween(origin, GetEntityCoords(entity))
      if closestDistance == -1 or distance < closestDistance then
        closestEntity = entity
        closestDistance = distance
      end
    end
  end

  return closestEntity, closestDistance
end

local function RemoveFromBuckets(buckets, value)
  for _, entries in pairs(buckets) do
    entries[value] = nil
  end
end

function QBCore.Functions.GetPlayer(source)
  return exports.sdb_runtime:GetQbPlayer(source)
end

local function getShared(name)
  EnsureSharedHelpers()
  if name == nil then
    return QBCore.Shared
  end

  return QBCore.Shared[name] or QBCore.Shared[name:sub(1, 1):upper() .. name:sub(2)]
end

function QBCore.Functions.GetShared(name)
  return getShared(name)
end

local function fallbackIdentifier(source, idType)
  return QBCore.Functions.GetIdentifier(source, idType) or ('%s:spbox:%s'):format(idType or 'license', source)
end

local function characterRowsByCitizenId(citizenid)
  if GetResourceState('oxmysql') ~= 'started' then
    return {}
  end

  return exports.oxmysql:SpboxSelectRows('players', 'citizenid', citizenid) or {}
end

local function upsertCharacterRow(row)
  if GetResourceState('oxmysql') == 'started' then
    exports.oxmysql:SpboxUpsertRow('players', row)
  end
end

local function buildCharacterRow(source, citizenid, cid, charinfo)
  local license = fallbackIdentifier(source, 'license')
  local info = charinfo or {}
  local money = {
    cash = (QBCore.Shared.MoneyTypes and QBCore.Shared.MoneyTypes.cash) or 500,
    bank = (QBCore.Shared.MoneyTypes and QBCore.Shared.MoneyTypes.bank) or 5000,
    crypto = (QBCore.Shared.MoneyTypes and QBCore.Shared.MoneyTypes.crypto) or 0
  }
  local job = {
    name = 'unemployed',
    label = 'Unemployed',
    payment = 10,
    onduty = true,
    isboss = false,
    grade = {
      name = 'Freelancer',
      level = 0
    }
  }

  return {
    citizenid = citizenid,
    cid = cid or 1,
    license = license,
    name = ((info.firstname or 'SPBox') .. ' ' .. (info.lastname or 'Player')),
    money = json.encode(money),
    charinfo = json.encode(info),
    job = json.encode(job),
    gang = json.encode({ name = 'none', label = 'No Gang', grade = { name = 'none', level = 0 }, isboss = false }),
    position = json.encode({ x = -1037.76, y = -2737.82, z = 20.17, w = 0.0 }),
    metadata = json.encode({ hunger = 100, thirst = 100, inside = { apartment = {} } })
  }
end

local function rowToPlayerData(source, row)
  local function decode(value, fallback)
    if type(value) == 'table' then
      return value
    end
    if type(value) ~= 'string' or value == '' then
      return fallback
    end
    local ok, decoded = pcall(json.decode, value)
    if not ok then
      return fallback
    end
    return decoded
  end

  return {
    source = source,
    citizenid = row.citizenid,
    cid = tonumber(row.cid) or 1,
    license = row.license or fallbackIdentifier(source, 'license'),
    name = row.name,
    money = decode(row.money, {}),
    charinfo = decode(row.charinfo, {}),
    job = decode(row.job, {}),
    gang = decode(row.gang, {}),
    position = decode(row.position, {}),
    metadata = decode(row.metadata, {}),
    characterId = 'char:' .. tostring(row.citizenid)
  }
end

function QBCore.Player.Login(source, citizenid, newData)
  local src = tonumber(source)
  if src == nil then
    return false
  end

  local row
  if citizenid then
    row = characterRowsByCitizenId(citizenid)[1]
    if row == nil then
      row = buildCharacterRow(src, citizenid, 1, {})
      upsertCharacterRow(row)
    end
  else
    local cid = tonumber(newData and newData.cid) or 1
    local generatedCitizenId = ('SPB%05d%02d'):format(src, cid)
    row = buildCharacterRow(src, generatedCitizenId, cid, newData and newData.charinfo or {})
    upsertCharacterRow(row)
  end

  local player = exports.sdb_runtime:SelectQbCharacter(src, 'char:' .. tostring(row.citizenid), rowToPlayerData(src, row))
  if player ~= nil then
    TriggerEvent('QBCore:Server:PlayerLoaded', player)
    return true
  end

  return false
end

function QBCore.Player.Logout(source)
  local player = exports.sdb_runtime:GetQbPlayer(source)
  if player and player.Functions and player.Functions.Logout then
    player.Functions.Logout()
  end
  TriggerEvent('QBCore:Server:OnPlayerUnload', source)
  return true
end

function QBCore.Player.DeleteCharacter(source, citizenid)
  TriggerEvent('QBCore:Server:OnPlayerUnload', source)
  return true, citizenid
end

function QBCore.Player.ForceDeleteCharacter(citizenid)
  return true, citizenid
end

function QBCore.Functions.GetQBPlayers()
  QBCore.Players = exports.sdb_runtime:GetQbPlayers()
  return QBCore.Players
end

function QBCore.Functions.GetPlayers()
  return exports.sdb_runtime:GetQbPlayerSources()
end

function QBCore.Functions.GetIdentifier(source, idType)
  return exports.sdb_runtime:GetQbIdentifier(source, idType)
end

function QBCore.Functions.GetSource(identifier)
  return exports.sdb_runtime:GetQbSource(identifier)
end

function QBCore.Functions.GetPlayerByCitizenId(citizenid)
  return exports.sdb_runtime:GetQbPlayerByCitizenId(citizenid)
end

function QBCore.Functions.GetPlayerByPhone(number)
  return exports.sdb_runtime:GetQbPlayerByPhone(number)
end

function QBCore.Functions.GetPlayerByAccount(account)
  return exports.sdb_runtime:GetQbPlayerByAccount(account)
end

function QBCore.Functions.GetPlayerByCharInfo(key, value)
  return exports.sdb_runtime:GetQbPlayerByCharInfo(key, value)
end

function QBCore.Functions.GetPlayersOnDuty(job)
  return exports.sdb_runtime:GetQbPlayersOnDuty(job)
end

function QBCore.Functions.GetPlayersByJob(job, checkOnDuty)
  return exports.sdb_runtime:GetQbPlayersByJob(job, checkOnDuty)
end

function QBCore.Functions.GetDutyCount(job)
  return exports.sdb_runtime:GetQbDutyCount(job)
end

function QBCore.Functions.GetCoords(entity)
  local coords = GetEntityCoords(entity)
  return vector4(coords.x, coords.y, coords.z, GetEntityHeading(entity))
end

function QBCore.Functions.GetClosestObject(source, coords)
  return GetClosestEntityFromPool(GetAllObjects(), source, coords)
end

function QBCore.Functions.GetClosestVehicle(source, coords)
  return GetClosestEntityFromPool(GetAllVehicles(), source, coords)
end

function QBCore.Functions.GetClosestPed(source, coords)
  return GetClosestEntityFromPool(GetAllPeds(), source, coords, GetPlayerPed(source))
end

function QBCore.Functions.GetBucketObjects()
  return QBCore.Player_Buckets, QBCore.Entity_Buckets
end

function QBCore.Functions.GetPlayersInBucket(bucket)
  bucket = tonumber(bucket)
  if bucket == nil then
    return false
  end

  return QBCore.Player_Buckets[bucket]
end

function QBCore.Functions.GetEntitiesInBucket(bucket)
  bucket = tonumber(bucket)
  if bucket == nil then
    return false
  end

  return QBCore.Entity_Buckets[bucket]
end

function QBCore.Functions.SetEntityBucket(entity, bucket)
  entity = tonumber(entity)
  bucket = tonumber(bucket)
  if entity == nil or bucket == nil then
    return false
  end

  SetEntityRoutingBucket(entity, bucket)
  RemoveFromBuckets(QBCore.Entity_Buckets, entity)
  QBCore.Entity_Buckets[bucket] = QBCore.Entity_Buckets[bucket] or {}
  QBCore.Entity_Buckets[bucket][entity] = true
  return true
end

function QBCore.Functions.SetPlayerBucket(source, bucket)
  source = tonumber(source)
  bucket = tonumber(bucket)
  if source == nil or bucket == nil then
    return false
  end

  SetPlayerRoutingBucket(source, bucket)
  RemoveFromBuckets(QBCore.Player_Buckets, source)
  QBCore.Player_Buckets[bucket] = QBCore.Player_Buckets[bucket] or {}
  QBCore.Player_Buckets[bucket][source] = true
  return true
end

function QBCore.Functions.HasPermission(source, permission)
  if type(permission) == 'string' then
    if exports.sdb_runtime:HasPermission(source, permission) then
      return true
    end
    if IsPlayerAceAllowed(source, permission) then
      return true
    end
    if IsPlayerAceAllowed(source, ('qbcore.%s'):format(permission)) then
      return true
    end
    return false
  end

  if type(permission) == 'table' then
    for _, permLevel in pairs(permission) do
      if QBCore.Functions.HasPermission(source, permLevel) then
        return true
      end
    end
  end

  return false
end

function QBCore.Functions.GetPermission(source)
  local permissions = {}
  local runtimePermissions = exports.sdb_runtime:GetPermissions(source) or {}

  for permission, allowed in pairs(runtimePermissions) do
    if allowed == true then
      permissions[permission] = true
    end
  end

  for _, permission in ipairs(QBCore.Config.Server.Permissions) do
    if IsPlayerAceAllowed(source, permission) or IsPlayerAceAllowed(source, ('qbcore.%s'):format(permission)) then
      permissions[permission] = true
    end
  end

  return permissions
end

function QBCore.Functions.IsOptIn(source)
  return QBCore.PlayerOptIns[source] == true
end

function QBCore.Functions.IsOptin(source)
  return QBCore.Functions.IsOptIn(source)
end

function QBCore.Functions.ToggleOptIn(source)
  QBCore.PlayerOptIns[source] = not QBCore.PlayerOptIns[source]
  return QBCore.PlayerOptIns[source]
end

function QBCore.Functions.ToggleOptin(source)
  return QBCore.Functions.ToggleOptIn(source)
end

function QBCore.Functions.AddPermission(source, permission)
  if type(permission) ~= 'string' or permission == '' then
    return false
  end

  permission = permission:lower()
  if not IsPlayerAceAllowed(source, permission) then
    ExecuteCommand(('add_principal player.%s qbcore.%s'):format(source, permission))
  end
  QBCore.Commands.Refresh(source)
  return true
end

function QBCore.Functions.RemovePermission(source, permission)
  if permission ~= nil then
    if type(permission) ~= 'string' or permission == '' then
      return false
    end

    permission = permission:lower()
    ExecuteCommand(('remove_principal player.%s qbcore.%s'):format(source, permission))
    QBCore.Commands.Refresh(source)
    return true
  end

  for _, configuredPermission in ipairs(QBCore.Config.Server.Permissions) do
    ExecuteCommand(('remove_principal player.%s qbcore.%s'):format(source, configuredPermission))
  end
  QBCore.Commands.Refresh(source)
  return true
end

function QBCore.Commands.Add(name, help, arguments, argsrequired, callback, permission, ...)
  if type(name) ~= 'string' or name == '' or not IsFunction(callback) then
    return false
  end

  arguments = arguments or {}
  permission = permission or 'user'
  local restricted = permission ~= 'user'

  RegisterCommand(name, function(source, args, rawCommand)
    if argsrequired and #args < #arguments then
      TriggerClientEvent('chat:addMessage', source, {
        color = { 255, 0, 0 },
        multiline = true,
        args = { 'System', 'Missing required arguments' }
      })
      return
    end

    callback(source, args, rawCommand)
  end, restricted)

  local permissions = permission
  local extraPerms = table.pack(...)
  if extraPerms.n > 0 then
    permissions = {}
    for index = 1, extraPerms.n do
      permissions[#permissions + 1] = tostring(extraPerms[index]):lower()
    end
    permissions[#permissions + 1] = tostring(permission):lower()
  elseif type(permission) == 'string' then
    permissions = tostring(permission):lower()
  end

  if type(permissions) == 'table' then
    for _, permLevel in ipairs(permissions) do
      if not QBCore.Commands.IgnoreList[permLevel] then
        ExecuteCommand(('add_ace qbcore.%s command.%s allow'):format(permLevel, name))
      end
    end
  elseif not QBCore.Commands.IgnoreList[permissions] then
    ExecuteCommand(('add_ace qbcore.%s command.%s allow'):format(permissions, name))
  end

  QBCore.Commands.List[name:lower()] = {
    name = name:lower(),
    permission = permissions,
    help = help,
    arguments = arguments,
    argsrequired = argsrequired,
    callback = callback
  }
  return true
end

function QBCore.Commands.Refresh(source)
  local Player = QBCore.Functions.GetPlayer(source)
  local suggestions = {}

  if not Player then
    return suggestions
  end

  for command, info in pairs(QBCore.Commands.List) do
    if QBCore.Functions.HasPermission(source, info.permission) or IsPlayerAceAllowed(tostring(source), 'command.' .. command) then
      suggestions[#suggestions + 1] = {
        name = '/' .. command,
        help = info.help,
        params = info.arguments
      }
    else
      TriggerClientEvent('chat:removeSuggestion', source, '/' .. command)
    end
  end

  TriggerClientEvent('chat:addSuggestions', source, suggestions)
  return suggestions
end

function QBCore.Functions.CreateUseableItem(item, data)
  if type(item) ~= 'string' or item == '' then
    return false
  end

  if IsFunction(data) then
    QBCore.UseableItems[item] = { callback = data }
    return true
  end

  if type(data) == 'table' and IsFunction(data.callback) then
    QBCore.UseableItems[item] = data
    return true
  end

  return false
end

function QBCore.Functions.CanUseItem(item)
  local useable = QBCore.UseableItems[item]
  if useable == nil then
    return nil
  end

  return useable.callback or useable
end

function QBCore.Functions.HasItem(source, items, amount)
  local Player = QBCore.Functions.GetPlayer(source)
  if not Player or not Player.Functions then
    return false
  end

  local requiredAmount = tonumber(amount) or 1
  if type(items) == 'string' then
    return Player.Functions.HasItem(items, requiredAmount)
  end

  if type(items) ~= 'table' then
    return false
  end

  for itemName, itemAmount in pairs(items) do
    if type(itemName) == 'number' then
      itemName = itemAmount
      itemAmount = requiredAmount
    end

    if type(itemName) ~= 'string' or not Player.Functions.HasItem(itemName, tonumber(itemAmount) or requiredAmount) then
      return false
    end
  end

  return true
end

function QBCore.Functions.UseItem(source, item)
  local itemName = type(item) == 'table' and item.name or item
  if type(itemName) ~= 'string' or itemName == '' then
    return false
  end

  local callback = QBCore.Functions.CanUseItem(itemName)
  if not IsFunction(callback) then
    return false
  end

  local Player = QBCore.Functions.GetPlayer(source)
  if not Player or not Player.Functions then
    return false
  end

  local inventoryItem = Player.Functions.GetItemByName(itemName)
  if inventoryItem == nil then
    return false
  end

  callback(source, inventoryItem)
  return true
end

local function SpawnQbVehicle(source, model, vehType, coords, warp)
  if model == nil or model == '' then
    return 0
  end

  local ok, spawned = exports.sdb_runtime:SpawnVehicles({
    {
      targetSource = source,
      model = tostring(model),
      vehType = vehType,
      location = coords,
      networked = true,
      warpIntoVehicle = warp == true
    }
  })

  if ok ~= true or type(spawned) ~= 'table' then
    return 0
  end

  return spawned[1] and spawned[1].vehicle or 0
end

function QBCore.Functions.SpawnVehicle(source, model, coords, warp)
  return SpawnQbVehicle(source, model, nil, coords, warp)
end

function QBCore.Functions.CreateAutomobile(source, model, coords, warp)
  return SpawnQbVehicle(source, model, 'automobile', coords, warp)
end

function QBCore.Functions.CreateVehicle(source, model, vehType, coords, warp)
  return SpawnQbVehicle(source, model, vehType, coords, warp)
end

function QBCore.Functions.CreateCallback(name, cb)
  if type(name) ~= 'string' or name == '' or not IsFunction(cb) then
    return false
  end

  QBCore.ServerCallbacks[name] = cb
  return true
end

function QBCore.Functions.TriggerClientCallback(name, source, ...)
  if type(name) ~= 'string' or name == '' or source == nil then
    return nil
  end

  local cb = nil
  local args = { ... }
  if IsFunction(args[1]) then
    cb = args[1]
    table.remove(args, 1)
  end

  QBCore.ClientCallbacks[name .. source] = {
    callback = cb,
    promise = promise.new()
  }

  TriggerClientEvent('QBCore:Client:TriggerClientCallback', source, name, table.unpack(args))

  if cb == nil then
    Citizen.Await(QBCore.ClientCallbacks[name .. source].promise)
    return QBCore.ClientCallbacks[name .. source].promise.value
  end

  return nil
end

RegisterNetEvent('QBCore:Server:TriggerCallback', function(name, ...)
  local requestSource = source
  if type(name) ~= 'string' or name == '' then
    return
  end

  local callback = QBCore.ServerCallbacks[name]
  if not IsFunction(callback) then
    return
  end

  callback(requestSource, function(...)
    TriggerClientEvent('QBCore:Client:TriggerCallback', requestSource, name, ...)
  end, ...)
end)

RegisterNetEvent('QBCore:Server:TriggerClientCallback', function(name, ...)
  if type(name) ~= 'string' or name == '' then
    return
  end

  local pending = QBCore.ClientCallbacks[name .. source]
  if pending == nil then
    return
  end

  if IsFunction(pending.callback) then
    pending.callback(...)
  else
    pending.promise:resolve(...)
  end
  pending.promise.value = ...
  QBCore.ClientCallbacks[name .. source] = nil
end)

RegisterNetEvent('QBCore:Server:UseItem', function(itemName)
  QBCore.Functions.UseItem(source, itemName)
end)

RegisterNetEvent('QBCore:Server:SpawnVehicle', function(model, coords, isnetworked)
  local requestSource = source
  if type(model) ~= 'string' or model == '' then
    return
  end

  exports.sdb_runtime:SpawnVehicles({
    {
      targetSource = requestSource,
      model = model,
      location = coords,
      networked = isnetworked ~= false,
      warpIntoVehicle = false
    }
  })
end)

RegisterNetEvent('QBCore:Server:DeleteVehicle', function(vehicleNetId)
  exports.sdb_runtime:DeleteVehicle(vehicleNetId)
end)

function QBCore.Functions.Notify(source, text, textType, length)
  TriggerClientEvent('QBCore:Notify', source, text, textType or 'primary', length or 5000)
end

function QBCore.Debug(value, indent, resource)
  if type(value) == 'table' then
    print(json.encode(value, { indent = true }))
  else
    print(('[%s] %s'):format(resource or 'qb-core', tostring(value)))
  end
end

function QBCore.ShowError(resource, message)
  print(('^1[%s] %s^7'):format(resource or 'qb-core', message or ''))
end

function QBCore.ShowSuccess(resource, message)
  print(('^2[%s] %s^7'):format(resource or 'qb-core', message or ''))
end

function QBCore.Functions.Kick(playerId, reason, setKickReason, deferrals)
  reason = reason or 'Kicked from server'
  if IsFunction(setKickReason) then
    setKickReason(reason)
  end
  if type(deferrals) == 'table' and IsFunction(deferrals.update) then
    deferrals.update(reason)
  end

  return exports.sdb_runtime:KickPlayer({
    targetSource = playerId,
    reason = reason
  })
end

RegisterNetEvent('QBCore:Shared:Update', function(shared)
  QBCore.Shared = shared or exports.sdb_runtime:GetQbShared()
  EnsureSharedHelpers()
end)

exports('GetCoreObject', function()
  return QBCore
end)

exports('GetPlayer', function(source)
  return QBCore.Functions.GetPlayer(source)
end)

exports('GetShared', function(name)
  return getShared(name)
end)
