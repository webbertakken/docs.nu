import type { NextConfig } from 'next';
import { livedocNextConfig } from '@livedoc/next-config';

// The shared settings (static export, dev's own cache directory, the React Compiler) live in
// @livedoc/next-config (docs/specs/016-platform/nextjs.md).
const nextConfig: NextConfig = {
  ...livedocNextConfig(),
  transpilePackages: ['@livedoc/ui'],
};

export default nextConfig;
