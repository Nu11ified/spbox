QBX = QBX or {}
QBX.PlayerData = exports.sdb_runtime:GetQbPlayerData()

RegisterNetEvent('QBCore:Player:SetPlayerData', function(playerData)
  QBX.PlayerData = playerData or {}
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
  QBX.PlayerData = {}
end)

RegisterNetEvent('qbx_core:client:playerDataUpdated', function(playerData)
  QBX.PlayerData = playerData or {}
end)
