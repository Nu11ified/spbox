fx_version 'cerulean'
game 'gta5'

author 'spbox'
description 'Representative Qbox/QBX compatibility fixture for sdb_runtime'
version '0.1.0'

dependency 'sdb_runtime'
dependency 'qbx_core'

client_scripts {
  '@qbx_core/modules/playerdata.lua',
  'client/main.lua'
}

server_script 'server/main.lua'
