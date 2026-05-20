fx_version 'cerulean'
game 'gta5'

author 'spbox'
description 'Qbox/QBX compatibility facade backed by sdb_runtime'
version '0.1.0'

provide 'qbx_core'
dependency 'sdb_runtime'

shared_scripts {
  'shared/main.lua'
}

client_scripts {
  'client/main.lua',
  'modules/playerdata.lua'
}

server_script 'server/main.lua'
