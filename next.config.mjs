/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repositoryName = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "";

const nextConfig = {
	devIndicators: false,
	output: "export",
	trailingSlash: true,
	basePath: isGithubActions && repositoryName ? `/${repositoryName}` : "",
	assetPrefix: isGithubActions && repositoryName ? `/${repositoryName}/` : "",
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
