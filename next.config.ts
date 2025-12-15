// Trigger environment validation at startup
require("./env-validation")

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",
}

export default nextConfig
