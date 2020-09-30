'use strict'

const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')

const readPkg = require('read-pkg')
const { getVueCLIArgs } = require('@ices/shared-utils-node/lib/argv')
const {
  parseVueAppEnv,
  parseProcessEnv,
} = require('@ices/shared-utils-node/lib/env')

const ServiceBase = require('./service')
const { ENV_TIMESTAMP } = require('./constants')
const defaults = require('./options')

/*!
 * 构建器基于Vue CLI的插件API，定义了一个统一的接口，用于将一系列构建插件和命令与Vue Cli进行集成。
 * 较Vue CLI的插件API，为插件或命令提供更多的构建辅助参数或工具。
 */
class Builder {
  cliArgs = getVueCLIArgs() // 命令行参数

  global = {} // 服务的全局数据存取

  constructor({ api, options }) {
    // 一些插件需要根据当前时间生成资源名称，如果取值时间点有变化，可能会造成单次构建中生成的资源名称前后不一致
    // 此时间戳用于确定当前构建时间点
    this.timestamp = Date.now()
    process.env[ENV_TIMESTAMP] = `${this.timestamp}`

    //
    this.cwd = api.getCwd() || process.cwd() // 当前工作目录
    this.mode = process.env.NODE_ENV || 'development' // 当前构建模式
    this.api = api // Vue CLI 插件API实例
    this.options = options // 工程的Vue构建配置
    this.services = {} // 已注册的服务
    this.pkg = readPkg.sync({ cwd: path.join(__dirname, '..') }) // 插件package.json
    this.proPkg = readPkg.sync({ cwd: this.cwd }) // 工程package.json
    this.defaultOptions = Object.freeze(defaults(this.getContext())) // 默认的工程配置
    this.emitter = new EventEmitter() // 全局事件监听与派发
    this.emitter.setMaxListeners(0) // 取消绑定监听器数量限制
  }

  // 获取服务的构建上下文
  getContext() {
    const api = this.api
    const { rawArgv, args, command } = this.cliArgs
    const npm = process.env.npm_config_user_agent || ''
    // 返回上下文对象
    return {
      args, // 已进行数据类型转换处理的参数对象
      rawArgv, // 原始的进程运行参数数组
      command, // 当前执行的构建命令
      cwd: this.cwd, // 当前工程构建所在的目录
      mode: this.mode, // 当前的构建模式
      global: this.global, // 全局存储的数据
      emitter: this.emitter, // 全局事件收发器
      options: this.options, // 工程配置对象
      defaultOptions: this.defaultOptions, // 默认的工程配置对象
      packageJson: this.proPkg, // 工程pkg对象
      pluginPackageJson: this.pkg, // 当前插件的pkg对象
      timestamp: this.timestamp, // 构建器初始化时的时间戳
      engines: {
        node: process.version.replace(/^[\D]+/, ''), // 当前运行环境的node版本号
        npm: /\bnpm\/([^\s]+)/.test(npm) ? RegExp.$1 : npm, // 当前运行环境的npm版本号
      },
      // 已进行数据类型处理的进程环境变量对象
      get env() {
        return parseProcessEnv()
      },
      // 已进行数据类型处理的应用代码注入数据
      get data() {
        return parseVueAppEnv().data
      },
      get vueCLI() {
        return {
          version: api.version,
          service: process.VUE_CLI_SERVICE,
        }
      },
    }
  }

  // 获取命令的执行上下文
  getCommandContext(args, rawArgv) {
    const api = this.api
    let config
    return Object.defineProperties(
      {
        ...this.getContext(),
        args, // 去掉了当前命令名的参数对象
        rawArgv,
      },
      {
        // webpack-chain实例
        chainableWebpackConfig: {
          configurable: false,
          enumerable: false,
          set(val) {
            if (val === null) {
              config = val // 通过设置为null，则表示重新获取新的实例
            }
          },
          get() {
            return (config = config || api.resolveChainableWebpackConfig())
          },
        },
        // 最终的webpack配置对象
        resolvedWebpackConfig: {
          configurable: false,
          enumerable: false,
          get() {
            return api.resolveWebpackConfig(config || undefined)
          },
        },
      }
    )
  }

  /*!
   * 注册Vue插件命令模块
   * 所有定义于commands目录下的模块都将作为命令进行注册
   * 命令模块可以为一个函数，或者一个类
   *
   * 用类时的模块格式：
   * class CommandModule {
   *   static name: string; // 命令的名称（默认为模块文件（或目录）名称）
   *   static defaultMode = 'production'; // 默认的构建模式
   *   static help = {  // 命令的终端帮助提示，可以为一个对象，或者一个返回对象的函数
   *      description: '',
   *      usage: '',
   *      options: {
   *        '--name': 'the descriptions'
   *      }
   *   }
   *   constructor(context) {} // 构造函数
   * }
   */
  registerCommands() {
    const { api } = this
    const modulesPath = path.join(__dirname, './commands')
    const files = fs.readdirSync(modulesPath)
    // commands目录下的所有模块都会进行注册
    for (const fi of files) {
      // 命令模块可以为一个函数或者一个class
      const CommandModule = require(path.join(modulesPath, fi))
      const argv = []
      // 默认名称为文件或模块目录名
      argv.push(CommandModule.name || path.basename(fi, '.js').toLowerCase())
      const help = CommandModule.help // 获取命令行帮助提示
      if (typeof help === 'object') {
        argv.push(help)
      } else if (typeof help === 'function') {
        argv.push(help(this.getContext()))
      }
      argv.push((args, rawArgv) => {
        return new CommandModule(this.getCommandContext(args, rawArgv))
      })
      // 注册插件命令至Vue CLI
      api.registerCommand(...argv)
    }
  }

  // 注册构建插件
  // 这里的插件包括webpack、babel、express等的插件
  registerPlugins() {}

  // 注册构建服务
  // 构建服务会调用插件来提供一个完整的构建能力
  registerServices() {
    const servesPath = path.join(__dirname, './services')
    const files = fs.readdirSync(servesPath)
    //
    for (const fi of files) {
      const Service = require(path.join(servesPath, fi))
      if (Object.getPrototypeOf(Service) !== ServiceBase) {
        throw new Error(`服务类必须继承基类ServiceBase${fi}`)
      }
      try {
        // 实例化服务
        const serv = new Service(this.getContext())
        if (!serv.initialized) {
          continue
        }
        // 注册服务
        this.services[path.basename(fi, '.js')] = serv
        // 设置API
        // 调用配置方法进行构建配置
        // 子类可实现这些方法，对配置进行更新
        this.api.chainWebpack((...args) => serv.chainWebpack(...args))
        this.api.configureWebpack((...args) => serv.configureWebpack(...args))
        this.api.configureDevServer((...args) =>
          serv.configureDevServer(...args)
        )
      } catch (e) {
        console.error('服务初始化失败', e.message)
      }
    }
  }

  // 打印信息
  echo() {}

  // 装载命令模块
  // 因为需要确定命令的默认构建模式，这里需要在注册服务前进行装载
  static loadCommands(modes) {
    const modulesPath = path.join(__dirname, './commands')
    const files = fs.readdirSync(modulesPath)
    for (const fi of files) {
      const { defaultMode } = require(path.join(modulesPath, fi))
      if (defaultMode) {
        modes[path.basename(fi, '.js')] = defaultMode // defaultMode指定命令的默认构建模式
      }
    }
  }
}

module.exports = Builder
