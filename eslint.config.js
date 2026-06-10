import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // The following are experimental React Compiler advisory rules (eslint-plugin-react-hooks v7).
      // They flag patterns that are not eligible for React Compiler optimization rather than actual
      // bugs, and the app does not use the React Compiler. They are kept as warnings (not errors) so
      // they remain visible without failing the lint. Revisit if/when adopting the React Compiler.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      // Dev-only Fast Refresh hint (does not affect production builds).
      'react-refresh/only-export-components': 'warn',
    },
  },
])
