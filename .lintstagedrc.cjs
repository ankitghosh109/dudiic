const path = require("path");

module.exports = {
  "apps/web/**/*.{js,jsx,ts,tsx}": (filenames) => {
    const files = filenames
      .map((file) => path.relative("apps/web", file))
      .join(" ");

    return `pnpm --filter @dudiic/web exec eslint --fix ${files}`;
  },

  "*.{js,jsx,ts,tsx,json,md,css}": "prettier --write",
};
