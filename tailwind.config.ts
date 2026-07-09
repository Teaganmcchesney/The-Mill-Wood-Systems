import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        steel: "#516170",
        shop: "#f7b801",
        pass: "#2f855a",
        alert: "#c2410c"
      },
      boxShadow: {
        touch: "0 14px 30px rgba(20, 33, 61, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
