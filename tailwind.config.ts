import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F7EFE5",
        steel: "#CDB9A2",
        shop: "#F05A24",
        pass: "#D99A4E",
        alert: "#E25C2A",
        millblack: "#050505",
        millpanel: "#11100E",
        millline: "#3A3028"
      },
      boxShadow: {
        touch: "0 18px 40px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
