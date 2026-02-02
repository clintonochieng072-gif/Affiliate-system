/**
 * OAuth Error Diagnostic Page
 * Shows detailed error information from OAuth providers
 */

'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const errorMessages: Record<string, { title: string; description: string; solutions: string[] }> = {
    google: {
      title: 'Google Sign-In Configuration Error',
      description: 'Google OAuth authentication failed. This usually means the OAuth credentials need to be configured in Google Cloud Console.',
      solutions: [
        'Enable Google+ API or People API in Google Cloud Console > APIs & Services > Library',
        'Configure OAuth consent screen with app name, support email, and developer email',
        'Add userinfo.email and userinfo.profile scopes',
        'Verify redirect URI is exactly: http://localhost:3000/api/auth/callback/google',
        'If app is in "Testing" status, add your email to test users',
        'Wait 2-3 minutes after making changes for them to propagate',
      ]
    },
    Configuration: {
      title: 'OAuth Configuration Error',
      description: 'There is an issue with the OAuth provider configuration.',
      solutions: [
        'Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env.local',
        'Verify the credentials match those in Google Cloud Console',
        'Restart the development server after changing environment variables',
      ]
    },
    AccessDenied: {
      title: 'Access Denied',
      description: 'You denied access to the application or your account is not authorized.',
      solutions: [
        'Try signing in again and click "Allow" when Google asks for permissions',
        'If app is in Testing mode, make sure your email is added to test users',
        'Check that the OAuth consent screen is properly configured',
      ]
    },
    Verification: {
      title: 'Email Verification Required',
      description: 'Your email needs to be verified before you can sign in.',
      solutions: [
        'Check your email for a verification link from Google',
        'Verify your email address in your Google account settings',
      ]
    },
    Default: {
      title: 'Authentication Error',
      description: 'An error occurred during authentication.',
      solutions: [
        'Try signing in again',
        'Clear your browser cookies and cache',
        'Try using an incognito/private window',
      ]
    }
  }

  const errorInfo = errorMessages[error || 'Default'] || errorMessages.Default

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Error Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8 shadow-2xl">
          {/* Error Icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-4">
            {errorInfo.title}
          </h1>

          {/* Error Code */}
          {error && (
            <div className="text-center mb-6">
              <span className="inline-block bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm font-mono">
                Error: {error}
              </span>
            </div>
          )}

          {/* Error Description */}
          <p className="text-slate-300 text-center mb-8">
            {errorInfo.description}
          </p>

          {/* Solutions */}
          <div className="bg-slate-900/50 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How to Fix
            </h2>
            <ol className="space-y-3">
              {errorInfo.solutions.map((solution, index) => (
                <li key={index} className="flex gap-3 text-slate-300">
                  <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="flex-1">{solution}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Documentation Link */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-blue-300 font-semibold mb-1">Need detailed instructions?</p>
                <p className="text-slate-300 text-sm">
                  See <code className="bg-slate-800 px-2 py-1 rounded text-blue-400">TROUBLESHOOT-OAUTH.md</code> for step-by-step troubleshooting
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={callbackUrl}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-500 hover:to-emerald-400 transition-all hover:scale-105 text-center shadow-lg shadow-emerald-500/20"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="flex-1 bg-slate-700/50 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-600/50 transition-all text-center"
            >
              Go Home
            </Link>
          </div>

          {/* Debug Info */}
          <details className="mt-6">
            <summary className="text-slate-400 text-sm cursor-pointer hover:text-slate-300 transition-colors">
              Technical Details
            </summary>
            <div className="mt-3 bg-slate-950/50 rounded-lg p-4 text-xs font-mono">
              <div className="space-y-2 text-slate-400">
                <p><span className="text-slate-500">Error Code:</span> {error || 'Unknown'}</p>
                <p><span className="text-slate-500">Callback URL:</span> {callbackUrl}</p>
                <p><span className="text-slate-500">Time:</span> {new Date().toISOString()}</p>
                {error === 'google' && (
                  <>
                    <p className="mt-4 text-slate-300">Common causes for <span className="text-red-400">"error=google"</span>:</p>
                    <ul className="ml-4 space-y-1 list-disc list-inside">
                      <li>Google+ API not enabled</li>
                      <li>OAuth consent screen incomplete</li>
                      <li>Test user not added (for Testing status apps)</li>
                      <li>Redirect URI mismatch</li>
                      <li>Invalid or expired credentials</li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
