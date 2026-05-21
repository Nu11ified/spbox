local pluginId = 'sdb_qbcore_real_plugins'
local adminEndpoint = GetConvar('sdb_poc_admin_endpoint', '')
local bootstrapped = false
local ready = false
local tables = {
  apartments = {},
  bank_accounts = {},
  bank_statements = {},
  bans = {},
  houselocations = {},
  player_houses = {},
  player_outfits = {},
  player_vehicles = {},
  player_warns = {},
  players = {},
  playerskins = {},
  server_logs = {}
}
local counters = {}

local function cleanSql(query)
  return tostring(query or ''):gsub('%s+', ' '):lower()
end

local function clone(value)
  if type(value) ~= 'table' then
    return value
  end

  local nextValue = {}
  for key, entry in pairs(value) do
    nextValue[key] = clone(entry)
  end
  return nextValue
end

local function rows(tableName)
  tables[tableName] = tables[tableName] or {}
  return tables[tableName]
end

local function nextId(tableName)
  counters[tableName] = (counters[tableName] or 0) + 1
  return counters[tableName]
end

local function param(params, key, fallback)
  if type(params) ~= 'table' then
    return fallback
  end

  if params[key] ~= nil then
    return params[key]
  end
  if type(key) == 'string' then
    return params['@' .. key] or fallback
  end
  return fallback
end

local function adminUrl(path)
  if adminEndpoint == '' then
    return nil
  end

  return adminEndpoint:gsub('/+$', '') .. path
end

local function postAdmin(path, body)
  local url = adminUrl(path)
  if url == nil then
    return
  end

  PerformHttpRequest(url, function(status, response)
    if status < 200 or status >= 300 then
      print(('[oxmysql] SPBox write failed %s HTTP %s %s'):format(path, status, response or ''))
    end
  end, 'POST', json.encode(body), {
    ['Content-Type'] = 'application/json'
  })
end

local function bootstrap()
  if bootstrapped then
    return
  end
  bootstrapped = true

  postAdmin('/plugins/install', {
    pluginId = pluginId,
    name = 'SPBox Real QBCore Plugin SQL Facade',
    version = '0.1.0'
  })
  SetTimeout(250, function()
    postAdmin('/plugins/' .. pluginId .. '/enable', {})
    postAdmin('/plugins/schemas', {
      pluginId = pluginId,
      schemaVersion = 1,
      entityType = 'sql_row',
      schemaJson = '{"type":"object","required":["tableName","rowKey","rowJson"],"properties":{"tableName":{"type":"string"},"rowKey":{"type":"string"},"rowJson":{"type":"string"}}}',
      migrationPlanJson = '[]',
      status = 'active'
    })
    SetTimeout(300, function()
      ready = true
    end)
  end)
end

local function rowKey(tableName, row)
  if row.citizenid ~= nil then
    if row.outfitId ~= nil then
      return ('%s:%s'):format(row.citizenid, row.outfitId)
    end
    if row.name ~= nil then
      return tostring(row.name)
    end
    return tostring(row.citizenid)
  end
  if row.plate ~= nil then
    return tostring(row.plate)
  end
  if row.account_name ~= nil then
    return tostring(row.account_name)
  end
  if row.warnId ~= nil then
    return tostring(row.warnId)
  end
  return tostring(row.id or nextId(tableName))
end

local function persist(tableName, row)
  bootstrap()
  local key = rowKey(tableName, row)
  row.id = row.id or key

  local body = {
    id = ('%s:%s:%s'):format(pluginId, tableName, key),
    pluginId = pluginId,
    entityType = 'sql_row',
    ownerType = 'plugin',
    ownerId = ('%s:%s'):format(tableName, key),
    dataJson = json.encode({
      tableName = tableName,
      rowKey = key,
      rowJson = json.encode(row)
    })
  }

  if ready then
    postAdmin('/plugins/entities', body)
  else
    SetTimeout(800, function()
      postAdmin('/plugins/entities', body)
    end)
  end
end

local function upsert(tableName, row, predicate)
  local collection = rows(tableName)
  for index, existing in ipairs(collection) do
    if predicate(existing) then
      collection[index] = row
      persist(tableName, row)
      return 1
    end
  end

  collection[#collection + 1] = row
  persist(tableName, row)
  return 1
end

local function filter(tableName, predicate)
  local result = {}
  for _, row in ipairs(rows(tableName)) do
    if predicate(row) then
      result[#result + 1] = clone(row)
    end
  end
  return result
end

local function deleteWhere(tableName, predicate)
  local collection = rows(tableName)
  local kept = {}
  local deleted = 0
  for _, row in ipairs(collection) do
    if predicate(row) then
      deleted = deleted + 1
    else
      kept[#kept + 1] = row
    end
  end
  tables[tableName] = kept
  return deleted
end

local function parseInsert(query, params)
  local tableName, columns = tostring(query):match('INSERT%s+INTO%s+([%w_]+)%s*%(([^%)]+)%)')
  if tableName == nil then
    tableName, columns = tostring(query):match('insert%s+into%s+([%w_]+)%s*%(([^%)]+)%)')
  end
  if tableName == nil then
    return nil
  end

  local row = {}
  local index = 1
  for column in columns:gmatch('[^,]+') do
    column = column:gsub('`', ''):gsub('^%s+', ''):gsub('%s+$', '')
    row[column] = param(params, index)
    index = index + 1
  end
  row.id = row.id or nextId(tableName)
  return tableName, row
end

local function selectRows(sql, params)
  if sql:find('from players where license = ?', 1, true) then
    return filter('players', function(row) return row.license == param(params, 1) end)
  end
  if sql:find('from playerskins where citizenid = ? and active = ?', 1, true) then
    return filter('playerskins', function(row) return row.citizenid == param(params, 1) and tonumber(row.active) == tonumber(param(params, 2)) end)
  end
  if sql:find('from player_outfits where citizenid = ?', 1, true) then
    return filter('player_outfits', function(row) return row.citizenid == param(params, 1) end)
  end
  if sql:find('count(*) as count from apartments where name = ?', 1, true) then
    return { { count = #filter('apartments', function(row) return row.name == param(params, 1) end) } }
  end
  if sql:find('from apartments where name = ?', 1, true) then
    return filter('apartments', function(row) return row.name == param(params, 1) end)
  end
  if sql:find('from apartments where citizenid = ?', 1, true) then
    return filter('apartments', function(row) return row.citizenid == param(params, 1) end)
  end
  if sql:find('from player_houses where citizenid = ?', 1, true) then
    return filter('player_houses', function(row) return row.citizenid == param(params, 1) end)
  end
  if sql:find('from player_vehicles where citizenid = ?', 1, true) then
    return filter('player_vehicles', function(row) return row.citizenid == param(params, 1) end)
  end
  if sql:find('from player_vehicles where plate = ?', 1, true) then
    return filter('player_vehicles', function(row) return row.plate == param(params, 1) end)
  end
  if sql:find('from bank_accounts', 1, true) then
    return filter('bank_accounts', function() return true end)
  end
  if sql:find('from bank_statements', 1, true) then
    return filter('bank_statements', function() return true end)
  end
  if sql:find('from player_warns where targetidentifier = ?', 1, true) then
    return filter('player_warns', function(row) return row.targetIdentifier == param(params, 1) end)
  end
  if sql:find('from houselocations', 1, true) then
    return filter('houselocations', function() return true end)
  end
  if sql:find('from server_logs', 1, true) then
    return filter('server_logs', function() return true end)
  end

  return {}
end

local function executeUpdate(sql, params)
  if sql:find('delete from playerskins where citizenid = ?', 1, true) then
    return deleteWhere('playerskins', function(row) return row.citizenid == param(params, 1) end)
  end
  if sql:find('delete from player_outfits where citizenid = ? and outfitname = ? and outfitid = ?', 1, true) then
    return deleteWhere('player_outfits', function(row)
      return row.citizenid == param(params, 1) and row.outfitname == param(params, 2) and row.outfitId == param(params, 3)
    end)
  end
  if sql:find('delete from player_warns where warnid = ?', 1, true) then
    return deleteWhere('player_warns', function(row) return row.warnId == param(params, 1) end)
  end
  if sql:find('delete from bank_accounts where account_name = ? and citizenid = ?', 1, true) then
    return deleteWhere('bank_accounts', function(row) return row.account_name == param(params, 1) and row.citizenid == param(params, 2) end)
  end
  if sql:find('delete from player_vehicles where plate = @plate', 1, true) then
    return deleteWhere('player_vehicles', function(row) return row.plate == param(params, 'plate') end)
  end
  if sql:find('update apartments set type = ?, label = ? where citizenid = ?', 1, true) then
    local count = 0
    for _, row in ipairs(rows('apartments')) do
      if row.citizenid == param(params, 3) then
        row.type = param(params, 1)
        row.label = param(params, 2)
        count = count + 1
        persist('apartments', row)
      end
    end
    return count
  end
  if sql:find('update player_vehicles set', 1, true) then
    local plate = param(params, #params)
    local count = 0
    for _, row in ipairs(rows('player_vehicles')) do
      if row.plate == plate then
        count = count + 1
        persist('player_vehicles', row)
      end
    end
    return count
  end
  if sql:find('update bank_accounts set users = ?', 1, true) then
    local count = 0
    for _, row in ipairs(rows('bank_accounts')) do
      if row.account_name == param(params, 2) and row.citizenid == param(params, 3) then
        row.users = param(params, 1)
        count = count + 1
        persist('bank_accounts', row)
      end
    end
    return count
  end

  return 0
end

local function executeInsert(query, params)
  local tableName, row = parseInsert(query, params)
  if tableName == nil then
    return 0
  end

  return upsert(tableName, row, function(existing)
    local key = rowKey(tableName, row)
    return rowKey(tableName, existing) == key
  end)
end

local function Execute(operation, query, params)
  bootstrap()
  local sql = cleanSql(query)

  if operation == 'insert' then
    return executeInsert(query, params)
  end
  if operation == 'update' then
    return executeUpdate(sql, params)
  end
  if operation == 'scalar' then
    local result = selectRows(sql, params)
    local first = result[1]
    if first == nil then
      return nil
    end
    for _, value in pairs(first) do
      return value
    end
    return nil
  end
  if operation == 'single' then
    return selectRows(sql, params)[1]
  end
  if operation == 'rawExecute' and not sql:find('select', 1, true) then
    return executeUpdate(sql, params)
  end
  if operation == 'prepare' then
    return selectRows(sql, params)
  end

  return selectRows(sql, params)
end

local function UpsertRow(tableName, row)
  if type(tableName) ~= 'string' or type(row) ~= 'table' then
    return false
  end

  upsert(tableName, clone(row), function(existing)
    return rowKey(tableName, existing) == rowKey(tableName, row)
  end)
  return true
end

local function SelectRows(tableName, fieldName, value)
  if type(tableName) ~= 'string' then
    return {}
  end
  if fieldName == nil then
    return filter(tableName, function() return true end)
  end

  return filter(tableName, function(row)
    return row[fieldName] == value
  end)
end

exports('SpboxExecute', Execute)
exports('SpboxUpsertRow', UpsertRow)
exports('SpboxSelectRows', SelectRows)
