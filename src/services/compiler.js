const Service = require('../service')
const { EVENT_COMPILE_DONE, PLUGIN_COMPILER_EVENT } = require('../constants')

/**
 * 编译器相关的服务
 * 用于全局编译器事件监听和派发
 */
module.exports = class CompilerService extends Service {
  init(context) {
    this.context = context
    return true
  }

  // 配置webpack
  chainWebpack(conf) {
    conf
      .plugin(PLUGIN_COMPILER_EVENT)
      .use(require.resolve('../plugins/webpack/CompilerEvent'), [
        {
          name: PLUGIN_COMPILER_EVENT,
          context: this,
          events: {
            done: this.done,
          },
        },
      ])
  }

  // 编译完成事件
  async done(stats) {
    const code = stats.hasErrors() ? 1 : 0
    this.context.emitter.emit(EVENT_COMPILE_DONE, code)
    // 如果存在IPC通道，则向父进程发送编译完成消息
    if (typeof process.send === 'function') {
      process.send({
        type: EVENT_COMPILE_DONE,
        data: code,
      })
    }
  }

  // 与父进程进行消息通信
  onMessageEvent({ type, data }) {}
}
