// Tento soubor je zachován pro referenci.
// Aktivní build probíhá přes esbuild — viz package.json scripts.
// Spuštění: npm run build  (alias: npx esbuild ...)
//
// Pokud chceš přejít zpět na Rollup, odkomentuj níže a uprav package.json.

/*
import typescript from '@rollup/plugin-typescript';
import resolve   from '@rollup/plugin-node-resolve';
import commonjs  from '@rollup/plugin-commonjs';
import terser    from '@rollup/plugin-terser';

const isProd = process.env.NODE_ENV === 'production';

export default {
  input: 'src/room-overlay-card.ts',
  output: { file: 'dist/room-overlay-card.js', format: 'es', sourcemap: !isProd },
  plugins: [resolve(), commonjs(), typescript({ tsconfig: './tsconfig.json' }), isProd && terser()].filter(Boolean),
  onwarn(warning, warn) { if (warning.code === 'CIRCULAR_DEPENDENCY') return; warn(warning); },
};
*/
