/** Keep publication typography and optional floating motion local to the bundle. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    fontFamily: { display: ['Georgia', 'serif'], sans: ['Arial', 'sans-serif'] },
    keyframes: { float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } },
    animation: { float: 'float 6s ease-in-out infinite' },
  } },
  plugins: [],
};
