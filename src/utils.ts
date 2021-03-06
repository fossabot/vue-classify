import * as t from '@babel/types'
import chalk from 'chalk'
import babelTraverse from '@babel/traverse'
import { NodePath } from 'babel-traverse'

export function parseName(name: string | void) {
  name = name || 'my-vue-compoennt'
  const segs = name.split('-')
  let str = ''
  if (segs.length > 1) {
    segs.forEach(v => {
      v = v[0].toUpperCase() + v.substr(1).toLowerCase()
      str += v
    })
  } else {
    str = name
  }
  return str
}

export function parseComponentName(str) {
  if (str) {
    const a = str.split('-').map(e => e[0].toUpperCase() + e.substr(1))
    return a.join('')
  }
}

export function log(msg, type = 'error') {
  if (type === 'error') {
    return console.log(chalk.red(`[vue-classify]: ${msg}`))
  }
  console.log(chalk.green(msg))
}

export function convertToObjectMethod(key: string, node: t.ObjectProperty | t.ObjectMethod) {
  if (t.isObjectMethod(node)) {
    return node
  }
  const propValue = node.value
  let methodBody
  let params = []
  if (t.isArrowFunctionExpression(propValue) || t.isFunctionExpression(propValue)) {
    methodBody = propValue.body
    params = propValue.params
  }
  if (methodBody) {
    const id = t.identifier(key)
    return t.objectMethod('method', id, params, methodBody)
  }
}

export function visitTopLevelDecalration(
  ast: t.File,
  cb: (path: NodePath<t.ExportDeclaration>, dec: t.ObjectExpression) => any
) {
  babelTraverse(ast, {
    ExportDefaultDeclaration(path) {
      const dec = path.node.declaration
      if (t.isObjectExpression(dec)) {
        cb(path, dec)
      }
    },
  })
}

/**
 * Convert fuction expression to object method, make succeeding process easier
 */
export function preprocessObjectMethod(ast: t.File) {
  babelTraverse(ast, {
    ObjectProperty(path: NodePath<t.ObjectProperty>) {
      const { node } = path
      const nodeValue = node.value
      let methodNode: t.ObjectMethod
      if (t.isArrowFunctionExpression(nodeValue)) {
        if (t.isExpression(nodeValue.body)) {
          const statement = t.returnStatement(nodeValue.body)
          methodNode = t.objectMethod('method', node.key, [], t.blockStatement([statement]))
        }
      }
      if (t.isFunctionExpression(nodeValue)) {
        methodNode = t.objectMethod('method', node.key, nodeValue.params, nodeValue.body)
      }
      if (methodNode) {
        path.replaceWith(methodNode as any)
      }
    },
  })
}
