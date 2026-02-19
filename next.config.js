/** @type {import('next').NextConfig} */
const nextConfig = {
	async redirects() {
		return [
			{
				source: '/affiliate',
				destination: '/sales',
				permanent: true,
			},
			{
				source: '/affiliate-dashboard',
				destination: '/sales-dashboard',
				permanent: true,
			},
			{
				source: '/affiliate-portal',
				destination: '/sales-portal',
				permanent: true,
			},
		]
	},
}

module.exports = nextConfig
