//
class CompilerEvent {
  // 编译器事件注册
  constructor({ name, events, context }) {
    this.events = Object.assign({}, events)
    this.pluginName = name || 'BuilderWebpackPlugin'
    this.context = context
  }

  listen(event, handler) {
    const { pluginName, compiler, context } = this
    if (typeof handler !== 'function') {
      return
    }
    const hooksMap = CompilerEvent.hooksMap
    const camelName = event.replace(/-([a-zA-Z])/g, (t, s) => s.toUpperCase())
    const hookType = hooksMap[camelName]
    if (hookType) {
      compiler.hooks[camelName][hookType]({ name: pluginName }, (...args) => {
        const async = hookType === 'tapAsync'
        if (async) {
          let done = null
          let resolver = null
          const promise = new Promise((resolve) => {
            resolver = resolve
          })
          if (typeof args[args.length - 1] === 'function') {
            done = args.pop()
          }
          const res = handler.apply(context, args.concat(resolver))
          Promise.race([res, promise])
            .then((res) => {
              if (done) {
                done(res)
                done = null
              }
              resolver = null
              return res
            })
            .catch((err) => {
              if (done) {
                done(err)
                done = null
              }
              resolver = null
              throw err
            })
        } else {
          handler.apply(
            context,
            args.concat(() => {})
          )
        }
      })
    }
  }

  // 应用插件
  apply(compiler) {
    const { events } = this
    this.compiler = compiler
    Object.keys(events).forEach((event) => {
      this.listen(event, events[event])
    })
  }
}

CompilerEvent.hooksMap = {
  shouldEmit: 'tap',
  done: 'tapAsync',
  needAdditionalPass: 'tapAsync',
  beforeRun: 'tapAsync',
  run: 'tapAsync',
  emit: 'tapAsync',
  afterEmit: 'tapAsync',
  thisCompilation: 'tap',
  compilation: 'tap',
  normalModuleFactory: 'tap',
  contextModuleFactory: 'tap',
  beforeCompile: 'tapAsync',
  compile: 'tap',
  make: 'tapAsync',
  afterCompile: 'tapAsync',
  watchRun: 'tapAsync',
  failed: 'tap',
  invalid: 'tap',
  watchClose: 'tap',
  environment: 'tap',
  afterEnvironment: 'tap',
  afterPlugins: 'tap',
  afterResolvers: 'tap',
  entryOption: 'tap',
}

module.exports = CompilerEvent
