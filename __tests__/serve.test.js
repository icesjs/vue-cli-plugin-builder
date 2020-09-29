/*!
 * 使用runTest运行测试：
 * runTest(projectDirectory, npmScriptName)
 * 第一个参数为__mocks__下面模拟的工程目录名称
 * 第二个参数为要运行的定义在模拟工程package.json中的scripts里面的脚本名
 * 第三参数为需要传递给命令的参数
 * 如：runTest('vue2-project-cli3', 'serve', { port: 8888 })
 */
const { runTest } = require('../__mocks__/script')

// 设定30分钟超时时间，可能需要使用该环境进行代码开发测试
jest.setTimeout(30 * 60000)

// eslint-disable-next-line jest/no-focused-tests
// test.only('test serve for vue3-project-cli4 only', async () => {
//   await runTest('vue3-project-cli4', 'serve')
// })

// test.only为仅运行这一个测试用例，而忽略所有其他的测试用例
// 开发时为节省测试时间，可以只运行这一个测试用例，但不要提交此改动

test('test serve for vue2-project-cli3', async () => {
  await runTest('vue2-project-cli3', 'serve', { port: 8888 })
})

test('test serve for vue3-project-cli4', async () => {
  await runTest('vue3-project-cli4', 'serve')
})
