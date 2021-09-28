module.exports = ({ env }) => ({
  plugins: [
    require('postcss-import'),
    require('tailwindcss'),
    require('postcss-nested'),
    env === 'production' ? require('cssnano')({ preset: 'default' }) : false,
  ],
});
