local menuOpen = false
local QbPlayerData = {}
local QbShared = {
  Items = {},
  Jobs = {},
  Gangs = {},
  Vehicles = {},
  Weapons = {},
  StarterItems = {},
  MoneyTypes = { cash = 500, bank = 5000, crypto = 0 },
  DefaultMetadata = {}
}

local function BuildDefaultQbPlayerData()
  local coords = GetEntityCoords(PlayerPedId())
  local source = GetPlayerServerId(PlayerId())

  return {
    source = source,
    citizenid = tostring(source),
    cid = source,
    license = tostring(source),
    name = GetPlayerName(PlayerId()),
    charinfo = {},
    money = {},
    job = {
      name = 'unemployed',
      label = 'Civilian',
      payment = 0,
      onduty = false,
      isboss = false,
      grade = {
        name = 'Freelancer',
        level = 0
      }
    },
    gang = {
      name = 'none',
      label = 'No Gang',
      isboss = false,
      grade = {
        name = 'Unaffiliated',
        level = 0
      }
    },
    position = {
      x = coords.x,
      y = coords.y,
      z = coords.z,
      w = GetEntityHeading(PlayerPedId())
    },
    metadata = {},
    items = {}
  }
end

local function GetQbPlayerData()
  if next(QbPlayerData) == nil then
    QbPlayerData = BuildDefaultQbPlayerData()
  end

  return QbPlayerData
end

local function GetQbShared()
  return QbShared
end

local function SendRuntimeContext()
  local coords = GetEntityCoords(PlayerPedId())
  local context = {
    targetSource = tostring(GetPlayerServerId(PlayerId())),
    x = coords.x,
    y = coords.y,
    z = coords.z,
    heading = GetEntityHeading(PlayerPedId())
  }
  local waypoint = GetFirstBlipInfoId(8)
  if DoesBlipExist(waypoint) then
    local waypointCoords = GetBlipInfoIdCoord(waypoint)
    context.x = waypointCoords.x
    context.y = waypointCoords.y
    local foundGround, groundZ = GetGroundZFor_3dCoord(waypointCoords.x, waypointCoords.y, 1000.0, false)
    if foundGround then
      context.z = groundZ
    end
  end
  local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
  if vehicle ~= 0 then
    context.targetVehicleNetId = VehToNet(vehicle)
  end

  SendNUIMessage({
    type = 'sdb_runtime:context',
    context = context
  })
end

RegisterCommand('sdbmenu', function()
  menuOpen = not menuOpen
  SetNuiFocus(menuOpen, menuOpen)

  if menuOpen then
    TriggerServerEvent('sdb_runtime:requestMenuTree')
    SendRuntimeContext()
  else
    TriggerServerEvent('sdb_runtime:closeMenu')
  end

  SendNUIMessage({
    type = 'sdb_runtime:setVisible',
    visible = menuOpen
  })
end, false)

RegisterNUICallback('callAction', function(data, cb)
  TriggerServerEvent('sdb_runtime:clientAction', data.actionName, data.payload or {})
  cb({ ok = true })
end)

RegisterNUICallback('close', function(_, cb)
  menuOpen = false
  TriggerServerEvent('sdb_runtime:closeMenu')
  SetNuiFocus(false, false)
  SendNUIMessage({
    type = 'sdb_runtime:setVisible',
    visible = false
  })
  cb({ ok = true })
end)

RegisterNetEvent('sdb_runtime:actionResult', function(result)
  SendNUIMessage({
    type = 'sdb_runtime:actionResult',
    result = result
  })
end)

RegisterNetEvent('sdb_runtime:menuTree', function(tree)
  SendRuntimeContext()
  SendNUIMessage({
    type = 'sdb_runtime:menuTree',
    tree = tree or {}
  })
end)

RegisterNetEvent('sdb_runtime:health', function(health)
  print(('[sdb_runtime] health: %s'):format(health.status))
end)

RegisterNetEvent('sdb_runtime:worldState', function(world)
  if type(world) ~= 'table' then
    return
  end

  if type(world.weatherType) == 'string' and world.weatherType ~= '' then
    SetWeatherTypeNowPersist(world.weatherType)
  end

  if type(world.hour) == 'number' and type(world.minute) == 'number' then
    NetworkOverrideClockTime(world.hour, world.minute, 0)
  end
end)

RegisterNetEvent('sdb_runtime:repairVehicle', function(repair)
  if type(repair) ~= 'table' or type(repair.targetVehicleNetId) ~= 'number' then
    return
  end

  local vehicle = NetworkGetEntityFromNetworkId(repair.targetVehicleNetId)
  if vehicle == 0 then
    return
  end

  SetVehicleFixed(vehicle)
  SetVehicleDeformationFixed(vehicle)
  SetVehicleEngineHealth(vehicle, 1000.0)
end)

RegisterNetEvent('sdb_runtime:teleport', function(teleport)
  if type(teleport) ~= 'table' then
    return
  end

  if type(teleport.x) ~= 'number' or type(teleport.y) ~= 'number' or type(teleport.z) ~= 'number' then
    return
  end

  SetEntityCoords(PlayerPedId(), teleport.x, teleport.y, teleport.z, false, false, false, false)
  if type(teleport.heading) == 'number' then
    SetEntityHeading(PlayerPedId(), teleport.heading)
  end
end)

RegisterNetEvent('QBCore:Player:SetPlayerData', function(playerData)
  QbPlayerData = playerData or {}
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
  QbPlayerData = {}
end)

RegisterNetEvent('QBCore:Shared:Update', function(shared)
  QbShared = shared or QbShared
end)

exports('GetQbPlayerData', GetQbPlayerData)
exports('GetQbShared', GetQbShared)
