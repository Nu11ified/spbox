local checks = {}

local function isFunction(value)
  return type(value) == 'function' or (type(value) == 'table' and rawget(value, '__cfx_functionReference') ~= nil)
end

local function record(name, ok, detail)
  checks[#checks + 1] = {
    name = name,
    ok = ok == true,
    detail = detail
  }

  local status = ok and 'PASS' or 'FAIL'
  print(('[sdb_runtime_smoke] %s %s%s'):format(status, name, detail and (': ' .. detail) or ''))
end

local function assertExport(name, fn)
  local ok, result = pcall(fn)
  record(name, ok, ok and nil or tostring(result))
  return ok, result
end

local function runSmoke()
  checks = {}

  assertExport('sdb_runtime:GetHealth', function()
    local health = exports.sdb_runtime:GetHealth()
    assert(type(health) == 'table', 'expected health table')
  end)

  assertExport('sdb_runtime:GetConfig', function()
    local value = exports.sdb_runtime:GetConfig('runtime', 'missing')
    assert(value == nil, 'expected missing config to return nil')
  end)

  assertExport('sdb_runtime:HasPermission', function()
    local allowed = exports.sdb_runtime:HasPermission(0, 'sdb_runtime.smoke')
    assert(type(allowed) == 'boolean', 'expected boolean permission result')
  end)

  assertExport('sdb_runtime:GetQbShared', function()
    local shared = exports.sdb_runtime:GetQbShared()
    assert(type(shared) == 'table', 'expected QBCore shared table')
  end)

  if GetResourceState('qb-core') == 'started' then
    assertExport('qb-core:GetCoreObject', function()
      local core = exports['qb-core']:GetCoreObject()
      assert(type(core) == 'table', 'expected QBCore facade object')
      assert(type(core.Functions) == 'table', 'expected QBCore functions table')
      assert(isFunction(core.Functions.HasItem), 'expected QBCore HasItem function')
      assert(isFunction(core.Functions.UseItem), 'expected QBCore UseItem function')
    end)
  else
    record('qb-core optional facade', true, 'resource not started')
  end

  TriggerClientEvent('sdb_runtime_smoke:runClient', -1)
  return checks
end

RegisterCommand('sdb_runtime_smoke', function(source)
  if source ~= 0 then
    print('[sdb_runtime_smoke] command must be run from the server console')
    return
  end

  runSmoke()
end, true)

RegisterNetEvent('sdb_runtime_smoke:clientResult', function(name, ok, detail)
  record(('client:%s'):format(name), ok, detail)
end)

AddEventHandler('playerConnecting', function(name)
  print(('[sdb_runtime_smoke] INFO playerConnecting: %s'):format(tostring(name or 'unknown')))
end)

AddEventHandler('playerJoining', function()
  local playerSource = source
  print(('[sdb_runtime_smoke] INFO playerJoining: %s'):format(tostring(playerSource)))

  SetTimeout(5000, function()
    TriggerClientEvent('sdb_runtime_smoke:runClient', playerSource)
    TriggerClientEvent('sdb_qbcore_fixture:run', playerSource)
    TriggerClientEvent('sdb_qbox_fixture:run', playerSource)
  end)
end)

CreateThread(function()
  Wait(2500)
  runSmoke()
end)

exports('RunSmoke', runSmoke)
