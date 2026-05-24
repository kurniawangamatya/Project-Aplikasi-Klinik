import React from 'react';
import { motion } from 'motion/react';

export default function GlowingWorldMap() {
  // Generate random stable stars for the background
  const stars = Array.from({ length: 35 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.5 + 0.5,
    delay: Math.random() * 4,
  }));

  return (
    <div className="w-full min-h-[460px] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Black Cosmic Void Background */}
      <div className="absolute inset-0 bg-[#030014] z-0" />

      {/* Starry Night Sky Field */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            initial={{ opacity: 0.1 }}
            animate={{ opacity: [0.1, 0.8, 0.1] }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: star.delay,
            }}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              filter: star.size > 1 ? 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' : 'none',
            }}
          />
        ))}
      </div>

      {/* Decorative Blur Background Orbs */}
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-600/10 blur-[80px] pointer-events-none z-0 animate-pulse" />
      <div className="absolute bottom-[10%] left-[50%] -translate-x-1/2 w-96 h-40 rounded-full bg-fuchsia-600/10 blur-[100px] pointer-events-none z-0" />

      {/* The Mega Glowing Globe & Atmospheric Halo Ring */}
      <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center z-10 mt-4">
        
        {/* Giant outer aura ring */}
        <div className="absolute inset-0 rounded-full border border-violet-500/10 bg-radial-gradient from-violet-950/20 via-transparent to-transparent scale-[1.1] animate-pulse pointer-events-none" />

        {/* Purple Glowing Planet Contour Arc */}
        <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible z-10">
          <defs>
            {/* Soft atmospheric radial gradient for the planet mask */}
            <radialGradient id="sphereGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" stopColor="#08031a" stopOpacity="1" />
              <stop offset="70%" stopColor="#0a0524" stopOpacity="0.95" />
              <stop offset="85%" stopColor="#12093a" stopOpacity="0.85" />
              <stop offset="97%" stopColor="#2c146e" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
            </radialGradient>

            {/* Vibrant purple/blue edge gradient for the ring contour */}
            <linearGradient id="ringEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#c084fc" stopOpacity="1" />
              <stop offset="70%" stopColor="#e879f9" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.75" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="ultraGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Subtle glow for dotted gridlines */}
            <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Deep Planet Body Fill with Radial Shader */}
          <circle cx="200" cy="200" r="160" fill="url(#sphereGlow)" className="shadow-2xl" />

          {/* Glowing Atmospheric Aura rings (Sellix style) */}
          <circle
            cx="200"
            cy="200"
            r="161"
            fill="none"
            stroke="url(#ringEdge)"
            strokeWidth="3"
            filter="url(#ultraGlow)"
            className="opacity-90"
          />
          <circle
            cx="200"
            cy="200"
            r="162"
            fill="none"
            stroke="#f5f3ff"
            strokeWidth="1.2"
            className="opacity-60"
          />
          <circle
            cx="200"
            cy="200"
            r="166"
            fill="none"
            stroke="#c084fc"
            strokeWidth="0.8"
            className="opacity-25"
          />

          {/* Latitudinal (Horizontal) Grid Lines */}
          <g className="opacity-40" stroke="#7c3aed" strokeWidth="0.5" strokeDasharray="3, 4" fill="none">
            <ellipse cx="200" cy="200" rx="160" ry="1" />
            <ellipse cx="200" cy="200" rx="155" ry="35" />
            <ellipse cx="200" cy="200" rx="140" ry="70" />
            <ellipse cx="200" cy="200" rx="114" ry="105" />
            <ellipse cx="200" cy="200" rx="72" ry="135" />
          </g>

          {/* Longitudinal (Vertical) Grid Lines */}
          <g className="opacity-45" stroke="#a78bfa" strokeWidth="0.5" strokeDasharray="3, 4" fill="none">
            <ellipse cx="200" cy="200" rx="35" ry="160" />
            <ellipse cx="200" cy="200" rx="75" ry="155" />
            <ellipse cx="200" cy="200" rx="115" ry="142" />
            <ellipse cx="200" cy="200" rx="145" ry="115" />
          </g>

          {/* Elegant active node highlights */}
          <g filter="url(#subtleGlow)">
            {/* Node 1 */}
            <motion.circle
              cx="130"
              cy="160"
              r="3"
              fill="#ffffff"
              animate={{ r: [3, 4.5, 3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <circle cx="130" cy="160" r="7" fill="none" stroke="#e879f9" strokeWidth="1" className="opacity-50" />
            <line x1="130" y1="160" x2="165" y2="135" stroke="#e879f9" strokeWidth="0.75" className="opacity-60 text-fuchsia-400" />

            {/* Node 2 */}
            <motion.circle
              cx="260"
              cy="230"
              r="3"
              fill="#ffffff"
              animate={{ r: [3, 4.5, 3] }}
              transition={{ duration: 2.3, repeat: Infinity, delay: 0.5 }}
            />
            <circle cx="260" cy="230" r="7" fill="none" stroke="#6366f1" strokeWidth="1" className="opacity-50" />
            <line x1="260" y1="230" x2="220" y2="250" stroke="#6366f1" strokeWidth="0.75" className="opacity-60 text-indigo-400" />

            {/* Node 3 */}
            <motion.circle
              cx="280"
              cy="140"
              r="2.5"
              fill="#ffffff"
              animate={{ r: [2.5, 4, 2.5] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: 1 }}
            />
            <circle cx="280" cy="140" r="6" fill="none" stroke="#c084fc" strokeWidth="1" className="opacity-50" />
            <line x1="280" y1="140" x2="245" y2="120" stroke="#c084fc" strokeWidth="0.75" className="opacity-60 text-violet-400" />
          </g>

          {/* Connecting Active Pulse Stream Arc inside the globe */}
          <path
            d="M 130 160 Q 200 110 280 140"
            fill="none"
            stroke="url(#ringEdge)"
            strokeWidth="1"
            className="opacity-40"
          />
          <motion.path
            d="M 130 160 Q 200 110 280 140"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="10, 80"
            animate={{ strokeDashoffset: [90, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            filter="url(#subtleGlow)"
          />

          <path
            d="M 280 140 Q 250 190 260 230"
            fill="none"
            stroke="url(#ringEdge)"
            strokeWidth="1"
            className="opacity-40"
          />
          <motion.path
            d="M 280 140 Q 250 190 260 230"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="10, 80"
            animate={{ strokeDashoffset: [90, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
            filter="url(#subtleGlow)"
          />
        </svg>

        {/* Floating Typography exactly over the globe center like in the Sellix image, but minimal and clean */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none z-20 px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="space-y-2 mt-4"
          >
            <h1 className="text-3xl font-black text-white tracking-tight leading-[1.1]">
              Sistem Klinik <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400">
                Terpadu & Lintas-Unit
              </span>
            </h1>
            <p className="text-zinc-400 text-[10.5px] font-medium leading-relaxed max-w-[240px] mx-auto opacity-90">
              Operasional kasir, data pasien, laporan tindakan medis, dan lembur otomatis terintegrasi.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
