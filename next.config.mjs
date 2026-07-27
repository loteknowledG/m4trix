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

const videoJsPath = path.resolve(__dirname, "node_modules/video.js");

const nextConfig = {
	devIndicators: false,
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
		},
	},
	webpack: (config) => {
		config.resolve.alias = {
			...config.resolve.alias,
			"video.js": videoJsPath,
		};
		return config;
	},
};

export default nextConfig;
