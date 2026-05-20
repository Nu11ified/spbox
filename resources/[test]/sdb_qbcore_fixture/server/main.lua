local function record(name, ok, detail)
  local status = ok and 'PASS' or 'FAIL'
  print(('[sdb_runtime_smoke] %s fixture:qbcore:%s%s'):format(status, name, detail and (': ' .. detail) or ''))
end

local function isFunction(value)
  return type(value) == 'function' or (type(value) == 'table' and rawget(value, '__cfx_functionReference') ~= nil)
end

local function check(name, fn)
  local ok, result = pcall(fn)
  record(name, ok == true, ok and nil or tostring(result))
end

local function run()
  check('server-core-object', function()
    local core = exports['qb-core']:GetCoreObject()
    assert(type(core) == 'table', 'expected QBCore object')
    assert(isFunction(core.Functions.GetPlayer), 'expected GetPlayer')
    assert(isFunction(core.Functions.CreateCallback), 'expected CreateCallback')
    assert(isFunction(core.Functions.CreateUseableItem), 'expected CreateUseableItem')
  end)

  check('server-player-methods', function()
    local core = exports['qb-core']:GetCoreObject()
    local player = core.Functions.GetPlayer(1)
    assert(type(player) == 'table', 'expected player object')
    assert(isFunction(player.Functions.AddMoney), 'expected AddMoney')
    assert(isFunction(player.Functions.SetJob), 'expected SetJob')
    assert(isFunction(player.Functions.HasItem), 'expected HasItem')
  end)

  check('server-callbacks-items-vehicles', function()
    local core = exports['qb-core']:GetCoreObject()
    assert(core.Functions.CreateCallback('spbox:fixture', function() end) == true, 'callback registration failed')
    assert(core.Functions.CreateUseableItem('spbox_fixture_item', function() end) == true, 'usable item registration failed')
    assert(isFunction(core.Functions.CanUseItem('spbox_fixture_item')), 'usable item callback missing')
    assert(isFunction(core.Functions.SpawnVehicle), 'server SpawnVehicle missing')
    assert(isFunction(core.Functions.CreateVehicle), 'server CreateVehicle missing')
  end)

  TriggerClientEvent('sdb_qbcore_fixture:run', -1)
end

RegisterCommand('sdb_qbcore_fixture', function(source)
  if source ~= 0 then return end
  run()
end, true)

RegisterNetEvent('sdb_qbcore_fixture:clientResult', function(name, ok, detail)
  record(('client:%s'):format(name), ok == true, detail)
end)

CreateThread(function()
  Wait(3000)
  run()
end)

exports('RunFixture', run)
