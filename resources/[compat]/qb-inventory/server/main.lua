local function AddItem(source, itemName, amount, slot, info, reason)
  local player = exports.sdb_runtime:GetQbPlayer(source)
  if player == nil or player.Functions == nil or player.Functions.AddItem == nil then
    return false
  end

  return player.Functions.AddItem(itemName, amount or 1, slot, info or {}, reason or 'qb-inventory facade')
end

local function RemoveItem(source, itemName, amount)
  local player = exports.sdb_runtime:GetQbPlayer(source)
  if player == nil or player.Functions == nil or player.Functions.RemoveItem == nil then
    return false
  end

  return player.Functions.RemoveItem(itemName, amount or 1)
end

local function HasItem(source, items, amount)
  local player = exports.sdb_runtime:GetQbPlayer(source)
  if player == nil or player.Functions == nil or player.Functions.HasItem == nil then
    return false
  end

  if type(items) == 'table' then
    for _, itemName in pairs(items) do
      if not player.Functions.HasItem(itemName, amount or 1) then
        return false
      end
    end
    return true
  end

  return player.Functions.HasItem(items, amount or 1)
end

local function OpenInventory(source, inventoryId)
  TriggerClientEvent('QBCore:Notify', source, ('Inventory: %s'):format(tostring(inventoryId or 'player')), 'primary', 2500)
  return true
end

exports('AddItem', AddItem)
exports('RemoveItem', RemoveItem)
exports('HasItem', HasItem)
exports('OpenInventory', OpenInventory)
