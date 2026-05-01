const colors = {
  ledger: {
    background: "#f6f7f4",
    surface: "#ffffff",
    ink: "#1d2528",
    muted: "#667277",
    line: "#d9dfdc",
    primary: "#136f63",
    "primary-dark": "#0d4f47",
    accent: "#d88c3a",
    warning: "#b45309",
  },
};

module.exports = {
  theme: {
    extend: {
      colors,
      borderRadius: {
        card: "8px",
      },
    },
  },
};
