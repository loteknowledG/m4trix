/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repositoryName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "";
// pages = static export (GitHub Pages). desktop = Node server for Electron.
const buildTarget = process.env.M4TRIX_BUILD_TARGET || (isGithubActions ? "pages" : "pages");
const isDesktopBuild = buildTarget === "desktop";

const nextConfig = {
	devIndicators: false,
	...(isDesktopBuild
		? {
				output: "standalone",
			}
		: {
				output: "export",
				trailingSlash: true,
				basePath: isGithubActions && repositoryName ? `/${repositoryName}` : "",
				assetPrefix: isGithubActions && repositoryName ? `/${repositoryName}/` : "",
			}),
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
};

export default nextConfig;
