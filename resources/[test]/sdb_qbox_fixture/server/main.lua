local function record(name, ok, detail)
  local status = ok and 'PASS' or 'FAIL'
  print(('[sdb_runtime_smoke] %s fixture:qbox:%s%s'):format(status, name, detail and (': ' .. detail) or ''))
end

local function isFunction(value)
  return type(value) == 'function' or (type(value) == 'table' and rawget(value, '__cfx_functionReference') ~= nil)
end

local function check(name, fn)
  local ok, result = pcall(fn)
  record(name, ok == true, ok and nil or tostring(result))
end

local function run()
  check('server-player-exports', function()
    local player = exports.qbx_core:GetPlayer(1)
    assert(type(player) == 'table', 'expected player object')
    assert(type(exports.qbx_core:GetQBPlayers()) == 'table', 'expected player map')
    assert(type(exports.qbx_core:GetPlayersData()) == 'table', 'expected players data list')
    assert(exports.qbx_core:SetPlayerData(1, 'fixture', true) == true, 'SetPlayerData failed')
    assert(exports.qbx_core:SetMetadata(1, 'fixture', true) == true, 'SetMetadata failed')
  end)

  check('server-money-groups', function()
    assert(type(exports.qbx_core:GetMoney(1, 'cash')) == 'number', 'GetMoney failed')
    assert(exports.qbx_core:AddMoney(1, 'cash', 1, 'fixture') == true, 'AddMoney failed')
    assert(exports.qbx_core:RemoveMoney(1, 'cash', 1, 'fixture') == true, 'RemoveMoney failed')
    assert(exports.qbx_core:SetJob(1, 'unemployed', 0) == true, 'SetJob failed')
    assert(exports.qbx_core:SetGang(1, 'none', 0) == true, 'SetGang failed')
    assert(type(exports.qbx_core:GetGroups(1)) == 'table', 'GetGroups failed')
  end)

  check('server-shared-and-items', function()
    assert(type(exports.qbx_core:GetJobs()) == 'table', 'GetJobs failed')
    assert(type(exports.qbx_core:GetGangs()) == 'table', 'GetGangs failed')
    assert(type(exports.qbx_core:GetVehiclesByName()) == 'table', 'GetVehiclesByName failed')
    assert(exports.qbx_core:CreateUseableItem('spbox_qbox_fixture_item', function() end) == true, 'CreateUseableItem failed')
    assert(isFunction(exports.qbx_core:CanUseItem('spbox_qbox_fixture_item')), 'CanUseItem failed')
  end)

  TriggerClientEvent('sdb_qbox_fixture:run', -1)
end

RegisterCommand('sdb_qbox_fixture', function(source)
  if source ~= 0 then return end
  run()
end, true)

RegisterNetEvent('sdb_qbox_fixture:clientResult', function(name, ok, detail)
  record(('client:%s'):format(name), ok == true, detail)
end)

CreateThread(function()
  Wait(3500)
  run()
end)

exports('RunFixture', run)
