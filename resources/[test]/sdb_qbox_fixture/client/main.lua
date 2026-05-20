local function report(name, ok, detail)
  TriggerServerEvent('sdb_qbox_fixture:clientResult', name, ok == true, detail)
end

local function check(name, fn)
  local ok, result = pcall(fn)
  report(name, ok == true, ok and nil or tostring(result))
end

local function runClientFixture()
  check('playerdata-module', function()
    assert(type(QBX) == 'table', 'expected QBX global')
    assert(type(QBX.PlayerData) == 'table', 'expected QBX.PlayerData')
    assert(type(exports.qbx_core:GetPlayerData()) == 'table', 'expected qbx_core GetPlayerData')
  end)
end

RegisterNetEvent('sdb_qbox_fixture:run', runClientFixture)

CreateThread(function()
  Wait(3500)
  runClientFixture()
end)
