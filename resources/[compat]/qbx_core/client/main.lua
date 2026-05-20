QBX = QBX or {}
QBX.PlayerData = exports.sdb_runtime:GetQbPlayerData()

local function RefreshPlayerData(playerData)
  QBX.PlayerData = playerData or exports.sdb_runtime:GetQbPlayerData() or {}
  return QBX.PlayerData
end

exports('GetPlayerData', function()
  return RefreshPlayerData()
end)

RegisterNetEvent('QBCore:Player:SetPlayerData', function(playerData)
  RefreshPlayerData(playerData)
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
  QBX.PlayerData = {}
end)

RegisterNetEvent('qbx_core:client:playerDataUpdated', function(playerData)
  RefreshPlayerData(playerData)
end)
