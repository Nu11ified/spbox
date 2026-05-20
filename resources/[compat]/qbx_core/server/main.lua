local UseableItems = {}
local optins = {}

local function IsFunction(value)
  return type(value) == 'function' or (type(value) == 'table' and rawget(value, '__cfx_functionReference') ~= nil)
end

local function IsBlankString(value)
  return type(value) ~= 'string' or value:match('^%s*$') ~= nil
end

local function Shared()
  return exports.sdb_runtime:GetQbShared() or {}
end

local function SyncShared(shared)
  exports.sdb_runtime:SyncQbShared(shared)
  TriggerClientEvent('QBCore:Shared:Update', -1, shared)
  return true, 'success'
end

local function ResolvePlayer(identifier)
  if type(identifier) == 'number' then
    return exports.sdb_runtime:GetQbPlayer(identifier)
  end

  local numeric = tonumber(identifier)
  if numeric ~= nil then
    return exports.sdb_runtime:GetQbPlayer(numeric)
  end

  if type(identifier) == 'string' then
    return exports.sdb_runtime:GetQbPlayerByCitizenId(identifier)
  end

  return nil
end

local function PlayerData(identifier)
  local player = ResolvePlayer(identifier)
  return player and player.PlayerData or nil, player
end

local function GradeLevel(group)
  local grade = group and group.grade or nil
  if type(grade) == 'table' then
    return tonumber(grade.level) or tonumber(grade.grade) or 0
  end
  return tonumber(grade) or 0
end

local function MatchesFilter(playerData, filter)
  if playerData == nil then
    return false
  end

  if type(filter) == 'string' then
    return playerData.citizenid == filter
      or (playerData.job and playerData.job.name == filter)
      or (playerData.gang and playerData.gang.name == filter)
  end

  if type(filter) ~= 'table' then
    return false
  end

  for key, value in pairs(filter) do
    if type(key) == 'number' then
      if MatchesFilter(playerData, value) then
        return true
      end
    else
      local group = nil
      if playerData.job and playerData.job.name == key then group = playerData.job end
      if playerData.gang and playerData.gang.name == key then group = playerData.gang end
      if group ~= nil and GradeLevel(group) >= (tonumber(value) or 0) then
        return true
      end
    end
  end

  return false
end

local function GetGroupsForPlayer(playerData)
  local groups = {}
  if playerData and playerData.job and playerData.job.name then
    groups[playerData.job.name] = GradeLevel(playerData.job)
  end
  if playerData and playerData.gang and playerData.gang.name then
    groups[playerData.gang.name] = GradeLevel(playerData.gang)
  end
  return groups
end

local function SetPlayerJob(identifier, jobName, grade)
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.SetJob(jobName, grade) == true
end

local function SetPlayerGang(identifier, gangName, grade)
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.SetGang(gangName, grade) == true
end

local function UpsertSharedGroup(groupType, groupName, data)
  if IsBlankString(groupName) or type(data) ~= 'table' then
    return false, ('invalid_%s_name'):format(groupType)
  end

  local shared = Shared()
  local collection = groupType == 'job' and 'Jobs' or 'Gangs'
  shared[collection] = shared[collection] or {}
  shared[collection][groupName] = data
  return SyncShared(shared)
end

local function RemoveSharedGroup(groupType, groupName)
  if IsBlankString(groupName) then
    return false, ('invalid_%s_name'):format(groupType)
  end

  local shared = Shared()
  local collection = groupType == 'job' and 'Jobs' or 'Gangs'
  shared[collection] = shared[collection] or {}
  if shared[collection][groupName] == nil then
    return false, ('%s_not_exists'):format(groupType)
  end

  shared[collection][groupName] = nil
  return SyncShared(shared)
end

exports('CreateJob', function(jobName, job)
  return UpsertSharedGroup('job', jobName, job)
end)

exports('CreateJobs', function(jobs)
  if type(jobs) ~= 'table' then return false, 'invalid_jobs' end
  local shared = Shared()
  shared.Jobs = shared.Jobs or {}
  for jobName, job in pairs(jobs) do
    if not IsBlankString(jobName) and type(job) == 'table' then
      shared.Jobs[jobName] = job
    end
  end
  return SyncShared(shared)
end)

exports('RemoveJob', function(jobName)
  return RemoveSharedGroup('job', jobName)
end)

exports('CreateGangs', function(gangs)
  if type(gangs) ~= 'table' then return false, 'invalid_gangs' end
  local shared = Shared()
  shared.Gangs = shared.Gangs or {}
  for gangName, gang in pairs(gangs) do
    if not IsBlankString(gangName) and type(gang) == 'table' then
      shared.Gangs[gangName] = gang
    end
  end
  return SyncShared(shared)
end)

exports('RemoveGang', function(gangName)
  return RemoveSharedGroup('gang', gangName)
end)

exports('GetCoreVersion', function()
  return GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or '0.1.0'
end)

exports('ExploitBan', function(playerId, origin)
  return exports.sdb_runtime:KickPlayer({ targetSource = playerId, reason = origin or 'Exploit detected' })
end)

exports('GetSource', function(identifier)
  return exports.sdb_runtime:GetQbSource(identifier) or 0
end)

exports('GetUserId', function(identifier)
  local source = exports.sdb_runtime:GetQbSource(identifier)
  return source or 0
end)

exports('GetPlayer', ResolvePlayer)
exports('GetPlayerByCitizenId', function(citizenid) return exports.sdb_runtime:GetQbPlayerByCitizenId(citizenid) end)
exports('GetPlayerByUserId', function(userId) return ResolvePlayer(userId) end)
exports('GetPlayerByPhone', function(number) return exports.sdb_runtime:GetQbPlayerByPhone(number) end)
exports('GetQBPlayers', function() return exports.sdb_runtime:GetQbPlayers() end)

exports('GetPlayersData', function()
  local players = {}
  for _, player in pairs(exports.sdb_runtime:GetQbPlayers() or {}) do
    players[#players + 1] = player.PlayerData
  end
  return players
end)

exports('SetPlayerData', function(identifier, key, value)
  if IsBlankString(key) then return false end
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.SetPlayerData(key, value) == true
end)

exports('UpdatePlayerData', function(identifier)
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.UpdatePlayerData() == true
end)

exports('GetMetadata', function(identifier, metadata)
  local playerData, player = PlayerData(identifier)
  if player and player.Functions.GetMetaData then
    return player.Functions.GetMetaData(metadata)
  end
  return playerData and playerData.metadata and playerData.metadata[metadata] or nil
end)

exports('SetMetadata', function(identifier, metadata, value)
  if IsBlankString(metadata) then return false end
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.SetMetaData(metadata, value) == true
end)

exports('SetCharInfo', function(identifier, charInfo, value)
  if IsBlankString(charInfo) then return false end
  local playerData, player = PlayerData(identifier)
  if not playerData or not player then return false end
  playerData.charinfo = playerData.charinfo or {}
  playerData.charinfo[charInfo] = value
  return player.Functions.SetPlayerData('charinfo', playerData.charinfo)
end)

exports('GetDutyCountJob', function(job)
  return exports.sdb_runtime:GetQbDutyCount(job), exports.sdb_runtime:GetQbPlayersOnDuty(job)
end)

exports('GetDutyCountType', function(jobType)
  return exports.sdb_runtime:GetQbDutyCount(jobType), exports.sdb_runtime:GetQbPlayersOnDuty(jobType)
end)

local playerBuckets = {}
local entityBuckets = {}

exports('GetBucketObjects', function()
  return playerBuckets, entityBuckets
end)

exports('SetPlayerBucket', function(source, bucket)
  if source == nil or bucket == nil then return false end
  SetPlayerRoutingBucket(source, bucket)
  playerBuckets[tonumber(source)] = tonumber(bucket)
  return true
end)

exports('SetEntityBucket', function(entity, bucket)
  if entity == nil or bucket == nil then return false end
  SetEntityRoutingBucket(entity, bucket)
  entityBuckets[tonumber(entity)] = tonumber(bucket)
  return true
end)

exports('GetPlayersInBucket', function(bucket)
  local players = {}
  for source, playerBucket in pairs(playerBuckets) do
    if playerBucket == tonumber(bucket) then players[#players + 1] = source end
  end
  return #players > 0 and players or false
end)

exports('GetEntitiesInBucket', function(bucket)
  local entities = {}
  for entity, entityBucket in pairs(entityBuckets) do
    if entityBucket == tonumber(bucket) then entities[#entities + 1] = entity end
  end
  return #entities > 0 and entities or false
end)

exports('CreateUseableItem', function(item, data)
  if IsBlankString(item) or not IsFunction(data) then return false end
  UseableItems[item] = data
  return true
end)

exports('CanUseItem', function(item)
  return UseableItems[item]
end)

exports('IsWhitelisted', function(source)
  return exports.sdb_runtime:HasPermission(source, 'qbx.whitelisted') or IsPlayerAceAllowed(source, 'qbx.whitelisted')
end)

exports('AddPermission', function(source, permission)
  if IsBlankString(permission) then return false end
  ExecuteCommand(('add_principal player.%s qbx.%s'):format(source, permission:lower()))
  return true
end)

exports('RemovePermission', function(source, permission)
  if IsBlankString(permission) then return false end
  ExecuteCommand(('remove_principal player.%s qbx.%s'):format(source, permission:lower()))
  return true
end)

exports('HasPermission', function(source, permission)
  return exports.sdb_runtime:HasPermission(source, permission) or IsPlayerAceAllowed(source, permission) or IsPlayerAceAllowed(source, ('qbx.%s'):format(permission))
end)

exports('GetPermission', function(source)
  return exports.sdb_runtime:GetPermissions(source) or {}
end)

exports('IsOptin', function(source)
  return optins[source] == true
end)

exports('ToggleOptin', function(source)
  optins[source] = not optins[source]
  return optins[source]
end)

exports('IsPlayerBanned', function()
  return false, ''
end)

exports('Notify', function(source, text, notifyType, duration)
  TriggerClientEvent('QBCore:Notify', source, text, notifyType or 'inform', duration or 5000)
end)

exports('Login', function(source, citizenid, newData)
  local data = type(newData) == 'table' and newData or {}
  data.citizenid = citizenid or data.citizenid
  if IsBlankString(data.citizenid) then return false end
  return exports.sdb_runtime:SelectQbCharacter(source, data.citizenid, data) ~= nil
end)

exports('GetOfflinePlayer', function()
  return nil
end)

exports('Logout', function(source)
  local _, player = PlayerData(source)
  return player ~= nil and player.Functions.Logout() == true
end)

exports('CreatePlayer', function(playerData, offline)
  if type(playerData) ~= 'table' then return nil end
  if offline == true or playerData.source == nil then
    return { PlayerData = playerData, Functions = {} }
  end
  return exports.sdb_runtime:UpsertQbPlayer(playerData.source, playerData)
end)

exports('Save', function(source)
  local _, player = PlayerData(source)
  return player ~= nil and player.Functions.Save() == true
end)

exports('SaveOffline', function(playerData)
  return type(playerData) == 'table'
end)

exports('DeleteCharacter', function()
  return false
end)

exports('GenerateUniqueIdentifier', function(identifierType)
  local prefix = tostring(identifierType or 'id'):lower()
  return ('%s%s%s'):format(prefix, os.time(), math.random(1000, 9999))
end)

exports('UpsertJobData', function(jobName, data)
  local shared = Shared()
  shared.Jobs = shared.Jobs or {}
  shared.Jobs[jobName] = shared.Jobs[jobName] or {}
  for key, value in pairs(data or {}) do shared.Jobs[jobName][key] = value end
  return SyncShared(shared)
end)

exports('UpsertGangData', function(gangName, data)
  local shared = Shared()
  shared.Gangs = shared.Gangs or {}
  shared.Gangs[gangName] = shared.Gangs[gangName] or {}
  for key, value in pairs(data or {}) do shared.Gangs[gangName][key] = value end
  return SyncShared(shared)
end)

exports('UpsertJobGrade', function(jobName, grade, data)
  local shared = Shared()
  shared.Jobs = shared.Jobs or {}
  shared.Jobs[jobName] = shared.Jobs[jobName] or {}
  shared.Jobs[jobName].grades = shared.Jobs[jobName].grades or {}
  shared.Jobs[jobName].grades[grade] = data
  return SyncShared(shared)
end)

exports('UpsertGangGrade', function(gangName, grade, data)
  local shared = Shared()
  shared.Gangs = shared.Gangs or {}
  shared.Gangs[gangName] = shared.Gangs[gangName] or {}
  shared.Gangs[gangName].grades = shared.Gangs[gangName].grades or {}
  shared.Gangs[gangName].grades[grade] = data
  return SyncShared(shared)
end)

exports('RemoveJobGrade', function(jobName, grade)
  local shared = Shared()
  if shared.Jobs and shared.Jobs[jobName] and shared.Jobs[jobName].grades then
    shared.Jobs[jobName].grades[grade] = nil
    return SyncShared(shared)
  end
  return false
end)

exports('RemoveGangGrade', function(gangName, grade)
  local shared = Shared()
  if shared.Gangs and shared.Gangs[gangName] and shared.Gangs[gangName].grades then
    shared.Gangs[gangName].grades[grade] = nil
    return SyncShared(shared)
  end
  return false
end)

exports('SetJob', function(identifier, jobName, grade)
  return SetPlayerJob(identifier, jobName, grade)
end)

exports('SetJobDuty', function(identifier, onDuty)
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.SetJobDuty(onDuty) == true
end)

exports('SetPlayerPrimaryJob', function(citizenid, jobName)
  return SetPlayerJob(citizenid, jobName, 0)
end)

exports('AddPlayerToJob', function(citizenid, jobName, grade)
  return SetPlayerJob(citizenid, jobName, grade)
end)

exports('RemovePlayerFromJob', function(citizenid)
  return SetPlayerJob(citizenid, 'unemployed', 0)
end)

exports('SetGang', function(identifier, gangName, grade)
  return SetPlayerGang(identifier, gangName, grade)
end)

exports('SetPlayerPrimaryGang', function(citizenid, gangName)
  return SetPlayerGang(citizenid, gangName, 0)
end)

exports('AddPlayerToGang', function(citizenid, gangName, grade)
  return SetPlayerGang(citizenid, gangName, grade)
end)

exports('RemovePlayerFromGang', function(citizenid)
  return SetPlayerGang(citizenid, 'none', 0)
end)

exports('HasPrimaryGroup', function(source, filter)
  local playerData = PlayerData(source)
  return MatchesFilter(playerData, filter)
end)

exports('HasGroup', function(source, filter)
  local playerData = PlayerData(source)
  return MatchesFilter(playerData, filter)
end)

exports('GetGroups', function(source)
  return GetGroupsForPlayer(PlayerData(source))
end)

exports('IsGradeBoss', function(group, grade)
  local shared = Shared()
  local data = (shared.Jobs and shared.Jobs[group]) or (shared.Gangs and shared.Gangs[group])
  local gradeData = data and data.grades and data.grades[grade]
  return gradeData and gradeData.isboss == true or false
end)

exports('GetGroupMembers', function(group, groupType)
  local members = {}
  for _, player in pairs(exports.sdb_runtime:GetQbPlayers() or {}) do
    local playerData = player.PlayerData or {}
    local current = groupType == 'gang' and playerData.gang or playerData.job
    if current and current.name == group and playerData.citizenid then
      members[playerData.citizenid] = GradeLevel(current)
    end
  end
  return members
end)

exports('DeleteVehicle', function(entity)
  return exports.sdb_runtime:DeleteVehicle(entity)
end)

exports('EnablePersistence', function(entity)
  if entity and entity ~= 0 then Entity(entity).state.sdb_persistent = true end
  return true
end)

exports('DisablePersistence', function(entity)
  if entity and entity ~= 0 then Entity(entity).state.sdb_persistent = false end
  return true
end)

exports('GetVehicleClass', function(hash)
  if GetVehicleClassFromName then
    return GetVehicleClassFromName(hash)
  end
  return nil
end)

exports('SearchPlayers', function(filters)
  local matches = {}
  filters = filters or {}
  for _, player in pairs(exports.sdb_runtime:GetQbPlayers() or {}) do
    local data = player.PlayerData or {}
    local ok = true
    if filters.license and data.license ~= filters.license then ok = false end
    if filters.job and (not data.job or data.job.name ~= filters.job) then ok = false end
    if filters.gang and (not data.gang or data.gang.name ~= filters.gang) then ok = false end
    if type(filters.metadata) == 'table' then
      data.metadata = data.metadata or {}
      for key, value in pairs(filters.metadata) do
        if data.metadata[key] ~= value then ok = false end
      end
    end
    if ok then matches[#matches + 1] = player end
  end
  return matches
end)

exports('CreateSessionId', function(entity)
  local sessionId = math.random(100000, 999999)
  if entity and entity ~= 0 then Entity(entity).state.sessionId = sessionId end
  return sessionId
end)

exports('GetMoney', function(identifier, moneyType)
  local _, player = PlayerData(identifier)
  return player and player.Functions.GetMoney(moneyType) or false
end)

exports('AddMoney', function(identifier, moneyType, amount, reason)
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.AddMoney(moneyType, amount, reason or 'qbx_core') == true
end)

exports('RemoveMoney', function(identifier, moneyType, amount, reason)
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.RemoveMoney(moneyType, amount, reason or 'qbx_core') == true
end)

exports('SetMoney', function(identifier, moneyType, amount, reason)
  local _, player = PlayerData(identifier)
  return player ~= nil and player.Functions.SetMoney(moneyType, amount, reason or 'qbx_core') == true
end)
