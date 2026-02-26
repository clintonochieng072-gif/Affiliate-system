'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ProfileSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading, mutate } = useSWR(session ? '/api/profile' : null, fetcher)

  useEffect(() => {
    if (data?.profile) {
      setName(data.profile.name || '')
      setPhone(data.profile.phone || '')
    }
  }, [data])

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update profile')
      }

      setMessage({ type: 'success', text: 'Profile updated successfully' })
      mutate()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading profile...</div>
  }

  if (error || !data) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Failed to load profile</div>
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />
      <main className="lg:ml-64 p-4 lg:p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-white mb-1">Profile Settings</h1>
        <p className="text-slate-400 text-sm mb-5">Keep your public affiliate details updated</p>

        <form onSubmit={onSubmit} className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Email</label>
            <input value={data.profile.email} disabled className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-400" />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Enter your full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Phone</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              placeholder="Enter your mobile number"
              required
            />
          </div>

          {message && (
            <div className={`text-sm rounded-lg p-3 ${message.type === 'success' ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-600/30' : 'bg-red-900/30 text-red-300 border border-red-600/30'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </main>
    </div>
  )
}
