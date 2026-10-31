import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'outputs/**', '.feed-the-seek/**', 'public/client.js'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'scripts/**/*.{js,mjs,cjs}', 'public/app.js'],
    languageOptions: { parser: tseslint.parser },
    rules: {
      curly: ['error', 'all'],
      'one-var': ['error', 'never'],
      'no-nested-ternary': 'error',
      'no-sequences': 'error',
      'no-multi-assign': 'error',
      'no-unused-expressions': 'error',
      'max-statements-per-line': ['error', { max: 1 }],
    },
  },
  {
    files: ['src/**/prompts/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TemplateLiteral:not(TaggedTemplateExpression[tag.name="dedent"] > TemplateLiteral)',
          message: '提示词模板统一使用 ts-dedent 的 dedent 标签。',
        },
      ],
    },
  },
]
