/** @type {import('next').NextConfig} */
const contentSecurityPolicy = `
	default-src 'self';
	script-src 'self' 'sha256-7IP/1MP3Ya03ggsvGp9W3Z3Ic+sGELyLzMMMiRZU0sA=' 'sha256-Q+8tPsjVtiDsjF/Cv8FMOpg2Yg91oKFKDAJat1PPb2g=' 'sha256-KLMFsKaC55ixI+rV7alyy5iPGcPcC238uw/3vbBQMtE=' 'sha256-+MtBZRpyhIJNDeaYAf3noH13Rx/5YOy1egkE8Jes5ao=' 'sha256-7Ol2lb8GtXbApdusYWwvoGrth70heexJq6ed38RnrM0=' 'sha256-5AUmDm1WU2HvcpNZ+tWYLNvkB7RVHeTbyLxLy1R2Le8=';
	style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
	img-src 'self' data:;
	font-src 'self' data: https://fonts.gstatic.com;
	connect-src 'self' https://m4trix.vercel.app;
`;

const nextConfig = {
	async headers() {
		return [
			{
				source: '/(.*)',
				headers: [
					{
						key: 'Content-Security-Policy',
						value: contentSecurityPolicy.replace(/\n/g, ' '),
					},
				],
			},
		];
	},
};

export default nextConfig;
