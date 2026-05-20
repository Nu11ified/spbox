Locale = Locale or {}
Locale.__index = Locale

local function flatten(target, phrases, prefix)
  for key, value in pairs(phrases or {}) do
    local nextKey = prefix and (prefix .. '.' .. key) or key
    if type(value) == 'table' then
      flatten(target, value, nextKey)
    else
      target[nextKey] = tostring(value)
    end
  end
end

function Locale.new(_, options)
  local self = setmetatable({
    phrases = {},
    warnOnMissing = options == nil or options.warnOnMissing ~= false
  }, Locale)
  self:extend(options and options.phrases or {})
  return self
end

function Locale:extend(phrases)
  flatten(self.phrases, phrases or {})
end

function Locale:t(key, substitutions)
  local result = self.phrases[key] or key
  for name, value in pairs(substitutions or {}) do
    result = result:gsub('%%{' .. name .. '}', tostring(value))
  end
  return result
end
