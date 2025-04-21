import commonjs from 'rollup-plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import cleanup from 'rollup-plugin-cleanup';
import strip from 'rollup-plugin-strip';

const pkg = require('./package.json');

export default {
  input: 'src/index.js',
  output: [
    { file : pkg['main'],format: 'cjs',exports : 'named' },
    { file : pkg['module'] ,format: 'es'}
  ],
  external: ['fs', 'path'],
  
  plugins: [
    commonjs(),
    nodeResolve(),
    cleanup(),
    strip(['console.log', 'console.info']),
    terser()
  ]
}