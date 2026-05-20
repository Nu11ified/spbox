local open = false

local function setChatOpen(nextOpen, slash)
  open = nextOpen
  SetNuiFocus(open, open)
  SendNUIMessage({
    type = 'sdb_poc_chat:open',
    open = open,
    slash = slash == true
  })
end

RegisterCommand('pocchat', function()
  setChatOpen(true, false)
end, false)

RegisterCommand('pocslash', function()
  setChatOpen(true, true)
end, false)

RegisterKeyMapping('pocchat', 'Open SPBox POC chat', 'keyboard', 'T')
RegisterKeyMapping('pocslash', 'Open SPBox POC command chat', 'keyboard', 'SLASH')

RegisterNetEvent('sdb_poc_chat:message', function(entry)
  SendNUIMessage({
    type = 'sdb_poc_chat:message',
    entry = entry or {}
  })
end)

RegisterNUICallback('submit', function(data, cb)
  local message = tostring(data and data.message or ''):sub(1, 180)
  setChatOpen(false, false)
  if message ~= '' then
    if message:sub(1, 1) == '/' then
      ExecuteCommand(message:sub(2))
    else
      TriggerServerEvent('sdb_poc_chat:message', message)
    end
  end
  cb({ ok = true })
end)

RegisterNUICallback('close', function(_, cb)
  setChatOpen(false, false)
  cb({ ok = true })
end)
