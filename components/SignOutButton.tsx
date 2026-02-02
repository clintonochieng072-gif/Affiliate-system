'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
    >
      Sign Out
    </button>
  )
}
