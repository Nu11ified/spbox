local function makeItem(options)
  local item = {
    options = options or {},
    handlers = {}
  }

  function item:On(eventName, handler)
    self.handlers[string.lower(tostring(eventName or ''))] = handler
    return self
  end

  function item:Trigger(eventName, ...)
    local handler = self.handlers[string.lower(tostring(eventName or ''))]
    if type(handler) == 'function' then
      handler(self, ...)
    end
  end

  return item
end

local function makeMenu(title)
  local menu = {
    title = title or 'Menu',
    items = {}
  }

  function menu:AddButton(options)
    local item = makeItem(options)
    self.items[#self.items + 1] = item
    return item
  end

  function menu:AddCheckbox(options)
    local item = makeItem(options)
    item.checked = options and options.value == true
    self.items[#self.items + 1] = item
    return item
  end

  function menu:AddSlider(options)
    local item = makeItem(options)
    item.value = options and options.value or 0
    self.items[#self.items + 1] = item
    return item
  end

  function menu:ClearItems()
    self.items = {}
  end

  function menu:Close()
    MenuV:CloseMenu(self)
  end

  return menu
end

MenuV = MenuV or {}
MenuV.menus = MenuV.menus or {}
MenuV.current = nil

function MenuV:CreateMenu(_, title)
  local menu = makeMenu(title)
  self.menus[#self.menus + 1] = menu
  return menu
end

function MenuV:OpenMenu(menu)
  self.current = menu
  SetNuiFocus(false, false)
end

function MenuV:CloseMenu(menu)
  if self.current == menu then
    self.current = nil
  end
end

function MenuV:CloseAll()
  self.current = nil
end
