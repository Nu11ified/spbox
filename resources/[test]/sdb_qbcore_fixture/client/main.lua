local function report(name, ok, detail)
  TriggerServerEvent('sdb_qbcore_fixture:clientResult', name, ok == true, detail)
end

local function isFunction(value)
  return type(value) == 'function' or (type(value) == 'table' and rawget(value, '__cfx_functionReference') ~= nil)
end

local function check(name, fn)
  local ok, result = pcall(fn)
  report(name, ok == true, ok and nil or tostring(result))
end

local function runClientFixture()
  check('core-object-playerdata', function()
    local core = exports['qb-core']:GetCoreObject()
    assert(type(core) == 'table', 'expected QBCore object')
    assert(isFunction(core.Functions.GetPlayerData), 'expected GetPlayerData')
    assert(isFunction(core.Functions.TriggerCallback), 'expected TriggerCallback')
    assert(isFunction(core.Functions.HasItem), 'expected HasItem')
    assert(isFunction(core.Functions.GetVehicles), 'expected GetVehicles')
    assert(isFunction(core.Functions.GetVehicleProperties), 'expected GetVehicleProperties')
    assert(type(core.Functions.GetPlayerData()) == 'table', 'expected player data table')
  end)
end

RegisterNetEvent('sdb_qbcore_fixture:run', runClientFixture)

CreateThread(function()
  Wait(3000)
  runClientFixture()
end)
