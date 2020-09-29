'use strict'

const Builder = require('./builder')

// Vue CLI 插件服务
function service(api, options) {
  // 实例化构建器
  const builder = new Builder({ api, options })
  // 先注册插件命令
  builder._registerCommands()

  // 如果当前执行的命令是help，就不再执行其他服务加载了
  const {
    command,
    args: { help, h },
  } = builder.getDefaultContext()

  // 执行的是“帮助”命令时，就不进行服务注册了
  if (!command || help || h) {
    return
  }
  // 加载插件与服务
  // 要先执行插件加载
  builder._registerPlugins()
  // 加载服务
  builder._registerServices()
  // 打印命令、插件和服务信息到终端
  builder._echo()
}

// 装载命令脚本
// defaultModes用于导出构建命令的默认构建模式
Builder._loadCommands((service.defaultModes = {}))

module.exports = service
