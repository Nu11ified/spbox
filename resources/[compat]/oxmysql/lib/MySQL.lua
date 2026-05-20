local function call(operation, query, params, cb)
  params = params or {}
  local result = exports.oxmysql:SpboxExecute(operation, query, params)
  if type(cb) == 'function' then
    cb(result)
  end
  return result
end

local function callable(operation)
  local fn = function(query, params, cb)
    return call(operation, query, params, cb)
  end

  return setmetatable({
    await = function(query, params)
      return call(operation, query, params)
    end
  }, {
    __call = function(_, query, params, cb)
      return fn(query, params, cb)
    end
  })
end

MySQL = MySQL or {}
MySQL.query = callable('query')
MySQL.rawExecute = callable('rawExecute')
MySQL.update = callable('update')
MySQL.insert = callable('insert')
MySQL.scalar = callable('scalar')
MySQL.single = callable('single')
MySQL.prepare = callable('prepare')
