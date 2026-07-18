/** @type {import('next').NextConfig} */
const isElectronBuild = process.env.ELECTRON_BUILD === "true";
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repositoryName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "";
const useGithubPagesPath =
	!isElectronBuild && isGithubActions && Boolean(repositoryName);

const nextConfig = {
	devIndicators: false,
	trailingSlash: true,
	...(isElectronBuild ? { output: "standalone" } : {}),
	basePath: useGithubPagesPath ? `/${repositoryName}` : "",
	assetPrefix: useGithubPagesPath ? `/${repositoryName}/` : "",
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
