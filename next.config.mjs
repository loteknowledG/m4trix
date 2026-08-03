/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const isDev =
	process.env.NODE_ENV === "development" || process.argv.includes("dev");
const repositoryName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "";
// pages = static export (GitHub Pages). desktop = Node server for Electron.
// server = normal Next (local `pnpm dev`) — no static export.
const buildTarget =
	process.env.M4TRIX_BUILD_TARGET || (isGithubActions ? "pages" : "server");
const isDesktopBuild = buildTarget === "desktop";
const isPagesBuild = buildTarget === "pages" && !isDev;
const basePath = isPagesBuild && repositoryName ? `/${repositoryName}` : "";
const kvStoreShim = path.resolve(__dirname, "src/lib/kv-store-shim.ts");
const legacyIdbKeyval = path.resolve(__dirname, "node_modules/idb-keyval/dist/index.js");
const videoJsPath = path.resolve(__dirname, "node_modules/video.js");

const nextConfig = {
	devIndicators: false,
	env: {
		NEXT_PUBLIC_BASE_PATH: basePath,
	},
	...(isDesktopBuild
		? {
				output: "standalone",
			}
		: isPagesBuild
			? {
					output: "export",
					trailingSlash: true,
					basePath: isGithubActions && repositoryName ? `/${repositoryName}` : "",
					assetPrefix: isGithubActions && repositoryName ? `/${repositoryName}/` : "",
				}
			: {}),
	// Treat as external in the Node.js server runtime
	serverExternalPackages: [
		"google-photos-album-image-url-fetch",
	],
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "models.dev",
			},
		],
	},
	turbopack: {
		resolveAlias: {
			"video.js": "./node_modules/video.js",
			"idb-keyval": kvStoreShim,
			"idb-keyval-legacy": legacyIdbKeyval,
		},
	},
	webpack: (config) => {
		config.resolve.alias = {
			...config.resolve.alias,
			"video.js": videoJsPath,
			"idb-keyval": kvStoreShim,
			"idb-keyval-legacy": legacyIdbKeyval,
		};
		return config;
	},
};

export default nextConfig;
