'use strict'

const fs = require('fs')
const path = require('path')
const readPkg = require('read-pkg')
const { EventEmitter } = require('events')
const ServiceBase = require('./service')
const { ENV_TIMESTAMP } = require('./constants')
const { getVueCLIArgs, parseVueAppEnv } = require('@ices/shared-utils-node')
const defaults = require('./options')

/*!
 * 构建器基于Vue CLI的插件API，定义了一个统一的接口，用于将一系列构建插件和命令与Vue Cli进行集成。
 * 较Vue CLI的插件API，为插件或命令提供更多的构建辅助参数或工具。
 * 另外，由于构建器是一个单实例，并继承事件派发，也可为接入的插件和命令提供一个统一的的全局通信环境。
 */
class Builder {
  constructor({ api, options }) {
    // 一些插件需要根据当前时间生成资源名称，如果取值时间点有变化，可能会造成单次构建中生成的资源名称前后不一致
    // 此时间戳用于确定当前构建时间点
    process.env[ENV_TIMESTAMP] = `${Date.now()}`

    // 一些属性
    this.api = api // Vue CLI 插件API实例
    this.options = options // 工程的Vue构建配置
    this.global = {} // 提供全局环境的数据存取
    this.services = {} // 已加载的服务
    this.emitter = new EventEmitter() // 提供全局环境的事件监听与派发
    this.defaultContext = this.getContext() // 上下文对象，可获取构建初始时的一些参数数据
    this.defaultOptions = Object.freeze(defaults(this.defaultContext)) // 默认的工程配置

    // 取消绑定监听器数量限制
    this.emitter.setMaxListeners(0)
  }

  getContext() {
    const { rawArgv, args, command } = getVueCLIArgs()
    const { env, data } = parseVueAppEnv()
    const pluginPkg = readPkg.sync({ cwd: path.join(__dirname, '..') })
    const cwd = this.api.getCwd()
    const npm = process.env.npm_config_user_agent || ''
    // 返回上下文对象
    return {
      cwd, // 当前工程构建所在的目录
      args, // 已进行数据类型转换处理的参数对象
      rawArgv, // 原始的进程运行参数数组
      command, // 当前执行的构建命令
      env, // 已进行数据类型处理的进程环境变量对象
      data, // 已进行数据类型处理的应用代码注入数据
      api: this.api, // Vue CLI的PluginAPI实例
      global: this.global, // 全局存储的数据
      emitter: this.emitter, // 全局事件收发器
      mode: process.env.NODE_ENV, // 当前的构建模式
      options: this.options, // 工程配置对象
      defaultOptions: this.defaultOptions, // 默认的工程配置对象
      packageJson: readPkg.sync({ cwd }), // 工程pkg对象
      timestamp: +process.env[ENV_TIMESTAMP], // 构建器初始化时的时间戳
      pluginPackageJson: pluginPkg, // 当前插件的pkg对象
      plugin: { name: pluginPkg.name, version: pluginPkg.version }, // 本构建插件的信息
      engines: {
        node: process.version.replace(/^[\D]+/, ''), // 当前运行环境的node版本号
        npm: /\bnpm\/([^\s]+)/.test(npm) ? RegExp.$1 : npm, // 当前运行环境的npm版本号
      },
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
  registerCommands() {
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
  registerPlugins() {}

  // 注册构建服务
  // 构建服务会调用插件来提供一个完整的构建能力
  registerServices() {
    const servesPath = path.join(__dirname, './services')
    const files = fs.readdirSync(servesPath)
    for (const fi of files) {
      const Service = require(path.join(servesPath, fi))
      if (Object.getPrototypeOf(Service) !== ServiceBase) {
        // 必须继承ServiceBase基类
        console.error('必须继承基类ServiceBase')
        continue
      }
      try {
        // 实例化服务
        const serv = new Service({ ...this.defaultContext })
        if (serv.initialized) {
          this.services[path.basename(fi, '.js')] = serv
        }
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
      // defaultMode指定命令的默认构建模式
      if (defaultMode) {
        modes[path.basename(fi, '.js')] = defaultMode
      }
    }
  }
}

module.exports = Builder
