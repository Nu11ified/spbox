fx_version 'cerulean'
game 'gta5'

author 'spbox'
description 'SpacetimeDB-backed FiveM runtime control plane'
version '0.1.0'

client_script 'client/main.lua'
server_script 'server/main.lua'

ui_page 'web/index.html'

files {
  'web/index.html',
  'web/app.js',
  'config/bootstrap.example.json'
}
