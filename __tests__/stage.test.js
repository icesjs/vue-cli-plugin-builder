const { runTest } = require('../__mocks__/script')

jest.setTimeout(5 * 60000)

test('test stage help', async () => {
  await runTest('vue2-project-cli3', 'help', ['stage'])
})

test('test stage for vue2-project-cli3', async () => {
  await runTest('vue2-project-cli3', 'stage')
})

test('test stage for vue3-project-cli4', async () => {
  await runTest('vue3-project-cli4', 'stage')
})
