const colors = require('tailwindcss/colors');

module.exports = {
  mode: 'jit',
  purge: [
    '**/*.njk',
    '_posts/*.md',
  ],
  darkMode: 'media', // or 'media' or 'class'
  theme: {
    screens: {
      'xs': '360px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
    },
    extend: {
      colors: {
        gray: colors.coolGray,
      },
      padding: {
        container: 'var(--container-spacing)',
      },
      margin: {
        '-container': 'calc(var(--container-spacing) * -1)',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('tailwindcss-debug-screens'),
  ],
  corePlugins: {
    container: false,
  },
};
