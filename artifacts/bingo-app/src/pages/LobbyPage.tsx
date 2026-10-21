import { useLocation } from 'wouter'
import { usePlayer } from '../context/PlayerContext'
import { useGameReconnect } from '../hooks/useGameReconnect'

const LANDING_IMAGE = 'https://cdn.builder.io/api/v1/image/assets%2F59e42ef7b70445faa7fc61357edc6f12%2F4516cce5bec04aee97032e7e53989d24?format=webp&width=800&height=1200'

export default function LobbyPage() {
  const [, navigate] = useLocation()
  const { player } = usePlayer()

  useGameReconnect(player)

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        minHeight: '100vh',
        overflow: 'hidden',
        background: '#090806',
      }}
    >
      <img
        src={LANDING_IMAGE}
        alt="Gladiators Bingo landing page"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />
      <button
        type="button"
        aria-label="Enter game"
        onClick={() => navigate('/slots')}
        style={{
          position: 'absolute',
          top: '86%',
          left: '13%',
          width: '74%',
          height: '8%',
          border: 0,
          borderRadius: 999,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
    </main>
  )
}
