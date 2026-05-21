local QBCore = {
  PlayerData = {},
  Functions = {},
  Shared = exports.sdb_runtime:GetQbShared(),
  ServerCallbacks = {},
  ClientCallbacks = {}
}

local function IsFunction(value)
  return type(value) == 'function' or (type(value) == 'table' and rawget(value, '__cfx_functionReference') ~= nil)
end

local function EnsureSharedDefaults()
  QBCore.Shared = QBCore.Shared or exports.sdb_runtime:GetQbShared()
  QBCore.Shared.Items = QBCore.Shared.Items or {}
  QBCore.Shared.Jobs = QBCore.Shared.Jobs or {}
  QBCore.Shared.Gangs = QBCore.Shared.Gangs or {}
  QBCore.Shared.Vehicles = QBCore.Shared.Vehicles or {}
  QBCore.Shared.Weapons = QBCore.Shared.Weapons or {}
  QBCore.Shared.StarterItems = QBCore.Shared.StarterItems or {}
  QBCore.Shared.MoneyTypes = QBCore.Shared.MoneyTypes or { cash = 500, bank = 5000, crypto = 0 }
  QBCore.Shared.DefaultMetadata = QBCore.Shared.DefaultMetadata or {}

  function QBCore.Shared.Trim(value)
    if type(value) ~= 'string' then
      return value
    end

    return value:match('^%s*(.-)%s*$')
  end
end

EnsureSharedDefaults()

local function getShared(name)
  EnsureSharedDefaults()
  if name == nil then
    return QBCore.Shared
  end

  return QBCore.Shared[name] or QBCore.Shared[name:sub(1, 1):upper() .. name:sub(2)]
end

function QBCore.Functions.GetShared(name)
  return getShared(name)
end

local function DistanceBetween(left, right)
  local dx = (left.x or 0.0) - (right.x or 0.0)
  local dy = (left.y or 0.0) - (right.y or 0.0)
  local dz = (left.z or 0.0) - (right.z or 0.0)
  return math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
end

local function ResolveCoords(coords)
  if type(coords) == 'table' and coords.x ~= nil and coords.y ~= nil and coords.z ~= nil then
    return coords
  end

  return GetEntityCoords(PlayerPedId())
end

local function IsIgnoredEntity(entity, ignoreList)
  if type(ignoreList) ~= 'table' then
    return false
  end

  for _, ignored in ipairs(ignoreList) do
    if ignored == entity then
      return true
    end
  end

  return false
end

function QBCore.Functions.GetPlayerData(cb)
  QBCore.PlayerData = exports.sdb_runtime:GetQbPlayerData()
  if not cb then return QBCore.PlayerData end
  cb(QBCore.PlayerData)
end

function QBCore.Functions.GetCoords(entity)
  local target = entity or PlayerPedId()
  local coords = GetEntityCoords(target)
  local heading = GetEntityHeading(target)
  return vector4(coords.x, coords.y, coords.z, heading)
end

function QBCore.Functions.Notify(text, textType, length, icon)
  SendNUIMessage({
    type = 'QBCore:Notify',
    text = text,
    textType = textType or 'primary',
    length = length or 5000,
    icon = icon
  })
end

function QBCore.Functions.DrawText(text, position)
  SendNUIMessage({
    action = 'DRAW_TEXT',
    type = 'QBCore:DrawText',
    text = text or '',
    position = position or 'left'
  })
end

function QBCore.Functions.HideText()
  SendNUIMessage({
    action = 'HIDE_TEXT',
    type = 'QBCore:HideText'
  })
end

function QBCore.Functions.KeyPressed()
  SendNUIMessage({
    action = 'KEY_PRESSED',
    type = 'QBCore:KeyPressed'
  })
end

function QBCore.Functions.HasItem(itemName, amount)
  QBCore.PlayerData = exports.sdb_runtime:GetQbPlayerData()
  local requiredAmount = tonumber(amount) or 1

  for _, item in ipairs((QBCore.PlayerData and QBCore.PlayerData.items) or {}) do
    if item.name == itemName and (tonumber(item.amount) or 0) >= requiredAmount then
      return true
    end
  end

  return false
end

function QBCore.Functions.Progressbar(name, label, duration, useWhileDead, canCancel, disableControls, animation, prop, propTwo, onFinish, onCancel)
  local progress = {
    name = tostring(name or 'qb_progress'):lower(),
    duration = tonumber(duration) or 0,
    label = label or '',
    useWhileDead = useWhileDead == true,
    canCancel = canCancel ~= false,
    controlDisables = disableControls or {},
    animation = animation or {},
    prop = prop or {},
    propTwo = propTwo or {}
  }

  if GetResourceState('progressbar') == 'started' then
    exports['progressbar']:Progress(progress, function(cancelled)
      if cancelled then
        if IsFunction(onCancel) then onCancel() end
      elseif IsFunction(onFinish) then
        onFinish()
      end
    end)
    return
  end

  SetTimeout(progress.duration, function()
    if IsFunction(onFinish) then
      onFinish()
    end
  end)
end

function QBCore.Functions.GetVehicles()
  return GetGamePool('CVehicle')
end

function QBCore.Functions.GetPlayers()
  local players = {}

  for _, player in ipairs(GetActivePlayers()) do
    players[#players + 1] = player
  end

  return players
end

function QBCore.Functions.GetPeds(ignoreList)
  local peds = {}

  for ped in EnumeratePeds() do
    if not IsIgnoredEntity(ped, ignoreList) then
      peds[#peds + 1] = ped
    end
  end

  return peds
end

function QBCore.Functions.GetClosestPed(coords, ignoreList)
  local origin = ResolveCoords(coords)
  local closestPed = 0
  local closestDistance = -1

  for _, ped in ipairs(QBCore.Functions.GetPeds(ignoreList)) do
    if ped ~= PlayerPedId() then
      local distance = DistanceBetween(origin, GetEntityCoords(ped))
      if closestDistance == -1 or distance < closestDistance then
        closestPed = ped
        closestDistance = distance
      end
    end
  end

  return closestPed, closestDistance
end

function QBCore.Functions.GetClosestVehicle(coords)
  local origin = ResolveCoords(coords)
  local closestVehicle = 0
  local closestDistance = -1

  for _, vehicle in ipairs(GetGamePool('CVehicle')) do
    local distance = DistanceBetween(origin, GetEntityCoords(vehicle))
    if closestDistance == -1 or distance < closestDistance then
      closestVehicle = vehicle
      closestDistance = distance
    end
  end

  return closestVehicle, closestDistance
end

function QBCore.Functions.GetClosestObject(coords)
  local origin = ResolveCoords(coords)
  local closestObject = 0
  local closestDistance = -1

  for _, object in ipairs(GetGamePool('CObject')) do
    local distance = DistanceBetween(origin, GetEntityCoords(object))
    if closestDistance == -1 or distance < closestDistance then
      closestObject = object
      closestDistance = distance
    end
  end

  return closestObject, closestDistance
end

function QBCore.Functions.GetClosestPlayer(coords)
  local origin = ResolveCoords(coords)
  local closestPlayer = -1
  local closestDistance = -1

  for _, player in ipairs(GetActivePlayers()) do
    if player ~= PlayerId() then
      local ped = GetPlayerPed(player)
      local distance = DistanceBetween(origin, GetEntityCoords(ped))
      if closestDistance == -1 or distance < closestDistance then
        closestPlayer = player
        closestDistance = distance
      end
    end
  end

  return closestPlayer, closestDistance
end

function QBCore.Functions.GetPlayersFromCoords(coords, distance)
  local origin = ResolveCoords(coords)
  local maxDistance = tonumber(distance) or 5.0
  local players = {}

  for _, player in ipairs(GetActivePlayers()) do
    local ped = GetPlayerPed(player)
    if DistanceBetween(origin, GetEntityCoords(ped)) <= maxDistance then
      players[#players + 1] = player
    end
  end

  return players
end

function QBCore.Functions.SpawnVehicle(model, cb, coords, isnetworked)
  TriggerServerEvent('QBCore:Server:SpawnVehicle', model, coords, isnetworked)
  if IsFunction(cb) then
    cb(nil)
  end
end

function QBCore.Functions.DeleteVehicle(vehicle)
  if vehicle == nil or vehicle == 0 then
    return false
  end

  TriggerServerEvent('QBCore:Server:DeleteVehicle', VehToNet(vehicle))
  return true
end

function QBCore.Functions.GetPlate(vehicle)
  return QBCore.Shared.Trim(GetVehicleNumberPlateText(vehicle))
end

function QBCore.Functions.GetVehicleProperties(vehicle)
  if vehicle == nil or vehicle == 0 then
    return nil
  end

  local colorPrimary, colorSecondary = GetVehicleColours(vehicle)
  local pearlescentColor, wheelColor = GetVehicleExtraColours(vehicle)

  return {
    model = GetEntityModel(vehicle),
    plate = QBCore.Functions.GetPlate(vehicle),
    plateIndex = GetVehicleNumberPlateTextIndex(vehicle),
    bodyHealth = GetVehicleBodyHealth(vehicle),
    engineHealth = GetVehicleEngineHealth(vehicle),
    tankHealth = GetVehiclePetrolTankHealth(vehicle),
    fuelLevel = GetVehicleFuelLevel(vehicle),
    dirtLevel = GetVehicleDirtLevel(vehicle),
    color1 = colorPrimary,
    color2 = colorSecondary,
    pearlescentColor = pearlescentColor,
    wheelColor = wheelColor,
    wheels = GetVehicleWheelType(vehicle),
    windowTint = GetVehicleWindowTint(vehicle)
  }
end

function QBCore.Functions.SetVehicleProperties(vehicle, props)
  if vehicle == nil or vehicle == 0 or type(props) ~= 'table' then
    return false
  end

  if props.plate ~= nil then
    SetVehicleNumberPlateText(vehicle, props.plate)
  end
  if props.plateIndex ~= nil then
    SetVehicleNumberPlateTextIndex(vehicle, props.plateIndex)
  end
  if props.bodyHealth ~= nil then
    SetVehicleBodyHealth(vehicle, props.bodyHealth + 0.0)
  end
  if props.engineHealth ~= nil then
    SetVehicleEngineHealth(vehicle, props.engineHealth + 0.0)
  end
  if props.tankHealth ~= nil then
    SetVehiclePetrolTankHealth(vehicle, props.tankHealth + 0.0)
  end
  if props.fuelLevel ~= nil then
    SetVehicleFuelLevel(vehicle, props.fuelLevel + 0.0)
  end
  if props.dirtLevel ~= nil then
    SetVehicleDirtLevel(vehicle, props.dirtLevel + 0.0)
  end
  if props.color1 ~= nil or props.color2 ~= nil then
    local colorPrimary, colorSecondary = GetVehicleColours(vehicle)
    SetVehicleColours(vehicle, props.color1 or colorPrimary, props.color2 or colorSecondary)
  end
  if props.pearlescentColor ~= nil or props.wheelColor ~= nil then
    local pearlescentColor, wheelColor = GetVehicleExtraColours(vehicle)
    SetVehicleExtraColours(vehicle, props.pearlescentColor or pearlescentColor, props.wheelColor or wheelColor)
  end
  if props.wheels ~= nil then
    SetVehicleWheelType(vehicle, props.wheels)
  end
  if props.windowTint ~= nil then
    SetVehicleWindowTint(vehicle, props.windowTint)
  end

  return true
end

function QBCore.Functions.CreateClientCallback(name, cb)
  if type(name) ~= 'string' or name == '' or not IsFunction(cb) then
    return false
  end

  QBCore.ClientCallbacks[name] = cb
  return true
end

function QBCore.Functions.TriggerCallback(name, ...)
  if type(name) ~= 'string' or name == '' then
    return nil
  end

  local cb = nil
  local args = { ... }
  if IsFunction(args[1]) then
    cb = args[1]
    table.remove(args, 1)
  end

  QBCore.ServerCallbacks[name] = {
    callback = cb,
    promise = promise.new()
  }

  TriggerServerEvent('QBCore:Server:TriggerCallback', name, table.unpack(args))

  if cb == nil then
    Citizen.Await(QBCore.ServerCallbacks[name].promise)
    return QBCore.ServerCallbacks[name].promise.value
  end

  return nil
end

RegisterNetEvent('QBCore:Client:TriggerCallback', function(name, ...)
  if type(name) ~= 'string' or name == '' then
    return
  end

  local pending = QBCore.ServerCallbacks[name]
  if pending == nil then
    return
  end

  if IsFunction(pending.callback) then
    pending.callback(...)
  else
    pending.promise:resolve(...)
  end
  pending.promise.value = ...
  QBCore.ServerCallbacks[name] = nil
end)

RegisterNetEvent('QBCore:Client:TriggerClientCallback', function(name, ...)
  if type(name) ~= 'string' or name == '' then
    return
  end

  local callback = QBCore.ClientCallbacks[name]
  if not IsFunction(callback) then
    return
  end

  callback(function(...)
    TriggerServerEvent('QBCore:Server:TriggerClientCallback', name, ...)
  end, ...)
end)

RegisterNetEvent('QBCore:Player:SetPlayerData', function(playerData)
  QBCore.PlayerData = playerData or {}
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
  QBCore.PlayerData = {}
end)

RegisterNetEvent('QBCore:Shared:Update', function(shared)
  QBCore.Shared = shared or exports.sdb_runtime:GetQbShared()
  EnsureSharedDefaults()
end)

exports('GetCoreObject', function()
  return QBCore
end)

exports('GetPlayerData', function()
  return QBCore.Functions.GetPlayerData()
end)

exports('GetShared', function(name)
  return getShared(name)
end)

exports('DrawText', function(text, position)
  return QBCore.Functions.DrawText(text, position)
end)

exports('HideText', function()
  return QBCore.Functions.HideText()
end)

exports('KeyPressed', function()
  return QBCore.Functions.KeyPressed()
end)
