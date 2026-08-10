export default [
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-implicit-globals': 'error',
      'no-shadow': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // Отбрасывание полей через деструктуризацию — намеренный приём.
        ignoreRestSiblings: true
      }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Используй showToast() из src/ui/feedback.js.' },
        { name: 'confirm', message: 'Используй askConfirm() из src/ui/feedback.js.' }
      ]
    }
  },
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script' },
    rules: { 'no-var': 'error', eqeqeq: ['error', 'always'] }
  }
];
