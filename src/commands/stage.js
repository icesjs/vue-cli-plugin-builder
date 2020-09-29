/*!
 * 插件命令，用于预览发布的资源。
 */
class Stage {
  // 命令名称
  static name = 'stage'
  // 默认的构建模式
  static defaultMode = 'build'

  constructor(api, options) {
    this.api = api
    this.options = options
  }

  getCLIOptions() {
    return {
      description: 'Writes a greeting to the console',
      usage: 'vue-cli-service stage [options]',
      options: { '--name': 'specifies a name for greeting' },
    }
  }

  run(args, rawArgv) {}
}

module.exports = Stage
