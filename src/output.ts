import * as fs from 'fs'
import * as format from 'prettier-eslint'

export function formatScriptCode(code) {
  const opts = {
    text: code,
    eslintConfig: {
      parserOptions: {
        ecmaVersion: 7,
        sourceType: 'module',
        allowImportExportEverywhere: false,
        ecmaFeatures: {
          jsx: true,
          modules: true,
        },
      },
      env: {
        es6: true,
        node: true,
        browser: true,
      },
      rules: {
        indent: [2, 2, { SwitchCase: 1 }],
        quotes: [2, 'single', { allowTemplateLiterals: true }],
        semi: [2, 'always'],
        eqeqeq: [2, 'always'],
        strict: [2, 'global'],
        'object-property-newline': [2, { allowAllPropertiesOnSameLine: false }],
        'linebreak-style': [2, 'unix'],
        'object-curly-newline': [
          2,
          {
            ObjectExpression: 'always',
            ObjectPattern: 'always',
          },
        ],
        'no-multiple-empty-lines': [2, { max: 0 }],
        'key-spacing': [2, { afterColon: true }],
        'block-spacing': [2, 'always'],
        'space-before-function-paren': [2, 'always'],
        'padding-line-between-statements': [2, { blankLine: 'always', prev: 'import', next: 'export' }],
        'lines-around-comment': [2, { beforeLineComment: true }],
        'no-console': 0,
        'no-empty': 0,
        'no-unused-vars': 0,
        'no-constant-condition': 0,
        'no-trailing-spaces': 0,
      },
    },
  }

  return format(opts)
}

function output(opts: { scriptCode: string; templateCode: string; isSFC: boolean; dist: string }) {
  const { scriptCode, templateCode, isSFC, dist } = opts
  const formattedCode = formatScriptCode(scriptCode)

  let code: string
  if (isSFC) {
    code = ['<template>', templateCode, '</template>', '', '<script lang="ts">', formattedCode, '</script>'].join('\n')
  } else {
    code = formattedCode
  }
  fs.writeFileSync(dist, code)
}

export default output
