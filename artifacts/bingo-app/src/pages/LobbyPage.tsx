import { useLocation } from 'wouter'
import { usePlayer } from '../context/PlayerContext'
import { useGameReconnect } from '../hooks/useGameReconnect'

export default function LobbyPage() {
  const [, navigate] = useLocation()
  const { player } = usePlayer()

  useGameReconnect(player)

  return (
    <main
      style={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height: '100dvh',
        minHeight: '100vh',
        overflow: 'hidden',
        padding: 24,
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at 50% 35%, #18351f 0%, #06100b 55%, #030705 100%)',
        color: '#fff',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 'min(100%, 440px)',
          padding: '52px 28px',
          border: '1px solid rgba(245, 190, 45, 0.55)',
          borderRadius: 28,
          background: 'linear-gradient(155deg, rgba(25, 54, 32, 0.96), rgba(8, 14, 10, 0.98))',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55), 0 0 40px rgba(245, 190, 45, 0.12)',
        }}
      >
        <div aria-hidden="true" style={{ fontSize: 68, lineHeight: 1, marginBottom: 22 }}>♛</div>
        <p style={{ margin: '0 0 12px', color: '#f5be2d', fontSize: 12, fontWeight: 800, letterSpacing: '0.3em' }}>
          BINGO CHAMPIONS
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(34px, 9vw, 52px)', fontWeight: 900, letterSpacing: '-0.04em' }}>
          Gladiators <span style={{ color: '#f5be2d' }}>Bingo</span>
        </h1>
        <p style={{ margin: '18px auto 34px', maxWidth: 300, color: '#c5cec7', fontSize: 16, lineHeight: 1.6 }}>
          Pick your cards. Play your lines. Claim the victory.
        </p>
        <button
          type="button"
          onClick={() => navigate('/slots')}
          style={{
            width: '100%',
            minHeight: 58,
            border: '1px solid #ffe27a',
            borderRadius: 999,
            background: 'linear-gradient(180deg, #ffd84d, #e9a900)',
            boxShadow: '0 8px 24px rgba(233, 169, 0, 0.25)',
            color: '#17120a',
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          ENTER GAME
        </button>
      </div>
    </main>
  )
}
