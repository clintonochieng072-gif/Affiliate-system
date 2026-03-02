/**
 * Dashboard API Fetcher Utility
 * Handles auto-provisioning responses and error cases
 */

export const dashboardFetcher = async (url: string) => {
  const response = await fetch(url)
  const payload = await response.json()

  // Handle auto-provisioning response (201)
  if (response.status === 201 && payload?.redirectTo) {
    console.log('✅ Sales record auto-provisioned, refreshing dashboard...')
    // Wait a moment then refresh to get the new data
    await new Promise(resolve => setTimeout(resolve, 500))
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
    return null
  }

  if (!response.ok || payload?.error) {
    const errorMsg = payload?.error || payload?.details || 'Dashboard request failed'
    console.error('❌ Dashboard fetch error:', {
      status: response.status,
      error: errorMsg,
      url,
    })
    throw new Error(errorMsg)
  }

  return payload
}
