QBX = QBX or {}

local function Shared()
  return exports.sdb_runtime:GetQbShared() or {}
end

local function FindByKey(source, key, value)
  local rows = source or {}
  if value == nil then
    return rows
  end

  return rows[key] or rows[value]
end

exports('GetJobs', function()
  return Shared().Jobs or {}
end)

exports('GetGangs', function()
  return Shared().Gangs or {}
end)

exports('GetJob', function(jobName)
  return (Shared().Jobs or {})[jobName]
end)

exports('GetGang', function(gangName)
  return (Shared().Gangs or {})[gangName]
end)

exports('GetVehiclesByName', function(vehicle)
  return FindByKey(Shared().VehiclesByName or Shared().Vehicles or {}, 'model', vehicle)
end)

exports('GetVehiclesByHash', function(vehicle)
  return FindByKey(Shared().VehiclesByHash or {}, 'hash', vehicle)
end)

exports('GetVehiclesByCategory', function()
  local categories = {}
  for _, vehicle in pairs(Shared().Vehicles or {}) do
    local category = vehicle.category or 'uncategorized'
    categories[category] = categories[category] or {}
    categories[category][#categories[category] + 1] = vehicle
  end
  return categories
end)

exports('GetWeapons', function(weapon)
  return FindByKey(Shared().Weapons or {}, 'hash', weapon)
end)

exports('GetLocations', function()
  return Shared().Locations or {}
end)
