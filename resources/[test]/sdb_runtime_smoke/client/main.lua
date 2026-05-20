local function report(name, ok, detail)
  TriggerServerEvent('sdb_runtime_smoke:clientResult', name, ok == true, detail)
end

local function assertExport(name, fn)
  local ok, result = pcall(fn)
  report(name, ok, ok and nil or tostring(result))
end

local function runClientSmoke()
  report('sdb_runtime_smoke:loaded', true)

  assertExport('sdb_runtime:GetQbPlayerData', function()
    local playerData = exports.sdb_runtime:GetQbPlayerData()
    assert(type(playerData) == 'table', 'expected QBCore PlayerData table')
  end)

  assertExport('sdb_runtime:GetQbShared', function()
    local shared = exports.sdb_runtime:GetQbShared()
    assert(type(shared) == 'table', 'expected QBCore shared table')
  end)

  if GetResourceState('qb-core') == 'started' then
    assertExport('qb-core:GetCoreObject', function()
      local core = exports['qb-core']:GetCoreObject()
      assert(type(core) == 'table', 'expected QBCore facade object')
    end)
  else
    report('qb-core optional client facade', true, 'resource not started')
  end
end

RegisterNetEvent('sdb_runtime_smoke:runClient', runClientSmoke)

CreateThread(function()
  Wait(2500)
  runClientSmoke()
end)
