const { EventEmitter } = require('events')

/**
 * 服务基类
 */
class ServiceBase extends EventEmitter {
  //
  constructor({ api, ...context }) {
    super()
    if (new.target === ServiceBase) {
      throw new Error('不能直接使用该基类来注册服务')
    }

    // initialized 属性用于标记当前是否已经成功初始化
    // 只有拥有该属性且未true时，才会登记该服务
    let initialized = false

    // 定义内部属性方法
    Object.defineProperties(this, {
      initialized: {
        configurable: false,
        enumerable: true,
        get() {
          return initialized
        },
      },
      resolve: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (...args) => api.resolve(...args),
      },
      resolveWebpackConfig: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (...args) => api.resolveWebpackConfig(...args),
      },
      resolveChainableWebpackConfig: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: (...args) => api.resolveChainableWebpackConfig(...args),
      },
    })

    // 子类服务必须实现init方法来进行初始化
    // 执行服务初始化必须返回布尔值true表示初始化成功
    try {
      if (this.init(context) !== true) {
        // 如果init没有返回布尔值true，则表示初始化未成功
        // 这里未成功可表明服务不满足执行条件，或者有异常情况发生等
        // 只有初始化成功的服务才会进行配置操作
        return
      }
    } catch (e) {
      return
    }

    // 标记初始化成功
    initialized = true
    // 对初始化成功的服务，调用配置方法进行构建配置
    // 子类可实现这些方法，对配置进行更新
    api.chainWebpack((...args) => this.chainWebpack(...args))
    api.configureWebpack((...args) => this.configureWebpack(...args))
    api.configureDevServer((...args) => this.configureDevServer(...args))
  }

  init() {
    return false
  }

  chainWebpack() {
    return this
  }

  configureWebpack() {
    return {}
  }

  configureDevServer() {
    return this
  }
}

module.exports = ServiceBase
