import generate from '@babel/generator'
import babelTraverse from '@babel/traverse'
import * as t from '@babel/types'
import * as babelParser from '@babel/parser'
import { parseComponent } from 'vue-template-compiler'
import { NodePath } from 'babel-traverse'
import { initComponents, initComputed, initData, initProps, initWatch } from './collect-state'
import { parseName, visitTopLevelDecalration, preprocessObjectMethod } from './utils'

import {
  genClassMethods,
  genImports,
  genComponentDecorator,
  genProps,
  genComputeds,
  genDatas,
  genWatches,
  handleCycleMethods,
  handleGeneralMethods,
} from './tsvue-ast-helpers'

import output from './output'
import { DictOf, OrNull } from './type'

export type CollectStateDatas = {
  [key: string]: NodePath[]
}

type CollectPropObjectMethod = NodePath<t.ObjectMethod | t.FunctionExpression>

export type CollectProps = {
  [key: string]: DictOf<{
    type: string
    value: any
    validator?: OrNull<CollectPropObjectMethod>
    default?: OrNull<CollectPropObjectMethod>
    defaultValue?: OrNull<t.Literal>
    required?: OrNull<t.BooleanLiteral>
  }>
}

export type CollectComputeds = {
  [key: string]: t.ObjectMethod | t.ObjectProperty | t.Expression
}

export type CollectVuexMap = {
  [key: string]: t.ObjectMethod | t.ObjectProperty | t.Expression
}

export type CollectExtraOption = t.ObjectMethod | t.ObjectProperty

export enum WatchOptionType {
  Get,
  Option,
}

export type CollectWatches = {
  [key: string]: {
    node: t.ObjectMethod | t.ObjectProperty | t.ObjectExpression
    options: {
      deep?: boolean
      immediate?: boolean
    }
  }
}

export type CollectState = {
  name: string | void
  data: CollectStateDatas
  dataStatements: t.Statement[]
  props: CollectProps
  computeds: CollectComputeds
  computedStates: CollectVuexMap
  computedGetters: CollectVuexMap
  watches: CollectWatches
  components: any
  componentOptions: DictOf<CollectExtraOption>
}

const LIFECYCLE_HOOKS = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated',
  'errorCaptured',
  'ssrPrefetch',
]

const VUE_ROUTER_HOOKS = ['beforeRouteEnter', 'beforeRouteLeave', 'beforeRouteUpdate']

const VUE_ECO_HOOKS = LIFECYCLE_HOOKS.concat(VUE_ROUTER_HOOKS)

const HANDLED_OPTION_KEYS = ['name', 'components', 'props', 'data', 'computed', 'watch']

function formatContent(source, isSFC) {
  if (isSFC) {
    const res = parseComponent(source, { pad: 'line' })
    return {
      template: res.template.content,
      js: res.script.content.replace(/\/\/\n/g, ''),
    }
  } else {
    return {
      template: null,
      js: source,
    }
  }
}

export default function transform(source, isSFC) {
  const state: CollectState = {
    name: undefined,
    data: {},
    dataStatements: [],
    props: {},
    computeds: {},
    computedStates: {},
    computedGetters: {},
    watches: {},
    components: {},
    componentOptions: {},
  }

  const collect = {
    imports: [],
    classMethods: {},
  }

  const component = formatContent(source.toString(), isSFC)

  const vast = babelParser.parse(component.js, {
    sourceType: 'module',
    plugins: isSFC ? [] : ['jsx'],
  })

  preprocessObjectMethod(vast)

  initProps(vast, state)
  initData(vast, state)
  initComputed(vast, state)
  initWatch(vast, state)
  initComponents(vast, state) // SFC

  visitTopLevelDecalration(vast, (path, dec) => {
    dec.properties.forEach(propNode => {
      if (t.isSpreadElement(propNode)) {
        return
      }
      const key = propNode.key.name
      if (key === 'methods') {
        if (t.isObjectProperty(propNode)) {
          if (t.isObjectExpression(propNode.value)) {
            propNode.value.properties.forEach(methodNode => {
              if (!t.isSpreadElement(methodNode)) {
                const name = methodNode.key.name
                handleGeneralMethods(methodNode, collect, state, name)
              }
            })
          }
        }
      } else if (VUE_ECO_HOOKS.includes(key)) {
        handleCycleMethods(propNode, collect, state, key, isSFC)
      } else if (HANDLED_OPTION_KEYS.includes(key)) {
        // will collect in somewhere else
      } else {
        state.componentOptions[key] = propNode
      }
    })
    path.stop()
  })

  babelTraverse(vast, {
    ImportDeclaration(path: NodePath) {
      collect.imports.push(path.node)
    },
  })

  // AST for react component
  const scriptTpl = `export default class ${parseName(state.name)} extends Vue {}`
  const scriptAst = babelParser.parse(scriptTpl, {
    sourceType: 'module',
    plugins: isSFC ? [] : ['jsx'],
  })

  babelTraverse(scriptAst, {
    Program(path) {
      genImports(path, collect, state)
    },

    ClassDeclaration(path) {
      genComponentDecorator(path, state)
    },

    ClassBody(path) {
      genProps(path, state)
      genDatas(path, state)
      genComputeds(path, state)
      genWatches(path, state)
      genClassMethods(path, collect)
    },
  })

  const r = generate(scriptAst, {
    quotes: 'single',
    retainLines: false,
  })
  const scriptCode = r.code

  const code = output({
    scriptCode,
    isSFC,
    templateCode: component.template,
  })
  return code
}
