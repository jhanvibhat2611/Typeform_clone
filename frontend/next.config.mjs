import path from "node:path";
import { fileURLToPath } from "node:url";

/** Keep dependency discovery inside frontend/, even if a parent has a lockfile. */
const nextConfig = {
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};

export default nextConfig;
