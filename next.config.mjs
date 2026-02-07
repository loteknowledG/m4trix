/** @type {import('next').NextConfig} */
const nextConfig = {
	devIndicators: false,
	// Treat as external in the Node.js server runtime
	serverExternalPackages: [
		"google-photos-album-image-url-fetch",
	],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "models.dev",
			},
		],
	},
};

export default nextConfig;
