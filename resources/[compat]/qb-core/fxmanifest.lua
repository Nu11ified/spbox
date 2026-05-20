fx_version 'cerulean'
game 'gta5'

author 'spbox'
description 'QBCore compatibility facade backed by sdb_runtime'
version '0.1.0'

provide 'qb-core'
dependency 'sdb_runtime'

shared_script 'shared/locale.lua'
client_script 'client/main.lua'
server_script 'server/main.lua'
