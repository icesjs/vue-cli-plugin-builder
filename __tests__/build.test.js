/*!
 * 使用runTest运行测试：
 * runTest(projectDirectory, npmScriptName)
 * 第一个参数为__mocks__下面模拟的工程目录名称
 * 第二个参数为要运行的定义在模拟工程package.json中的scripts里面的脚本名
 * 如：runTest('vue2-project-cli3', 'build')
 */
const { runTest } = require('../__mocks__/script')

// 设定5分钟构建没完成就超时
jest.setTimeout(5 * 60000)

// eslint-disable-next-line jest/no-focused-tests
// test.only('test build for vue3-project-cli4 only', async () => {
//   await runTest('vue3-project-cli4', 'build')
// })

// test.only为仅运行这一个测试用例，而忽略所有其他的测试用例
// 开发时为节省测试时间，可以只运行这一个测试用例，但不要提交此改动

test('test build for vue2-project-cli3', async () => {
  await runTest('vue2-project-cli3', 'build')
})

test('test build for vue3-project-cli4', async () => {
  await runTest('vue3-project-cli4', 'build')
})
