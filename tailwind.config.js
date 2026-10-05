/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  // Tailwind v4 auto-detects content from @import "tailwindcss"
  // CSS variables handle color theming
  theme: {
    extend: {
      borderRadius: {
        xl: `calc(var(--radius) + 0.125rem)`,
        lg: "var(--radius)",
        md: "calc(var(--radius) - 0.05rem)",
        sm: "calc(var(--radius) - 0.25rem)",
      },
    },
  },
  plugins: [],
};
