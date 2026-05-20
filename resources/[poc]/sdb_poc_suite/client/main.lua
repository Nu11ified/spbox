local visible = false
local noclip = false
local spawned = false
local account = {}
local vehicleModels = { 'sultan', 'buffalo', 'blista', 'futo', 'mesa' }
local weatherTypes = { 'EXTRASUNNY', 'CLEAR', 'OVERCAST', 'RAIN', 'THUNDER', 'FOGGY' }

local function sendState(notice)
  SendNUIMessage({
    type = 'sdb_poc:state',
    visible = visible,
    account = account,
    notice = notice,
    noclip = noclip,
    vehicles = vehicleModels,
    weather = weatherTypes
  })
end

local function openPanel()
  visible = true
  SetNuiFocus(true, true)
  sendState()
  TriggerServerEvent('sdb_poc:ready')
end

local function closePanel()
  visible = false
  SetNuiFocus(false, false)
  sendState()
end

local function spawnManualCharacter(force)
  if spawned and not force then
    return
  end
  spawned = true
  print('[sdb_poc] spawning manual test character')

  DoScreenFadeOut(300)
  while not IsScreenFadedOut() do
    Wait(0)
  end

  local model = joaat('mp_m_freemode_01')
  RequestModel(model)
  while not HasModelLoaded(model) do
    Wait(0)
  end

  SetPlayerModel(PlayerId(), model)
  SetPedDefaultComponentVariation(PlayerPedId())
  SetModelAsNoLongerNeeded(model)

  RequestCollisionAtCoord(215.76, -810.12, 30.73)
  NetworkResurrectLocalPlayer(215.76, -810.12, 30.73, 157.0, true, true, false)
  local ped = PlayerPedId()
  SetEntityCoordsNoOffset(ped, 215.76, -810.12, 30.73, false, false, false)
  SetEntityHeading(ped, 157.0)
  FreezeEntityPosition(ped, false)
  SetEntityVisible(ped, true, false)
  SetEntityInvincible(ped, false)
  ClearPedTasksImmediately(ped)

  ShutdownLoadingScreen()
  ShutdownLoadingScreenNui()
  DoScreenFadeIn(300)
  print('[sdb_poc] sdb_poc:spawned')
  sendState('Spawned manual test character')
end

CreateThread(function()
  while not NetworkIsSessionStarted() do
    Wait(250)
  end

  Wait(1000)
  spawnManualCharacter()
  TriggerServerEvent('sdb_poc:ready')
end)

CreateThread(function()
  while true do
    Wait(0)
    if noclip then
      local ped = PlayerPedId()
      local coords = GetEntityCoords(ped)
      local heading = GetGameplayCamRot(2).z
      local speed = IsControlPressed(0, 21) and 2.0 or 0.45

      SetEntityVelocity(ped, 0.0, 0.0, 0.0)
      SetEntityCollision(ped, false, false)
      if IsControlPressed(0, 32) then
        coords = coords + vec3(-math.sin(math.rad(heading)) * speed, math.cos(math.rad(heading)) * speed, 0.0)
      end
      if IsControlPressed(0, 33) then
        coords = coords - vec3(-math.sin(math.rad(heading)) * speed, math.cos(math.rad(heading)) * speed, 0.0)
      end
      if IsControlPressed(0, 22) then
        coords = coords + vec3(0.0, 0.0, speed)
      end
      if IsControlPressed(0, 36) then
        coords = coords - vec3(0.0, 0.0, speed)
      end
      SetEntityCoordsNoOffset(ped, coords.x, coords.y, coords.z, true, true, true)
    else
      SetEntityCollision(PlayerPedId(), true, true)
      Wait(250)
    end
  end
end)

RegisterCommand('pocmenu', function()
  if visible then
    closePanel()
  else
    openPanel()
  end
end, false)

RegisterCommand('pocspawn', function()
  spawnManualCharacter(true)
end, false)

RegisterKeyMapping('pocmenu', 'Open SPBox POC menu', 'keyboard', 'F7')

RegisterNetEvent('sdb_poc:economy:snapshot', function(nextAccount)
  account = nextAccount or {}
  sendState(account.notice)
end)

RegisterNUICallback('close', function(_, cb)
  closePanel()
  cb({ ok = true })
end)

RegisterNUICallback('economyDeposit', function(data, cb)
  TriggerServerEvent('sdb_poc:economy:deposit', data and data.amount)
  cb({ ok = true })
end)

RegisterNUICallback('economyWithdraw', function(data, cb)
  TriggerServerEvent('sdb_poc:economy:withdraw', data and data.amount)
  cb({ ok = true })
end)

RegisterNUICallback('economyMaxMoney', function(_, cb)
  TriggerServerEvent('sdb_poc:economy:maxMoney')
  cb({ ok = true })
end)

RegisterNUICallback('economyPaycheck', function(_, cb)
  TriggerServerEvent('sdb_poc:economy:paycheck')
  cb({ ok = true })
end)

RegisterNUICallback('setJob', function(data, cb)
  TriggerServerEvent('sdb_poc:economy:setJob', data and data.job)
  cb({ ok = true })
end)

RegisterNUICallback('spawnPlayer', function(_, cb)
  spawnManualCharacter(true)
  cb({ ok = true })
end)

RegisterNUICallback('spawnVehicle', function(data, cb)
  local modelName = tostring(data and data.model or 'sultan')
  local model = joaat(modelName)
  if not IsModelInCdimage(model) or not IsModelAVehicle(model) then
    cb({ ok = false })
    return
  end

  RequestModel(model)
  while not HasModelLoaded(model) do
    Wait(0)
  end

  local ped = PlayerPedId()
  local coords = GetEntityCoords(ped)
  local vehicle = CreateVehicle(model, coords.x + 2.0, coords.y, coords.z, GetEntityHeading(ped), true, false)
  SetPedIntoVehicle(ped, vehicle, -1)
  SetVehicleEngineOn(vehicle, true, true, false)
  SetModelAsNoLongerNeeded(model)
  sendState(('Spawned %s'):format(modelName))
  cb({ ok = true })
end)

RegisterNUICallback('repairVehicle', function(_, cb)
  local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
  if vehicle ~= 0 then
    SetVehicleFixed(vehicle)
    SetVehicleDeformationFixed(vehicle)
    SetVehicleDirtLevel(vehicle, 0.0)
    SetVehicleEngineHealth(vehicle, 1000.0)
  end
  sendState('Vehicle repaired')
  cb({ ok = true })
end)

RegisterNUICallback('teleportWaypoint', function(_, cb)
  local waypoint = GetFirstBlipInfoId(8)
  if DoesBlipExist(waypoint) then
    local coords = GetBlipInfoIdCoord(waypoint)
    local found, groundZ = GetGroundZFor_3dCoord(coords.x, coords.y, 1000.0, false)
    SetEntityCoords(PlayerPedId(), coords.x, coords.y, found and groundZ or coords.z, false, false, false, false)
    sendState('Teleported to waypoint')
  else
    sendState('Set a waypoint first')
  end
  cb({ ok = true })
end)

RegisterNUICallback('setWeather', function(data, cb)
  local weather = tostring(data and data.weather or 'CLEAR')
  SetWeatherTypeNowPersist(weather)
  sendState(('Weather: %s'):format(weather))
  cb({ ok = true })
end)

RegisterNUICallback('setTime', function(data, cb)
  local hour = tonumber(data and data.hour) or 12
  NetworkOverrideClockTime(math.max(0, math.min(23, math.floor(hour))), 0, 0)
  sendState(('Time set: %02d:00'):format(hour))
  cb({ ok = true })
end)

RegisterNUICallback('toggleNoclip', function(_, cb)
  noclip = not noclip
  SetEntityInvincible(PlayerPedId(), noclip)
  sendState(noclip and 'Noclip enabled' or 'Noclip disabled')
  cb({ ok = true })
end)
