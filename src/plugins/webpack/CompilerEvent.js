const { PLUGIN_NAME_DEFAULT } = require('../../constants')
/*!
 * webpack编译器事件绑定插件。
 * 可以一次注册多个监听事件。
 * 异步回调函数可以自由使用回调函数式，或者promise式。
 */
module.exports = class CompilerEvent {
  // 每个钩子都可以注册一个或多个回调函数。它们如何执行取决于钩子类型：

  // 基本钩子（名称中没有“ Waterfall”，“ Bail”或“ Loop”）。这个钩子简单地连续调用每个已注册的回调函数。
  //
  // 瀑布式（Waterfall）。瀑布式钩子同样连续地调用每个已注册的回调函数。
  // 与基本钩子不同，它将每个回调函数的返回值传递给下一个回调函数。
  //
  // 保险式（Bail）。保险式钩可以提前退出。
  // 当任何已注册的函数有返回值时，钩子将停止执行剩余的回调函数。
  //
  // 循环式（Loop）。当处在循环钩子中的插件返回一个非undefined的值时，钩子将从第一个插件开始重新执行。
  // 它将一直循环直到所有插件返回undefined。
  //
  // 此外，钩子可以是同步或异步的。为了反映这一点，提供了“ Sync”，“ AsyncSeries”和“ AsyncParallel”钩子类：
  //
  // 同步（Sync）。只能通过同步函数（使用myHook.tap（））来监听同步钩子。
  //
  // 异步串行（AsyncSeries）。可以使用同步的，基于回调的和基于Promise的回调函数
  // （使用myHook.tap（），myHook.tapAsync（）和myHook.tapPromise（））进行监听。
  // 异步串行钩子连续地调用每个异步回调方法。
  //
  // （异步并行）AsyncParallel。异步并行钩子也可以使用同步的，基于回调的和基于Promise的回调函数
  // （使用myHook.tap（），myHook.tapAsync（）和myHook.tapPromise（））进行监听。
  // 但是，它并行地运行每个异步方法。
  //
  // 钩子类型反映在其类名称中。例如，AsyncSeriesWaterfallHook允许异步串行依次运行它，
  // 并将每个回调函数的返回值传递给下一个回调函数。

  // 事件类型
  static hooksMap = {
    entryOption: 'tap', // SyncBailHook。在 webpack 选项中的 entry 被处理过之后调用。 回调参数：context, entry
    afterPlugins: 'tap', // SyncHook。在初始化内部插件集合完成设置之后调用。回调参数：compiler
    afterResolvers: 'tap', // SyncHook。resolver 设置完成之后触发。回调参数：compiler
    environment: 'tap', // SyncHook。在初始化配置文件中的插件之后立即调用，在 compiler environment 准备时调用。
    afterEnvironment: 'tap', // SyncHook。在 environment 钩子之后立即调用，在 compiler environment 完成设置时调用。
    beforeRun: 'tapAsync', // AsyncSeriesHook。在 compiler.run 执行之前调用。回调参数：compiler
    additionalPass: 'tapAsync', // AsyncSeriesHook。允许为是否通过此次构建添加判断条件。
    run: 'tapAsync', // AsyncSeriesHook。在开始读取 records 之前调用。回调参数：compiler
    watchRun: 'tapAsync', // AsyncSeriesHook。在监听模式下，一个新的 compilation 触发之后，但在 compilation 实际开始之前执行。回调参数：compiler
    normalModuleFactory: 'tap', // SyncHook。 NormalModuleFactory 创建之后调用。回调参数：normalModuleFactory
    contextModuleFactory: 'tap', // SyncHook。ContextModuleFactory 创建之后调用。回调参数：contextModuleFactory
    initialize: 'tap', // SyncHook。在初始化 compiler 对象时调用。
    beforeCompile: 'tapAsync', // AsyncSeriesHook。在创建 compilation parameter 之后执行。回调参数：compilationParams
    compile: 'tap', // SyncHook。beforeCompile 之后立即调用，但在一个新的 compilation 创建之前。回调参数：compilationParams
    thisCompilation: 'tap', // SyncHook。初始化 compilation 时调用，在触发 compilation 事件之前调用。回调参数：compilation, compilationParams
    compilation: 'tap', // SyncHook。compilation 创建之后执行。回调参数：compilation, compilationParams
    make: 'tapAsync', // AsyncParallelHook。compilation 结束之前执行。回调参数：compilation
    afterCompile: 'tapAsync', // AsyncSeriesHook。compilation 结束和封印之后执行。回调参数：compilation
    shouldEmit: 'tap', // SyncBailHook。在输出 asset 之前调用。返回一个布尔值，告知是否输出。回调参数：compilation
    emit: 'tapAsync', // AsyncSeriesHook。输出 asset 到 output 目录之前执行。回调参数：compilation
    afterEmit: 'tapAsync', // AsyncSeriesHook。输出 asset 到 output 目录之后执行。回调参数：compilation
    assetEmitted: 'tapAsync', // AsyncSeriesHook。在 asset 被输出时执行。此钩子可以访问被输出的 asset 的相关信息，例如它的输出路径和字节内容。回调参数：file, info
    done: 'tapAsync', // AsyncSeriesHook。在 compilation 完成时执行。回调参数：stats
    failed: 'tap', // SyncHook。在 compilation 失败时调用。回调参数：error
    invalid: 'tap', // SyncHook。在一个观察中的 compilation 无效时执行。回调参数：fileName, changeTime
    watchClose: 'tap', // SyncHook。在一个观察中的 compilation 停止时执行。
    infrastructureLog: 'tap', // SyncBailHook。在配置中启用 infrastructureLogging 选项 后，允许使用 infrastructure log(基础日志)。回调参数：name, type, args
    log: 'tap', // SyncBailHook。启用后允许记录到 stats 对象，请参阅 stats.logging, stats.loggingDebug 和 stats.loggingTrace 选项。回调参数：origin, logEntry
  }

  // 编译器事件注册
  constructor({ name, events, context }) {
    this.events = Object.assign({}, events)
    this.pluginName = name || PLUGIN_NAME_DEFAULT
    this.context = context
  }

  // 注册事件监听函数到compiler hook
  listen(compiler, event, handler) {
    const { pluginName, context } = this
    const hookType = CompilerEvent.hooksMap[event]
    compiler.hooks[event][hookType](pluginName, (...args) => {
      if (hookType !== 'tapAsync') {
        let cbRes
        return handler.call(context, ...args, (res) => (cbRes = res)) || cbRes
      }

      let fakeDone = null
      const done = args.pop()
      Promise.race([
        new Promise((resolve, reject) => {
          fakeDone = (err, res) => {
            if (err) {
              reject(err)
            } else {
              resolve(res)
            }
          }
        }),
        handler.call(context, ...args, fakeDone),
      ])
        .then((res) => {
          done(null, res)
        })
        .catch(done)
    })
  }

  // 应用插件
  apply(compiler) {
    for (const [event, handler] of Object.entries(this.events)) {
      const camelName = event.replace(/-([a-zA-Z])/g, (t, s) => s.toUpperCase())
      const hookType = CompilerEvent.hooksMap[camelName]
      if (!hookType) {
        continue
      }
      for (const listener of Array.isArray(handler) ? handler : [handler]) {
        if (typeof listener === 'function') {
          this.listen(compiler, camelName, handler)
        }
      }
    }
    this.events = null
  }
}
