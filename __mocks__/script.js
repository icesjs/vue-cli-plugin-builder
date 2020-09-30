const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const execa = require('execa')
const resolve = require('resolve')
const { promisify } = require('util')
const rimraf = promisify(require('rimraf'))
const { loadEnv, getProcessArgs } = require('@ices/shared-utils-node')
const { EVENT_COMPILE_DONE } = require('../src/constants')

// 为简化配置，所有子进程执行配置参数都通过这个变量来指定
// 一般只需要通过该变量变更cwd属性到需要执行测试的模拟工程目录即可
const execSetup = { windowsHide: true }

// 执行node脚本
// 这里的argv是参数数组格式，也可以不传
// 此模式通过fork模式初始子进程，并设置了IPC
// 传入listener监听函数，会将其绑到进程的消息事件句柄上
function execScript(file, argv, listener) {
  execSetup.localDir = execSetup.cwd
  const subProcess = execa.node(
    path.isAbsolute(file) ? file : path.join(execSetup.cwd, file),
    argv || [],
    execSetup
  )
  subProcess.stdout.pipe(process.stdout)
  subProcess.stderr.pipe(process.stderr)
  if (typeof listener === 'function') {
    subProcess.on('message', (message, handle) => {
      listener(message, subProcess, handle)
    })
  }
  return subProcess
}

// 执行vue命令
// 第二个参数args为参数对象，或者参数数组，或者不传
function execVueCommand(name, args, listener) {
  if (typeof args === 'function') {
    listener = args
    args = [name]
  } else if (Array.isArray(args)) {
    args.unshift(name)
  } else if (typeof args === 'object') {
    const tmp = [name]
    for (const [key, val] of Object.entries(args)) {
      tmp.push(`--${key}${val === undefined || val === '' ? '' : `=${val}`}`)
    }
    args = tmp
  } else {
    args = [name]
  }

  // 通过本测试执行辅助工具运行的vue命令，是在fork的进程里运行的
  // 在fork进程里运行的vue命令，会默认禁用打开浏览器的行为
  // 如果不是CI环境执行serve，且没有明确指定不打开浏览器时，这里通过参数明确设置需要打开浏览器
  if (!process.env.CI && name === 'serve' && !args.includes('--open=false')) {
    args.push('--open')
  }

  // 查找vue-cli-service执行入口
  let exePath
  try {
    resolve.sync('@vue/cli-service', {
      basedir: execSetup.cwd,
      packageFilter(pkg, file) {
        path.basename(file) === 'package.json' ? path.dirname(file) : file
        exePath = path.join(
          path.basename(file) === 'package.json' ? path.dirname(file) : file,
          typeof pkg.bin === 'string' ? pkg.bin : pkg.bin['vue-cli-service']
        )
        return pkg
      },
    })
  } catch (e) {}
  if (!exePath) {
    throw chalk.red('Can not find vue-cli-service')
  }

  return execScript(exePath, args, listener)
}

// 命令行执行器
// 这里的命令执行是通过spawn模式初始化的子进程
// 没有IPC通道的建立，所以不能与子进程进行消息通信
// 参数cmd为要执行的命令字符串，如：
// npm install
function execCommand(cmd) {
  execSetup.localDir = execSetup.cwd
  const subProcess = execa.command(cmd, execSetup)
  subProcess.stdout.pipe(process.stdout)
  subProcess.stderr.pipe(process.stderr)
  return subProcess
}

// 判断给定的目录是不是个工程目录
function isProject(dir) {
  const absPath = path.join(__dirname, dir)
  if (fs.statSync(absPath).isDirectory()) {
    if (fs.existsSync(path.join(absPath, 'package.json'))) {
      return true
    }
  }
  return false
}

// 清理文件
function clear(file) {
  const absPath = path.join(execSetup.cwd, file)
  if (!fs.existsSync(absPath)) {
    return
  }
  return rimraf(absPath)
}

// 执行依赖安装任务
async function install() {
  console.log(chalk.yellow('Executing clear'))
  await clear('node_modules')
  console.log(`${chalk.yellow('Deleted')} ${chalk.cyan('node_modules')}`)
  await clear('package-lock.json')
  console.log(`${chalk.yellow('Deleted')} ${chalk.cyan('package-lock.json')}`)
  console.log(
    `${chalk.green('Successfully cleared')}\n${chalk.yellow(
      'Executing install'
    )}`
  )
  return execCommand('npm install')
}

// 进行模拟工程的依赖安装任务
async function runInstall() {
  // 安装__mocks__目录下的所有工程目录
  for (const file of fs.readdirSync(__dirname)) {
    if (isProject(file)) {
      console.log(`${chalk.yellow('Install project in')} ${chalk.cyan(file)}`)
      execSetup.cwd = path.join(__dirname, file)
      await install()
      console.log(
        `${chalk.green('Successfully installed in')} ${chalk.cyan(file)}`
      )
    }
  }
  console.log(`\n${chalk.green('All done!')}\n`)
}

// 执行命令测试
// 如果是初次下载的项目，可以先运行安装任务进行模拟工程的依赖安装
// dir参数为模拟工程的目录名
// cmd参数为vue-cli-service的命令名称
// args参数要设置的参数项，比如：{port: 8888}
async function runTest(dir, cmd, args) {
  if (!isProject(dir)) {
    throw new Error(`The path is not an existed project. (${dir})`)
  }
  console.log(
    `${chalk.yellow('Running tests in')} ${chalk.cyan(dir)} ${chalk.yellow(
      'with'
    )} ${chalk.cyan(cmd)} command`
  )
  execSetup.cwd = path.join(__dirname, dir)
  // VUE_CLI_TEST 环境变量，可改变Vue Cli的部分执行逻辑，以适应测试需要
  process.env.VUE_CLI_TEST = process.env.CI ? 'test' : ''
  // 运行构建命令
  await execVueCommand(cmd, args, ({ type, data }, subProcess) => {
    if (process.env.CI && cmd !== 'build' && type === EVENT_COMPILE_DONE) {
      // 在CI环境下，运行非产品构建任务，由于构建层有监听服务提供，构建完成后不会结束进程
      // 这里通过监听子进程消息事件，来手动杀掉已经编译结束的测试进程
      if (!data) {
        // 传值为0，表示构建成功
        subProcess.cancel()
      }
    }
  }).catch((err) => {
    if (!err.isCanceled) {
      // 如果不是主动取消（杀掉）的进程，抛出异常
      throw err
    }
  })
}

;(async () => {
  // 如果CI环境变量已经设置值，则是由其他构建环境设定
  const CI = process.env.CI
  // 加载测试环境变量，这里使用的是覆盖模式
  const { error, parsed } = loadEnv(path.join(__dirname, '../.env.test'), true)
  if (error) {
    console.error(error)
    process.exit(1)
  }
  // 已经存在CI环境声明情况下，优先保证该环境变量的有效性
  if (CI || parsed.CI) {
    process.env.CI = CI || parsed.CI
    console.log(chalk.yellow('Running in CI environment'))
  }

  // 下面逻辑用于命令行调用时
  // 加载进程运行参数
  const {
    _: [type, dir, cmd],
    ...args
  } = getProcessArgs().args
  switch (type) {
    case 'install':
      // node script.js -- install
      await runInstall()
      break
    case 'test':
      // node script.js -- test vue2-project-cli3 serve --port=8888
      await runTest(dir, cmd, args)
      break
  }
})()

// runTest用于在测试框架内调用模拟工程的vue命令
module.exports = { runTest }
