'use strict'

const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')
const {
  ENV_TIMESTAMP,
  EVENT_COMPILE,
  PLUGIN_COMPILER_EVENT,
} = require('./utils/constants')
const { getVueCLIArgs, parseVueAppEnv } = require('@ices/shared-utils-node')
const defaults = require('./options')
const pkg = require('../package.json')

/*!
 * 构建器基于Vue CLI的插件API，定义了一个统一的接口，用于将一系列构建插件和命令与Vue Cli进行集成。
 * 较Vue CLI的插件API，为插件或命令提供更多的构建辅助参数或工具。
 * 另外，由于构建器是一个单实例，并继承事件派发，也可为接入的插件和命令提供一个统一的的全局通信环境。
 */
class Builder extends EventEmitter {
  // 继承了事件派发器，提供单实例全局事件注册
  constructor({ api, options }) {
    super()
    // 一些插件需要根据当前时间生成资源名称，如果取值时间点有变化，可能会造成单次构建中生成的资源名称前后不一致
    // 此时间戳用于确定当前构建时间点
    process.env[ENV_TIMESTAMP] = `${Date.now()}`
    // 配置相关核心属性
    Object.defineProperties(this, {
      // Vue CLI 插件API实例
      api: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: api,
      },
      // 工程的Vue构建配置
      options: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: options,
      },
    })
    // 定义属性
    Object.defineProperties(this, {
      // 提供全局环境的环境数据存取
      global: {
        enumerable: true,
        configurable: false,
        writable: false,
        value: {},
      },
      // 默认的上下文对象，可获取构建初始时的一些参数数据
      defaultContext: {
        enumerable: true,
        configurable: false,
        writable: false,
        // 该对象不可修改
        value: Object.freeze(this.getContext()),
      },
      // 默认的Vue CLI工程配置
      defaultOptions: {
        enumerable: true,
        configurable: false,
        writable: false,
        // 该对象不可修改
        value: Object.freeze(defaults()),
      },
    })
    // 一些初始化绑定工作
    this._init()
  }

  // 获取默认的构建上下文
  getDefaultContext() {
    return this.defaultContext
  }

  /**
   * 加载进程环境变量
   * @returns {{args: *, data: *, env: *, timestamp: number}}
   */
  getContext() {
    const { rawArgv, args, command } = getVueCLIArgs()
    const { env, data } = parseVueAppEnv()
    const { name, version } = pkg
    const npm = process.env.npm_config_user_agent || ''
    // 返回上下文对象
    return {
      // 已进行数据类型转换处理的参数对象
      args,
      // 原始的进程运行参数数组
      rawArgv,
      // 当前执行的构建命令
      command,
      // 已进行数据类型处理的进程环境变量对象
      env,
      // 已进行数据类型处理的应用代码注入数据
      data,
      // 全局存储的数据
      global: this.global,
      // 当前工程构建所在的目录
      cwd: this.api.getCwd(),
      // 本构建插件的信息
      plugin: { name, version },
      // 当前的构建模式
      mode: process.env.NODE_ENV,
      // 构建器初始化时的时间戳
      timestamp: +process.env[ENV_TIMESTAMP],
      // 当前运行环境的node版本号
      node: process.version.replace(/^[\D]+/, ''),
      // 当前运行环境的npm版本号
      npm: /\bnpm\/([^\s]+)/.test(npm) ? RegExp.$1 : npm,
    }
  }

  resolve(...args) {
    return this.api.resolve(...args)
  }

  chainWebpack(...args) {
    return this.api.chainWebpack(...args)
  }

  configureWebpack(...args) {
    return this.api.configureWebpack(...args)
  }

  configureDevServer(...args) {
    return this.api.configureDevServer(...args)
  }

  resolveWebpackConfig(...args) {
    return this.api.resolveWebpackConfig(...args)
  }

  resolveChainableWebpackConfig(...args) {
    return this.api.resolveChainableWebpackConfig(...args)
  }

  // 装载命令模块
  // 因为需要确定命令的默认构建模式，这里需要在注册服务前进行装载
  static _loadCommands(modes) {
    const modulesPath = path.join(__dirname, './commands')
    const files = fs.readdirSync(modulesPath)
    for (const fi of files) {
      const { defaultMode } = require(path.join(modulesPath, fi))
      // defaultMode指定命令的默认构建模式
      if (defaultMode) {
        modes[path.basename(fi, '.js')] = defaultMode
      }
    }
  }

  /*!
   * 注册Vue插件命令。所有定义于commands目录下的模块都将作为命令进行注册。
   * 插件格式：
   * class CommandModule {
   *   static defaultMode = 'production'; // 指定默认的构建模式(static属性在12版本node才支持，注意兼容处理)
   *   constructor(api, options){ } // 构造函数接受参数为Builder实例对象与工程配置
   *   name: string; // name属性指定命令的名称（默认为模块文件（或目录）名称）
   *   getCLIOptions(): {description:string;usage:string;options:object}; // 用于返回命令行提示信息
   *   run(args, rawArgv): Promise|null // 运行命令的方法
   * }
   */
  _registerCommands() {
    const { api, options } = this
    const modulesPath = path.join(__dirname, './commands')
    const files = fs.readdirSync(modulesPath)
    const noop = () => {}
    // commands目录下的所有模块都会进行注册
    for (const fi of files) {
      const CommandModule = require(path.join(modulesPath, fi))
      // 命令模块必须为一个class
      const cmd = new CommandModule(this, options)
      // 默认名称为文件或模块目录名
      const args = [
        CommandModule.name ||
          cmd.name ||
          path.basename(fi, '.js').toLowerCase(),
      ]
      // 获取命令行帮助提示
      const opts = (cmd.getCLIOptions || noop)()
      if (typeof opts === 'object') {
        args.push(opts)
      }
      // run方法为执行命令的方法
      args.push(cmd.run.bind(cmd))
      // 注册插件命令至Vue CLI
      api.registerCommand(...args)
    }
  }

  // 注册构建插件
  // 这里的插件包括webpack、babel、express等的插件
  _registerPlugins() {}

  // 注册构建服务
  // 构建服务会调用插件来提供一个完整的构建能力
  _registerServices() {}

  // 初始化绑定
  _init() {
    this.chainWebpack((conf) => {
      // 全局编译器事件监听插件
      conf
        .plugin(PLUGIN_COMPILER_EVENT)
        .use(require.resolve('./plugins/webpack/CompilerEvent'), [
          {
            name: PLUGIN_COMPILER_EVENT,
            context: this,
            events: {
              done: async (stats) => {
                const code = stats.hasErrors() ? 1 : 0
                const hasIPCChannel = typeof process.send === 'function'
                this.emit(EVENT_COMPILE, code)
                if (hasIPCChannel) {
                  process.send({
                    type: EVENT_COMPILE,
                    data: code,
                  })
                }
              },
            },
          },
        ])
    })
  }

  // 打印信息
  _echo() {}
}

module.exports = Builder
