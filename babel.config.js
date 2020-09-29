module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: 'node 8.3.0', // 最低支持node8.3以上环境
        modules: 'cjs', // 转换为cjs模块
        useBuiltIns: 'usage', // 根据target按需引入polyfill
        corejs: {
          version: 3, // env插件会从全局引入polyfill
          proposals: true,
        },
        shippedProposals: true, // 支持未正式发布的标准特性
      },
    ],
  ],
  plugins: [
    [
      '@babel/plugin-transform-runtime',
      {
        helpers: true, // 进行helpers抽取
        corejs: false, // 不需要引入polyfill，已由env插件处理
        regenerator: false, // 不需要处理生成器函数
      },
    ],
  ],
}
