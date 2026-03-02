'use client'

import { MessageCircle } from 'lucide-react'
import { useState } from 'react'

const WHATSAPP_URL = 'https://chat.whatsapp.com/LrRoGo2MTa1Fe9UDhsJTtz?mode=gi_t'

export default function WhatsAppButton() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-40"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Join Sales WhatsApp Group"
    >
      <div
        className={`flex items-center justify-center w-14 h-14 rounded-full cursor-pointer transition-all duration-300 transform ${
          isHovered ? 'scale-110 shadow-lg' : 'shadow-md'
        }`}
        style={{
          backgroundColor: '#25D366',
        }}
      >
        <MessageCircle className="w-7 h-7 text-white" strokeWidth={1.5} />
      </div>
      
      {/* Tooltip on hover */}
      {isHovered && (
        <div className="absolute bottom-20 right-0 bg-slate-800 text-white text-sm font-medium px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
          Join Sales WhatsApp Group
        </div>
      )}
    </a>
  )
}
