const uiPreset = require("@autoledger/ui-tokens/tailwind-preset");
const nativeWindPreset = require("nativewind/preset");

/** @type {import("tailwindcss").Config} */
module.exports = {
  presets: [nativeWindPreset, uiPreset],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
