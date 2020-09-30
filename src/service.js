const { EventEmitter } = require('events')

/*!
 * 服务基类，用于规范化构建服务初始化流程
 */
class ServiceBase extends EventEmitter {
  //
  constructor(context) {
    super()
    // initialized 属性用于标记当前是否已经成功初始化
    // 只有拥有该属性且未true时，才会登记该服务
    let initialized = false

    // 定义initialized属性
    // 该属性的值通过属性访问器获取，并且不能再配置
    Object.defineProperties(this, {
      initialized: {
        configurable: false,
        enumerable: true,
        get() {
          return initialized
        },
      },
    })

    // 子类服务必须实现init方法来进行初始化
    // 执行服务初始化必须返回布尔值true表示初始化成功
    if (this.init(context) !== true) {
      // 如果init没有返回布尔值true，则表示初始化未成功
      // 这里未成功可表明服务不满足执行条件，或者有异常情况发生等
      // 只有初始化成功的服务才会进行配置操作
      return
    }

    // 标记初始化成功
    initialized = true
  }

  /**
   * <br>通过参数获取当前构建的上下文信息，并初始化构建服务，如果初始化完成则返回布尔值true。<br>
   * <br>此方法会在基类的构造方法中调用，并设置初始化是否完成的标记属性initialized。<br>
   * <br>构建器会依据实例对象的initialized属性来判断服务是否需要进行注册。<br>
   * <br>如果成功注册的服务，构建器会调用实例上的下面三个方法：<br>
   * <br>
   * - chainWebpack()
   * - configureWebpack()
   * - configureDevServer()
   * <br>
   * <br>如果提供构建服务的类需要更改webpack配置，添加上面三个方法即可。<br>
   *
   * @param context
   * @returns {boolean}
   */
  init(context) {
    this.context = context
    return false
  }

  /*!
   * 通过参数获取webpack-chain实例，并对webpack配置进行更细粒度的修改
   * 更多请参考：
   * https://cli.vuejs.org/zh/guide/webpack.html#%E9%93%BE%E5%BC%8F%E6%93%8D%E4%BD%9C-%E9%AB%98%E7%BA%A7
   * https://github.com/neutrinojs/webpack-chain
   */
  chainWebpack() {
    return this
  }

  /*!
   * 通过参数获取webpack配置对象，并直接更改webpack配置项
   * 注意，如果方法有返回值，则返回值会被合并进webpack配置中
   * 由于webpack会对配置进行字段校验，非官方定义的配置项会抛异常
   * 请确保修改配置项时，一定要是webpack官方定义的配置项
   * 更多请参考：
   * https://cli.vuejs.org/zh/guide/webpack.html#%E7%AE%80%E5%8D%95%E7%9A%84%E9%85%8D%E7%BD%AE%E6%96%B9%E5%BC%8F
   * https://webpack.js.org/concepts/
   */
  configureWebpack() {
    return {}
  }

  /*!
   * 通过参数获取express开发服务的实例对象app，并注册中间件或者监听开发服务器事件
   */
  configureDevServer() {
    return this
  }
}

module.exports = ServiceBase
