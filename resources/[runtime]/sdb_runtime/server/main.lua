local Runtime = {
  permissions = {},
  config = {},
  health = {
    status = 'bootstrapped',
    reason = 'runtime resource loaded'
  },
  menuTrees = {},
  menuSessions = {},
  deployments = {},
  sandboxEvents = {},
  replicatedState = {},
  worldState = {},
  handlers = {},
  actionPermissions = {},
  qbShared = {
    Items = {},
    Jobs = {},
    Gangs = {},
    Vehicles = {},
    Weapons = {},
    StarterItems = {},
    MoneyTypes = { cash = 500, bank = 5000, crypto = 0 },
    DefaultMetadata = {}
  },
  qbPlayers = {},
  qbCharacterSelections = {},
  qbCharacterUpdates = {},
  qbMoneyUpdates = {},
  qbInventoryUpdates = {}
}

local AceCommandPrefixes = {
  'add_ace ',
  'remove_ace ',
  'add_principal ',
  'remove_principal '
}

local function normalizeSource(source)
  if source == nil then
    return 'server'
  end

  return tostring(source)
end

local function HasPermission(source, permission)
  local principal = normalizeSource(source)
  local principalPermissions = Runtime.permissions[principal]

  if principalPermissions == nil then
    return false
  end

  return principalPermissions[permission] == true
end

local function GetPermissions(source)
  local principal = normalizeSource(source)
  local principalPermissions = Runtime.permissions[principal]

  if principalPermissions == nil then
    return {}
  end

  return principalPermissions
end

local function CallAction(source, actionName, payload)
  if type(actionName) ~= 'string' or actionName == '' then
    return false, 'actionName must be a non-empty string'
  end

  if payload ~= nil and type(payload) ~= 'table' then
    return false, 'payload must be a table'
  end

  local handler = Runtime.handlers[actionName]

  if handler == nil then
    return false, ('Unknown runtime action: %s'):format(actionName)
  end

  local requiredPermission = Runtime.actionPermissions[actionName]
  if requiredPermission ~= nil and not HasPermission(source, requiredPermission) then
    return false, ('Permission denied: %s'):format(requiredPermission)
  end

  local executed, ok, result = pcall(handler, normalizeSource(source), payload or {})
  if not executed then
    return false, tostring(ok)
  end

  return ok, result
end

local function GetConfig(namespace, key)
  local scoped = Runtime.config[namespace]

  if scoped == nil then
    return nil
  end

  return scoped[key]
end

local function GetHealth()
  local health = {}

  for key, value in pairs(Runtime.health) do
    health[key] = value
  end

  return health
end

local function AdminEndpoint(path)
  local endpoint = GetConvar('sdb_admin_endpoint', GetConvar('sdb_poc_admin_endpoint', ''))
  if endpoint == nil or endpoint == '' then
    return nil
  end

  return endpoint:gsub('/+$', '') .. path
end

local function RequestResourceReconcile()
  local url = AdminEndpoint('/resources/reconcile')
  if url == nil then
    return
  end

  PerformHttpRequest(url, function(status, response)
    if status < 200 or status >= 300 then
      print(('[sdb_runtime] resource reconcile failed HTTP %s %s'):format(status, response or ''))
      return
    end

    print('[sdb_runtime] resource reconcile requested')
  end, 'POST', json.encode({
    resource = GetCurrentResourceName()
  }), {
    ['Content-Type'] = 'application/json'
  })
end

local function GetDeployments()
  return {
    deployments = Runtime.deployments,
    sandboxEvents = Runtime.sandboxEvents
  }
end

local function GetQbShared()
  return Runtime.qbShared
end

local function SyncQbShared(shared)
  if type(shared) ~= 'table' then
    return false, 'QBCore shared sync requires shared table'
  end

  Runtime.qbShared.Items = shared.items or shared.Items or Runtime.qbShared.Items
  Runtime.qbShared.Jobs = shared.jobs or shared.Jobs or Runtime.qbShared.Jobs
  Runtime.qbShared.Gangs = shared.gangs or shared.Gangs or Runtime.qbShared.Gangs
  Runtime.qbShared.Vehicles = shared.vehicles or shared.Vehicles or Runtime.qbShared.Vehicles
  Runtime.qbShared.Weapons = shared.weapons or shared.Weapons or Runtime.qbShared.Weapons
  Runtime.qbShared.StarterItems = shared.starterItems or shared.StarterItems or Runtime.qbShared.StarterItems
  Runtime.qbShared.MoneyTypes = shared.moneyTypes or shared.MoneyTypes or Runtime.qbShared.MoneyTypes
  Runtime.qbShared.DefaultMetadata = shared.defaultMetadata or shared.DefaultMetadata or Runtime.qbShared.DefaultMetadata

  TriggerEvent('QBCore:Shared:Update', Runtime.qbShared)
  TriggerClientEvent('QBCore:Shared:Update', -1, Runtime.qbShared)
  return true, Runtime.qbShared
end

local function RegisterLocalHandler(actionName, handler, options)
  if type(actionName) ~= 'string' or actionName == '' then
    error('actionName must be a non-empty string')
  end

  if type(handler) ~= 'function' then
    error('handler must be a function')
  end

  options = options or {}
  if options.requiredPermission ~= nil and type(options.requiredPermission) ~= 'string' then
    error('requiredPermission must be a string')
  end

  Runtime.handlers[actionName] = handler
  Runtime.actionPermissions[actionName] = options.requiredPermission
end

local function GetHandlerNames()
  local names = {}

  for actionName in pairs(Runtime.handlers) do
    names[#names + 1] = actionName
  end

  table.sort(names)
  return names
end

local function IsAllowedAceCommand(command)
  if type(command) ~= 'string' then
    return false
  end

  for _, prefix in ipairs(AceCommandPrefixes) do
    if command:sub(1, #prefix) == prefix then
      return true
    end
  end

  return false
end

local function ApplyAceMirrorCommands(commands)
  if type(commands) ~= 'table' then
    return 0
  end

  local applied = 0

  for _, command in ipairs(commands) do
    if IsAllowedAceCommand(command) then
      ExecuteCommand(command)
      applied = applied + 1
    end
  end

  return applied
end

local function ApplyReplicatedState(updates)
  if type(updates) ~= 'table' then
    return false, 'updates must be a table'
  end

  local applied = 0

  for _, update in ipairs(updates) do
    if type(update) ~= 'table' or type(update.key) ~= 'string' or update.key == '' then
      return false, 'replicated state update requires a key'
    end

    if update.authoritative == true then
      return false, 'authoritative state cannot be replicated'
    end

    Runtime.replicatedState[update.key] = update.value
    if update.playerId ~= nil then
      Player(update.playerId).state:set(update.key, update.value, true)
    else
      GlobalState[update.key] = update.value
    end
    applied = applied + 1
  end

  return true, applied
end

local function NormalizePlayerTarget(targetSource, errorMessage)
  local target = tonumber(targetSource)
  if target == nil or target <= 0 or target == -1 then
    return false, errorMessage
  end

  return true, target
end

local function IsBlankString(value)
  return type(value) ~= 'string' or value:match('^%s*$') ~= nil
end

local function BuildDefaultQbPlayerData(target)
  local name = GetPlayerName(target) or ('Player %s'):format(target)

  return {
    source = target,
    characterId = ('char:%s'):format(target),
    citizenid = tostring(target),
    cid = target,
    license = tostring(target),
    name = name,
    charinfo = {},
    money = {},
    job = {
      name = 'unemployed',
      label = 'Civilian',
      payment = 0,
      onduty = false,
      isboss = false,
      grade = {
        name = 'Freelancer',
        level = 0
      }
    },
    gang = {
      name = 'none',
      label = 'No Gang',
      isboss = false,
      grade = {
        name = 'Unaffiliated',
        level = 0
      }
    },
    position = {
      x = 0.0,
      y = 0.0,
      z = 0.0,
      w = 0.0
    },
    metadata = {
      hunger = 100,
      thirst = 100,
      inside = {
        apartment = {}
      }
    },
    items = {}
  }
end

local function QueueQbCharacterUpdate(source, playerData)
  local ok, target = NormalizePlayerTarget(source, 'QBCore character update requires a player source')
  if not ok then
    return false, target
  end

  if type(playerData) ~= 'table' then
    return false, 'QBCore character update requires PlayerData'
  end

  local charinfo = playerData.charinfo or {}
  local update = {
    characterId = playerData.characterId or playerData.citizenid,
    playerPrincipalId = ('player:%s'):format(target),
    citizenId = playerData.citizenid,
    cid = tonumber(playerData.cid) or target,
    slot = tonumber(playerData.cid) or 1,
    license = playerData.license or tostring(target),
    name = playerData.name or (GetPlayerName(target) or ('Player %s'):format(target)),
    charinfoJson = json.encode(playerData.charinfo or {}),
    metadataJson = json.encode(playerData.metadata or {}),
    gangJson = json.encode(playerData.gang or {}),
    positionJson = json.encode(playerData.position or {}),
    phoneNumber = charinfo.phone or '',
    accountNumber = charinfo.account or '',
    selected = true
  }

  if IsBlankString(update.characterId) then
    return false, 'QBCore character update requires characterId'
  end
  if IsBlankString(update.citizenId) then
    return false, 'QBCore character update requires citizenid'
  end

  Runtime.qbCharacterUpdates[#Runtime.qbCharacterUpdates + 1] = update
  return true, update
end

local function DrainQbCharacterUpdates()
  local updates = Runtime.qbCharacterUpdates
  Runtime.qbCharacterUpdates = {}
  return updates
end

local function QueueQbCharacterSelection(source, characterId)
  local ok, target = NormalizePlayerTarget(source, 'QBCore character selection requires a player source')
  if not ok then
    return false, target
  end
  if IsBlankString(characterId) then
    return false, 'QBCore character selection requires characterId'
  end

  local selection = {
    source = target,
    playerPrincipalId = ('player:%s'):format(target),
    characterId = characterId
  }

  Runtime.qbCharacterSelections[#Runtime.qbCharacterSelections + 1] = selection
  return true, selection
end

local function DrainQbCharacterSelections()
  local selections = Runtime.qbCharacterSelections
  Runtime.qbCharacterSelections = {}
  return selections
end

local function QueueQbMoneyUpdate(source, moneyType, operation, amount, reason)
  local ok, target = NormalizePlayerTarget(source, 'QBCore money update requires a player source')
  if not ok then
    return false, target
  end

  if IsBlankString(moneyType) then
    return false, 'QBCore money update requires moneyType'
  end
  if operation ~= 'add' and operation ~= 'remove' and operation ~= 'set' then
    return false, 'QBCore money operation must be add, remove, or set'
  end

  local numericAmount = tonumber(amount)
  if numericAmount == nil or numericAmount < 0 then
    return false, 'QBCore money update requires a non-negative amount'
  end

  local player = Runtime.qbPlayers[target]
  local characterId = player and player.PlayerData and (player.PlayerData.characterId or player.PlayerData.citizenid) or ('char:%s'):format(target)
  if IsBlankString(characterId) then
    return false, 'QBCore money update requires characterId'
  end
  local update = {
    transactionId = ('qb-money:%s:%s:%s:%s'):format(target, moneyType, operation, #Runtime.qbMoneyUpdates + 1),
    actorId = ('player:%s'):format(target),
    characterId = characterId,
    moneyType = moneyType,
    operation = operation,
    amount = numericAmount,
    reason = reason or operation,
    idempotencyKey = ('qb-money:%s:%s:%s:%s'):format(target, moneyType, operation, #Runtime.qbMoneyUpdates + 1)
  }

  Runtime.qbMoneyUpdates[#Runtime.qbMoneyUpdates + 1] = update
  return true, update
end

local function DrainQbMoneyUpdates()
  local updates = Runtime.qbMoneyUpdates
  Runtime.qbMoneyUpdates = {}
  return updates
end

local function QueueQbInventoryUpdate(source, itemKey, operation, amount)
  local ok, target = NormalizePlayerTarget(source, 'QBCore inventory update requires a player source')
  if not ok then
    return false, target
  end

  if IsBlankString(itemKey) then
    return false, 'QBCore inventory update requires itemKey'
  end
  if operation ~= 'add' and operation ~= 'remove' then
    return false, 'QBCore inventory operation must be add or remove'
  end

  local numericAmount = tonumber(amount) or 1
  if numericAmount <= 0 then
    return false, 'QBCore inventory update requires a positive amount'
  end

  local player = Runtime.qbPlayers[target]
  local characterId = player and player.PlayerData and (player.PlayerData.characterId or player.PlayerData.citizenid) or ('char:%s'):format(target)
  if IsBlankString(characterId) then
    return false, 'QBCore inventory update requires characterId'
  end
  local update = {
    id = ('qb-inventory:%s:%s:%s:%s'):format(target, itemKey, operation, #Runtime.qbInventoryUpdates + 1),
    characterId = characterId,
    itemKey = itemKey,
    operation = operation,
    amount = numericAmount
  }

  Runtime.qbInventoryUpdates[#Runtime.qbInventoryUpdates + 1] = update
  return true, update
end

local function DrainQbInventoryUpdates()
  local updates = Runtime.qbInventoryUpdates
  Runtime.qbInventoryUpdates = {}
  return updates
end

local function RefreshQbPlayerPosition(player)
  if player == nil or player.PlayerData == nil then
    return false
  end

  local ped = GetPlayerPed(player.PlayerData.source)
  if ped == nil or ped == 0 then
    return false
  end

  local coords = GetEntityCoords(ped)
  player.PlayerData.position = {
    x = coords.x,
    y = coords.y,
    z = coords.z,
    w = GetEntityHeading(ped)
  }
  return true
end

local function AttachQbPlayerFunctions(player)
  player.Functions = player.Functions or {}

  function player.Functions.GetMoney(moneyType)
    return player.PlayerData.money[moneyType] or 0
  end

  function player.Functions.AddMoney(moneyType, amount, reason)
    player.PlayerData.money = player.PlayerData.money or {}
    local current = player.PlayerData.money[moneyType] or 0
    player.PlayerData.money[moneyType] = current + amount
    QueueQbMoneyUpdate(player.PlayerData.source, moneyType, 'add', amount, reason)
    TriggerClientEvent('QBCore:Client:OnMoneyChange', player.PlayerData.source, player.PlayerData.money)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.RemoveMoney(moneyType, amount, reason)
    player.PlayerData.money = player.PlayerData.money or {}
    local current = player.PlayerData.money[moneyType] or 0
    player.PlayerData.money[moneyType] = math.max(0, current - amount)
    QueueQbMoneyUpdate(player.PlayerData.source, moneyType, 'remove', amount, reason)
    TriggerClientEvent('QBCore:Client:OnMoneyChange', player.PlayerData.source, player.PlayerData.money)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.SetMoney(moneyType, amount, reason)
    player.PlayerData.money = player.PlayerData.money or {}
    player.PlayerData.money[moneyType] = amount
    QueueQbMoneyUpdate(player.PlayerData.source, moneyType, 'set', amount, reason)
    TriggerClientEvent('QBCore:Client:OnMoneyChange', player.PlayerData.source, player.PlayerData.money)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.GetItemByName(itemKey)
    player.PlayerData.items = player.PlayerData.items or {}
    for _, item in ipairs(player.PlayerData.items) do
      if item.name == itemKey then
        return item
      end
    end

    return nil
  end

  function player.Functions.HasItem(itemKey, amount)
    local item = player.Functions.GetItemByName(itemKey)
    if item == nil then
      return false
    end

    return (tonumber(item.amount) or 0) >= (tonumber(amount) or 1)
  end

  function player.Functions.AddItem(itemKey, amount, slot, info)
    player.PlayerData.items = player.PlayerData.items or {}
    local numericAmount = tonumber(amount) or 1
    local item = player.Functions.GetItemByName(itemKey)
    if item ~= nil then
      item.amount = (tonumber(item.amount) or 0) + numericAmount
    else
      player.PlayerData.items[#player.PlayerData.items + 1] = {
        name = itemKey,
        amount = numericAmount,
        slot = slot or (#player.PlayerData.items + 1),
        info = info or {}
      }
    end

    QueueQbInventoryUpdate(player.PlayerData.source, itemKey, 'add', amount)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.RemoveItem(itemKey, amount)
    player.PlayerData.items = player.PlayerData.items or {}
    local numericAmount = tonumber(amount) or 1

    for index, item in ipairs(player.PlayerData.items) do
      if item.name == itemKey then
        local current = tonumber(item.amount) or 0
        if current < numericAmount then
          return false
        end

        item.amount = current - numericAmount
        if item.amount <= 0 then
          table.remove(player.PlayerData.items, index)
        end
        QueueQbInventoryUpdate(player.PlayerData.source, itemKey, 'remove', amount)
        TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
        return true
      end
    end

    return false
  end

  function player.Functions.UpdatePlayerData()
    RefreshQbPlayerPosition(player)
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.SetPlayerData(key, value)
    if IsBlankString(key) then
      return false
    end

    player.PlayerData[key] = value
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.Save()
    RefreshQbPlayerPosition(player)
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.Logout()
    RefreshQbPlayerPosition(player)
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    Runtime.qbPlayers[player.PlayerData.source] = nil
    TriggerClientEvent('QBCore:Client:OnPlayerUnload', player.PlayerData.source)
    return true
  end

  function player.Functions.SetMetaData(key, value)
    if IsBlankString(key) then
      return false
    end

    player.PlayerData.metadata = player.PlayerData.metadata or {}
    player.PlayerData.metadata[key] = value
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    TriggerClientEvent('QBCore:Client:OnMetaDataUpdate', player.PlayerData.source, player.PlayerData.metadata)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.GetMetaData(key)
    if IsBlankString(key) then
      return nil
    end

    player.PlayerData.metadata = player.PlayerData.metadata or {}
    return player.PlayerData.metadata[key]
  end

  function player.Functions.SetJob(jobName, grade)
    if IsBlankString(jobName) then
      return false
    end

    local gradeValue = grade or 0
    local gradeName = tostring(gradeValue)
    local gradeLevel = tonumber(gradeValue) or 0
    if type(gradeValue) == 'table' then
      gradeName = tostring(gradeValue.name or gradeValue.label or gradeValue.level or 0)
      gradeLevel = tonumber(gradeValue.level) or tonumber(gradeValue.grade) or 0
    end

    player.PlayerData.job = {
      name = jobName,
      label = jobName,
      payment = 0,
      onduty = true,
      isboss = false,
      grade = {
        name = gradeName,
        level = gradeLevel
      }
    }
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    TriggerClientEvent('QBCore:Client:OnJobUpdate', player.PlayerData.source, player.PlayerData.job)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.SetJobDuty(onDuty)
    player.PlayerData.job = player.PlayerData.job or {}
    player.PlayerData.job.onduty = onDuty == true
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    TriggerClientEvent('QBCore:Client:OnJobUpdate', player.PlayerData.source, player.PlayerData.job)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.SetGang(gangName, grade)
    if IsBlankString(gangName) then
      return false
    end

    local gradeValue = grade or 0
    local gradeName = tostring(gradeValue)
    local gradeLevel = tonumber(gradeValue) or 0
    if type(gradeValue) == 'table' then
      gradeName = tostring(gradeValue.name or gradeValue.label or gradeValue.level or 0)
      gradeLevel = tonumber(gradeValue.level) or tonumber(gradeValue.grade) or 0
    end

    player.PlayerData.gang = {
      name = gangName,
      label = gangName,
      isboss = false,
      grade = {
        name = gradeName,
        level = gradeLevel
      }
    }
    QueueQbCharacterUpdate(player.PlayerData.source, player.PlayerData)
    TriggerClientEvent('QBCore:Client:OnGangUpdate', player.PlayerData.source, player.PlayerData.gang)
    TriggerClientEvent('QBCore:Player:SetPlayerData', player.PlayerData.source, player.PlayerData)
    return true
  end

  function player.Functions.AddMethod(methodName, handler)
    if IsBlankString(methodName) then
      return false
    end
    if type(handler) ~= 'function' then
      return false
    end

    player.Functions[methodName] = handler
    return true
  end

  function player.Functions.AddField(fieldName, value)
    if IsBlankString(fieldName) then
      return false
    end

    player[fieldName] = value
    return true
  end

  player.GetMoney = player.Functions.GetMoney
  player.AddMoney = player.Functions.AddMoney
  player.RemoveMoney = player.Functions.RemoveMoney
  player.SetMoney = player.Functions.SetMoney
  player.GetItemByName = player.Functions.GetItemByName
  player.HasItem = player.Functions.HasItem
  player.AddItem = player.Functions.AddItem
  player.RemoveItem = player.Functions.RemoveItem
  player.UpdatePlayerData = player.Functions.UpdatePlayerData
  player.SetPlayerData = player.Functions.SetPlayerData
  player.Save = player.Functions.Save
  player.Logout = player.Functions.Logout
  player.SetMetaData = player.Functions.SetMetaData
  player.GetMetaData = player.Functions.GetMetaData
  player.SetJob = player.Functions.SetJob
  player.SetJobDuty = player.Functions.SetJobDuty
  player.SetGang = player.Functions.SetGang
  player.AddMethod = player.Functions.AddMethod
  player.AddField = player.Functions.AddField

  return player
end

local function UpsertQbPlayer(source, playerData)
  local ok, target = NormalizePlayerTarget(source, 'QBCore player upsert requires a player source')
  if not ok then
    return nil
  end

  local nextPlayerData = BuildDefaultQbPlayerData(target)
  if type(playerData) == 'table' then
    for key, value in pairs(playerData) do
      nextPlayerData[key] = value
    end
  end
  nextPlayerData.source = target

  local player = AttachQbPlayerFunctions({
    PlayerData = nextPlayerData,
    Functions = {}
  })

  Runtime.qbPlayers[target] = player
  TriggerClientEvent('QBCore:Client:OnPlayerLoaded', target)
  TriggerClientEvent('QBCore:Player:SetPlayerData', target, player.PlayerData)

  return player
end

function SelectQbCharacter(source, characterId, playerData)
  local ok, target = NormalizePlayerTarget(source, 'QBCore character selection requires a player source')
  if not ok then
    return nil, target
  end
  if IsBlankString(characterId) then
    return nil, 'QBCore character selection requires characterId'
  end

  local nextPlayerData = playerData or {}
  if type(nextPlayerData) ~= 'table' then
    nextPlayerData = {}
  end
  nextPlayerData.characterId = characterId
  local player = UpsertQbPlayer(target, nextPlayerData)
  QueueQbCharacterSelection(target, characterId)
  return player
end

local function GetQbPlayer(source)
  local ok, target = NormalizePlayerTarget(source, 'QBCore player lookup requires a player source')
  if not ok then
    return nil
  end

  if Runtime.qbPlayers[target] == nil then
    return UpsertQbPlayer(target, {})
  end

  return AttachQbPlayerFunctions(Runtime.qbPlayers[target])
end

local function GetQbPlayers()
  return Runtime.qbPlayers
end

local function GetQbPlayerSources()
  local sources = {}
  for source in pairs(Runtime.qbPlayers) do
    sources[#sources + 1] = source
  end

  return sources
end

local function GetQbIdentifier(source, idType)
  local ok, target = NormalizePlayerTarget(source, 'QBCore identifier lookup requires a player source')
  if not ok then
    return nil
  end

  idType = idType or 'license'
  local prefix = ('%s:'):format(idType)
  for _, identifier in ipairs(GetPlayerIdentifiers(target)) do
    if identifier == idType or identifier:sub(1, #prefix) == prefix then
      return identifier
    end
  end

  local player = Runtime.qbPlayers[target]
  if player and player.PlayerData and idType == 'license' then
    return player.PlayerData.license
  end

  return nil
end

local function GetQbSource(identifier)
  if IsBlankString(identifier) then
    return nil
  end

  for source, player in pairs(Runtime.qbPlayers) do
    local playerData = player.PlayerData or {}
    if playerData.license == identifier or playerData.citizenid == identifier then
      return source
    end
    for _, playerIdentifier in ipairs(GetPlayerIdentifiers(source)) do
      if playerIdentifier == identifier then
        return source
      end
    end
  end

  return nil
end

local function GetQbPlayerByCitizenId(citizenid)
  if IsBlankString(citizenid) then
    return nil
  end

  for _, player in pairs(Runtime.qbPlayers) do
    if player.PlayerData and player.PlayerData.citizenid == citizenid then
      return AttachQbPlayerFunctions(player)
    end
  end

  return nil
end

local function GetQbPlayerByPhone(number)
  if IsBlankString(number) then
    return nil
  end

  for _, player in pairs(Runtime.qbPlayers) do
    local charinfo = player.PlayerData and player.PlayerData.charinfo or {}
    if charinfo.phone == number then
      return AttachQbPlayerFunctions(player)
    end
  end

  return nil
end

local function GetQbPlayerByAccount(account)
  if IsBlankString(account) then
    return nil
  end

  for _, player in pairs(Runtime.qbPlayers) do
    local charinfo = player.PlayerData and player.PlayerData.charinfo or {}
    if charinfo.account == account then
      return AttachQbPlayerFunctions(player)
    end
  end

  return nil
end

local function GetQbPlayerByCharInfo(key, value)
  if IsBlankString(key) then
    return nil
  end

  for _, player in pairs(Runtime.qbPlayers) do
    local charinfo = player.PlayerData and player.PlayerData.charinfo or {}
    if charinfo[key] == value then
      return AttachQbPlayerFunctions(player)
    end
  end

  return nil
end

local function GetQbPlayersByJob(job, checkOnDuty)
  local players = {}
  local count = 0
  if IsBlankString(job) then
    return players, count
  end

  for source, player in pairs(Runtime.qbPlayers) do
    local playerJob = player.PlayerData and player.PlayerData.job or {}
    if playerJob.name == job or playerJob.type == job then
      if checkOnDuty ~= true or playerJob.onduty == true then
        players[#players + 1] = source
        count = count + 1
      end
    end
  end

  return players, count
end

local function GetQbPlayersOnDuty(job)
  return GetQbPlayersByJob(job, true)
end

local function GetQbDutyCount(job)
  local _, count = GetQbPlayersByJob(job, true)
  return count
end

local function QbFieldChanged(previousValue, nextValue)
  return json.encode(previousValue or {}) ~= json.encode(nextValue or {})
end

local function EmitQbPlayerDeltaEvents(target, previousData, nextData)
  previousData = previousData or {}
  nextData = nextData or {}

  if QbFieldChanged(previousData.money, nextData.money) then
    TriggerClientEvent('QBCore:Client:OnMoneyChange', target, nextData.money or {})
  end

  if QbFieldChanged(previousData.job, nextData.job) then
    TriggerClientEvent('QBCore:Client:OnJobUpdate', target, nextData.job)
  end

  if QbFieldChanged(previousData.gang, nextData.gang) then
    TriggerClientEvent('QBCore:Client:OnGangUpdate', target, nextData.gang)
  end

  if QbFieldChanged(previousData.metadata, nextData.metadata) then
    TriggerClientEvent('QBCore:Client:OnMetaDataUpdate', target, nextData.metadata)
  end
end

local function SyncQbPlayerData(players)
  if type(players) ~= 'table' then
    return false, 'QBCore player sync requires players table'
  end

  local synced = 0

  for _, playerData in ipairs(players) do
    if type(playerData) ~= 'table' then
      return false, 'QBCore player sync entries must be tables'
    end

    local ok, target = NormalizePlayerTarget(playerData.source, 'QBCore player sync requires player source')
    if not ok then
      return false, target
    end

    local previous = Runtime.qbPlayers[target]
    local player = UpsertQbPlayer(target, playerData)
    EmitQbPlayerDeltaEvents(target, previous and previous.PlayerData or nil, player.PlayerData)
    synced = synced + 1
  end

  return true, synced
end

AddEventHandler('playerJoining', function()
  UpsertQbPlayer(source, {})
end)

AddEventHandler('playerDropped', function()
  TriggerClientEvent('QBCore:Client:OnPlayerUnload', source)
  Runtime.qbPlayers[source] = nil
end)

local function DispatchClientEvent(eventName, targetSource, payload)
  if type(eventName) ~= 'string' or eventName == '' then
    return false, 'eventName must be a non-empty string'
  end

  local ok, target = NormalizePlayerTarget(targetSource, 'targetSource must be a player source')
  if not ok and tonumber(targetSource) == -1 then
    return false, 'broadcast client events are not allowed'
  end
  if not ok then
    return false, target
  end

  TriggerClientEvent(eventName, target, payload or {})
  return true, {
    eventName = eventName,
    targetSource = target
  }
end

local function RepairVehicle(repair)
  if type(repair) ~= 'table' then
    return false, 'vehicle repair must be a table'
  end

  local ok, target = NormalizePlayerTarget(repair.targetSource, 'vehicle repair requires a player target')
  if not ok then
    return false, target
  end

  local targetVehicleNetId = tonumber(repair.targetVehicleNetId)
  if targetVehicleNetId == nil then
    return false, 'vehicle repair requires a network id'
  end

  TriggerClientEvent('sdb_runtime:repairVehicle', target, {
    targetVehicleNetId = targetVehicleNetId
  })
  return true, {
    targetSource = target,
    targetVehicleNetId = targetVehicleNetId
  }
end

local function SpawnVehicles(spawns)
  if type(spawns) ~= 'table' then
    return false, 'spawns must be a table'
  end

  local spawned = {}

  for _, spawn in ipairs(spawns) do
    if type(spawn) ~= 'table' then
      return false, 'vehicle spawn must be a table'
    end

    local ok, target = NormalizePlayerTarget(spawn.targetSource, 'vehicle spawn requires a player target')
    if not ok then
      return false, target
    end

    if type(spawn.model) ~= 'string' or spawn.model == '' then
      return false, 'vehicle spawn requires a model'
    end

    local x = 0.0
    local y = 0.0
    local z = 0.0
    if type(spawn.location) == 'table' then
      x = tonumber(spawn.location.x) or 0.0
      y = tonumber(spawn.location.y) or 0.0
      z = tonumber(spawn.location.z) or 0.0
    else
      local ped = GetPlayerPed(target)
      local coords = GetEntityCoords(ped)
      x = coords.x
      y = coords.y
      z = coords.z
    end

    local heading = tonumber(spawn.heading) or GetEntityHeading(GetPlayerPed(target))
    local vehicle = CreateVehicle(GetHashKey(spawn.model), x, y, z, heading, true, true)
    if spawn.warpIntoVehicle == true then
      TaskWarpPedIntoVehicle(GetPlayerPed(target), vehicle, -1)
    end

    spawned[#spawned + 1] = {
      targetSource = target,
      model = spawn.model,
      vehicle = vehicle
    }
  end

  return true, spawned
end

local function DeleteVehicle(vehicleNetId)
  local netId = tonumber(vehicleNetId)
  if netId == nil then
    return false, 'vehicle delete requires a network id'
  end

  local entity = NetworkGetEntityFromNetworkId(netId)
  if entity == nil or entity == 0 then
    return false, 'vehicle entity was not found'
  end

  DeleteEntity(entity)
  return true, {
    vehicleNetId = netId,
    entity = entity
  }
end

local function ApplyWorldState(world)
  if type(world) ~= 'table' then
    return false, 'world state must be a table'
  end

  for key, value in pairs(world) do
    Runtime.worldState[key] = value
  end

  TriggerClientEvent('sdb_runtime:worldState', -1, Runtime.worldState)
  return true, Runtime.worldState
end

local function TeleportPlayer(teleport)
  if type(teleport) ~= 'table' then
    return false, 'teleport must be a table'
  end

  local ok, target = NormalizePlayerTarget(teleport.targetSource, 'teleport requires a player target')
  if not ok then
    return false, target
  end

  local x = tonumber(teleport.x)
  local y = tonumber(teleport.y)
  local z = tonumber(teleport.z)
  if x == nil or y == nil or z == nil then
    return false, 'teleport requires finite x, y, and z'
  end

  local payload = {
    x = x,
    y = y,
    z = z
  }
  if teleport.heading ~= nil then
    payload.heading = tonumber(teleport.heading)
  end

  TriggerClientEvent('sdb_runtime:teleport', target, payload)
  return true, {
    targetSource = target,
    x = x,
    y = y,
    z = z
  }
end

local function KickPlayer(kick)
  if type(kick) ~= 'table' then
    return false, 'kick must be a table'
  end

  local ok, target = NormalizePlayerTarget(kick.targetSource, 'kick requires a player target')
  if not ok then
    return false, target
  end

  if type(kick.reason) ~= 'string' or kick.reason == '' then
    return false, 'kick requires a reason'
  end

  DropPlayer(target, kick.reason)
  return true, {
    targetSource = target,
    reason = kick.reason
  }
end

local function RegisterBuiltinAdminHandlers()
  RegisterLocalHandler('admin.vehicles.repair', function(_, payload)
    return RepairVehicle(payload)
  end, {
    requiredPermission = 'admin.vehicles.repair'
  })

  RegisterLocalHandler('admin.vehicles.spawn', function(_, payload)
    return SpawnVehicles({ payload })
  end, {
    requiredPermission = 'admin.vehicles.spawn'
  })

  RegisterLocalHandler('admin.world.weather', function(_, payload)
    return ApplyWorldState({
      weatherType = payload.weatherType
    })
  end, {
    requiredPermission = 'admin.world.weather'
  })

  RegisterLocalHandler('admin.world.time', function(_, payload)
    return ApplyWorldState({
      hour = payload.hour,
      minute = payload.minute
    })
  end, {
    requiredPermission = 'admin.world.time'
  })

  RegisterLocalHandler('admin.teleport.to_marker', function(_, payload)
    return TeleportPlayer(payload)
  end, {
    requiredPermission = 'admin.teleport.to_marker'
  })

  RegisterLocalHandler('admin.players.kick', function(_, payload)
    return KickPlayer(payload)
  end, {
    requiredPermission = 'admin.players.kick'
  })
end

local function SendMenuTree(targetSource)
  local principal = normalizeSource(targetSource)
  local tree = Runtime.menuTrees[principal] or {}

  TriggerClientEvent('sdb_runtime:menuTree', targetSource, tree)
end

local function RefreshMenuSessions()
  for targetSource in pairs(Runtime.menuSessions) do
    SendMenuTree(targetSource)
  end
end

local function NormalizeRuntimeEventName(eventName)
  if type(eventName) ~= 'string' then
    return nil, 'eventName must be a non-empty string'
  end

  local normalized = eventName:match('^%s*(.-)%s*$')
  if normalized == '' then
    return nil, 'eventName must be a non-empty string'
  end
  if normalized:sub(1, 12) ~= 'sdb_runtime:' then
    return nil, 'eventName must be an sdb_runtime event'
  end
  if normalized:find('%s') ~= nil then
    return nil, 'eventName must not contain whitespace'
  end

  return normalized, nil
end

local function DispatchRuntimeEvent(eventName, payload)
  local normalizedEventName, eventNameError = NormalizeRuntimeEventName(eventName)
  if normalizedEventName == nil then
    return false, eventNameError
  end

  payload = payload or {}
  if type(payload) ~= 'table' then
    return false, 'payload must be a table'
  end

  eventName = normalizedEventName

  if eventName == 'sdb_runtime:syncPermissions' then
    if type(payload.principalId) ~= 'string' or type(payload.permissions) ~= 'table' then
      return false, 'permission sync requires principalId and permissions'
    end
    Runtime.permissions[payload.principalId] = payload.permissions
    return true, payload.principalId
  end

  if eventName == 'sdb_runtime:syncConfig' then
    if type(payload.namespace) ~= 'string' or type(payload.values) ~= 'table' then
      return false, 'config sync requires namespace and values'
    end
    Runtime.config[payload.namespace] = payload.values
    return true, payload.namespace
  end

  if eventName == 'sdb_runtime:syncHealth' then
    if type(payload.health) ~= 'table' then
      return false, 'health sync requires health'
    end
    local health = payload.health
    Runtime.health = health
    return true, Runtime.health
  end

  if eventName == 'sdb_runtime:syncMenuTree' then
    if type(payload.principalId) ~= 'string' or type(payload.tree) ~= 'table' then
      return false, 'menu tree sync requires principalId and tree'
    end
    Runtime.menuTrees[payload.principalId] = payload.tree
    TriggerClientEvent('sdb_runtime:menuTree', payload.principalId, payload.tree)
    return true, payload.principalId
  end

  if eventName == 'sdb_runtime:syncDeployments' then
    if type(payload.deployments) ~= 'table' or type(payload.sandboxEvents) ~= 'table' then
      return false, 'deployment sync requires deployments and sandboxEvents'
    end
    Runtime.deployments = payload.deployments
    Runtime.sandboxEvents = payload.sandboxEvents
    return true, {
      deploymentCount = #Runtime.deployments,
      sandboxEventCount = #Runtime.sandboxEvents
    }
  end

  if eventName == 'sdb_runtime:syncQbPlayerData' then
    return SyncQbPlayerData(payload.players or payload)
  end

  if eventName == 'sdb_runtime:syncQbShared' then
    return SyncQbShared(payload.shared or payload)
  end

  if eventName == 'sdb_runtime:syncReplicatedState' then
    return ApplyReplicatedState(payload.updates)
  end

  if eventName == 'sdb_runtime:dispatchClientEvent' then
    return DispatchClientEvent(payload.eventName, payload.targetSource, payload.payload)
  end

  if eventName == 'sdb_runtime:repairVehicle' then
    if type(payload.repairs) == 'table' then
      local applied = 0
      for _, repair in ipairs(payload.repairs) do
        local ok = RepairVehicle(repair)
        if not ok then
          return false, 'vehicle repair failed'
        end
        applied = applied + 1
      end
      return true, applied
    end
    return RepairVehicle(payload.repair or payload)
  end

  if eventName == 'sdb_runtime:spawnVehicles' then
    return SpawnVehicles(payload.spawns or payload)
  end

  if eventName == 'sdb_runtime:syncWorldState' then
    return ApplyWorldState(payload.world or payload)
  end

  if eventName == 'sdb_runtime:teleportPlayer' then
    return TeleportPlayer(payload.teleport or payload)
  end

  if eventName == 'sdb_runtime:kickPlayer' then
    return KickPlayer(payload.kick or payload)
  end

  if eventName == 'sdb_runtime:syncMenuRefresh' then
    RefreshMenuSessions()
    return true, true
  end

  if eventName == 'sdb_runtime:applyAceMirror' then
    return true, ApplyAceMirrorCommands(payload.commands or payload)
  end

  return false, ('unsupported runtime event: %s'):format(eventName)
end

RegisterNetEvent('sdb_runtime:syncPermissions', function(principalId, permissions)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncPermissions', {
    principalId = principalId,
    permissions = permissions
  })
end)

RegisterNetEvent('sdb_runtime:syncConfig', function(namespace, values)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncConfig', {
    namespace = namespace,
    values = values
  })
end)

RegisterNetEvent('sdb_runtime:syncHealth', function(health)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncHealth', {
    health = health
  })
end)

RegisterNetEvent('sdb_runtime:syncMenuTree', function(principalId, tree)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncMenuTree', {
    principalId = principalId,
    tree = tree
  })
end)

RegisterNetEvent('sdb_runtime:syncDeployments', function(deployments, sandboxEvents)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncDeployments', {
    deployments = deployments,
    sandboxEvents = sandboxEvents
  })
end)

RegisterNetEvent('sdb_runtime:syncQbPlayerData', function(players)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncQbPlayerData', {
    players = players
  })
end)

RegisterNetEvent('sdb_runtime:syncQbShared', function(shared)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncQbShared', {
    shared = shared
  })
end)

RegisterNetEvent('sdb_runtime:syncReplicatedState', function(updates)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncReplicatedState', {
    updates = updates
  })
end)

RegisterNetEvent('sdb_runtime:dispatchClientEvent', function(eventName, targetSource, payload)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:dispatchClientEvent', {
    eventName = eventName,
    targetSource = targetSource,
    payload = payload
  })
end)

RegisterNetEvent('sdb_runtime:repairVehicle', function(repair)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:repairVehicle', repair)
end)

RegisterNetEvent('sdb_runtime:spawnVehicles', function(spawns)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:spawnVehicles', spawns)
end)

RegisterNetEvent('sdb_runtime:syncWorldState', function(world)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncWorldState', world)
end)

RegisterNetEvent('sdb_runtime:teleportPlayer', function(teleport)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:teleportPlayer', teleport)
end)

RegisterNetEvent('sdb_runtime:kickPlayer', function(kick)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:kickPlayer', kick)
end)

RegisterNetEvent('sdb_runtime:syncMenuRefresh', function()
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:syncMenuRefresh', {})
end)

RegisterNetEvent('sdb_runtime:requestMenuTree', function()
  local requestSource = source
  local principal = normalizeSource(requestSource)
  Runtime.menuSessions[requestSource] = principal

  SendMenuTree(requestSource)
end)

RegisterNetEvent('sdb_runtime:closeMenu', function()
  Runtime.menuSessions[source] = nil
end)

RegisterNetEvent('sdb_runtime:clientAction', function(actionName, payload)
  local requestSource = source
  if type(actionName) ~= 'string' or actionName == '' then
    TriggerClientEvent('sdb_runtime:actionResult', requestSource, {
      ok = false,
      result = 'actionName must be a non-empty string'
    })
    return
  end

  if payload ~= nil and type(payload) ~= 'table' then
    TriggerClientEvent('sdb_runtime:actionResult', requestSource, {
      ok = false,
      result = 'payload must be a table'
    })
    return
  end

  local dispatched, ok, result = pcall(CallAction, requestSource, actionName, payload)
  if not dispatched then
    result = tostring(ok)
    ok = false
  end

  TriggerClientEvent('sdb_runtime:actionResult', requestSource, {
    ok = ok,
    result = result
  })
end)

RegisterNetEvent('sdb_runtime:applyAceMirror', function(commands)
  if source ~= 0 then
    return
  end

  DispatchRuntimeEvent('sdb_runtime:applyAceMirror', {
    commands = commands
  })
end)

RegisterCommand('sdb_runtime_emit', function(source, args)
  if source ~= 0 then
    return
  end

  local raw = table.concat(args, ' ')
  if raw == '' then
    return
  end

  local decoded, envelope = pcall(json.decode, raw)
  if not decoded or type(envelope) ~= 'table' then
    return
  end
  if type(envelope.eventName) ~= 'string' then
    return
  end
  if envelope.payload ~= nil and type(envelope.payload) ~= 'table' then
    return
  end

  DispatchRuntimeEvent(envelope.eventName, envelope.payload or {})
end, true)

RegisterCommand('sdb_runtime_health', function(source)
  local target = source == 0 and -1 or source
  local health = GetHealth()
  health.handlers = GetHandlerNames()

  TriggerClientEvent('sdb_runtime:health', target, health)
end, true)

RegisterBuiltinAdminHandlers()

SetTimeout(1000, RequestResourceReconcile)

exports('HasPermission', HasPermission)
exports('GetPermissions', GetPermissions)
exports('CallAction', CallAction)
exports('GetConfig', GetConfig)
exports('GetHealth', GetHealth)
exports('GetDeployments', GetDeployments)
exports('GetQbShared', GetQbShared)
exports('SyncQbShared', SyncQbShared)
exports('RegisterLocalHandler', RegisterLocalHandler)
exports('ApplyAceMirrorCommands', ApplyAceMirrorCommands)
exports('ApplyReplicatedState', ApplyReplicatedState)
exports('DispatchClientEvent', DispatchClientEvent)
exports('RepairVehicle', RepairVehicle)
exports('SpawnVehicles', SpawnVehicles)
exports('DeleteVehicle', DeleteVehicle)
exports('ApplyWorldState', ApplyWorldState)
exports('TeleportPlayer', TeleportPlayer)
exports('KickPlayer', KickPlayer)
exports('GetQbPlayer', GetQbPlayer)
exports('UpsertQbPlayer', UpsertQbPlayer)
exports('SelectQbCharacter', SelectQbCharacter)
exports('GetQbPlayers', GetQbPlayers)
exports('GetQbPlayerSources', GetQbPlayerSources)
exports('GetQbIdentifier', GetQbIdentifier)
exports('GetQbSource', GetQbSource)
exports('GetQbPlayerByCitizenId', GetQbPlayerByCitizenId)
exports('GetQbPlayerByPhone', GetQbPlayerByPhone)
exports('GetQbPlayerByAccount', GetQbPlayerByAccount)
exports('GetQbPlayerByCharInfo', GetQbPlayerByCharInfo)
exports('GetQbPlayersOnDuty', GetQbPlayersOnDuty)
exports('GetQbPlayersByJob', GetQbPlayersByJob)
exports('GetQbDutyCount', GetQbDutyCount)
exports('SyncQbPlayerData', SyncQbPlayerData)
exports('QueueQbCharacterUpdate', QueueQbCharacterUpdate)
exports('DrainQbCharacterUpdates', DrainQbCharacterUpdates)
exports('DrainQbCharacterSelections', DrainQbCharacterSelections)
exports('QueueQbMoneyUpdate', QueueQbMoneyUpdate)
exports('DrainQbMoneyUpdates', DrainQbMoneyUpdates)
exports('QueueQbInventoryUpdate', QueueQbInventoryUpdate)
exports('DrainQbInventoryUpdates', DrainQbInventoryUpdates)
