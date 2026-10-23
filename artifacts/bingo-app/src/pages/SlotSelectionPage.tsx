import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'wouter'
import { io, type Socket } from 'socket.io-client'
import { CARTELAS } from '../data/cartelas'
import { usePlayer } from '../context/PlayerContext'

interface GameState {
  phase: 'waiting' | 'playing' | 'finished'
  countdown: number
  playerCount: number
  stakePerCard?: number
}

export default function SlotSelectionPage() {
  const [, navigate] = useLocation()
  const [selectedSlots, setSelectedSlots] = useState<number[]>([])
  const [stakePerCard, setStakePerCard] = useState<number>(0)
  const [showNoBalance, setShowNoBalance] = useState(false)
  const { player, refresh } = usePlayer()
  // Live play-balance updated immediately via balance_update socket events
  const [livePlayBalance, setLivePlayBalance] = useState<number | null>(null)

  // ── Server-side state ─────────────────────────────────────────────────────
  const [serverCountdown, setServerCountdown] = useState<number>(30)
  const [gamePhase, setGamePhase] = useState<GameState['phase']>('waiting')
  const [playerCount, setPlayerCount] = useState<number>(0)
  const [takenCards, setTakenCards] = useState<Set<number>>(new Set())
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const playerRef = useRef(player)
  const selectedSlotsRef = useRef(selectedSlots)

  useEffect(() => { playerRef.current = player }, [player])
  useEffect(() => { selectedSlotsRef.current = selectedSlots }, [selectedSlots])

  // Refresh balance when returning to this page (e.g. after a game finishes)
  useEffect(() => {
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Connect to socket and listen to server countdown/phase
  useEffect(() => {
    const socket = io({ path: '/api/socket.io', transports: ['websocket', 'polling'] })
    socketRef.current = socket

    const emitJoin = () => {
      const p = playerRef.current
      if (p) socket.emit('join_room', { telegramId: p.telegramId, firstName: p.firstName })
    }

    socket.on('connect', () => { setConnected(true); emitJoin() })
    socket.on('disconnect', () => setConnected(false))

    socket.on('game_state', (state: GameState) => {
      setServerCountdown(state.countdown)
      setGamePhase(state.phase)
      setPlayerCount(state.playerCount ?? 0)
    })

    socket.on('balance_update', (data: { depositBalance?: string; mainBalance: string; bonusBalance: string }) => {
      // Use combined ETB balance for stake affordability check
      setLivePlayBalance(parseFloat(data.depositBalance ?? '0') + parseFloat(data.mainBalance) + parseFloat(data.bonusBalance))
    })

    // Receive which card IDs are already taken by other players
    socket.on('cards_taken', (data: { cardIds: number[] }) => {
      setTakenCards(new Set(data.cardIds))
    })

    // When a round resets, clear local card selection and taken-cards set
    socket.on('round_reset', () => {
      setSelectedSlots([])
      setTakenCards(new Set())
      setGamePhase('waiting')
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [])

  // If player loads after socket is already connected, emit join
  useEffect(() => {
    if (player && socketRef.current?.connected) {
      socketRef.current.emit('join_room', { telegramId: player.telegramId, firstName: player.firstName })
    }
  }, [player])

  // ── Navigate to game only when server starts the round AND player has cards ─
  useEffect(() => {
    if (gamePhase === 'playing') {
      const cards = selectedSlotsRef.current
      if (cards.length > 0) {
        sessionStorage.setItem('selectedSlots', JSON.stringify(cards))
        navigate('/game')
      }
      // No cards selected → stay on /slots, wait for round_reset → next round
    }
  }, [gamePhase, navigate])

  // ── Fetch stake ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/game/rooms')
      .then(r => r.json())
      .then((data: { room10?: { stakePerCard: number } | null }) => {
        setStakePerCard(data?.room10?.stakePerCard ?? 0)
      })
      .catch(() => {})
  }, [])

  // ── Balance helpers ───────────────────────────────────────────────────────
  // Staking deducts from depositBalance first, then mainBalance/bonusBalance.
  // livePlayBalance tracks the combined total, updated via balance_update socket events.
  const totalBalanceNum = livePlayBalance ?? (player ? (parseFloat(player.depositBalance ?? '0') + parseFloat(player.mainBalance) + parseFloat(player.bonusBalance)) : 0)

  const canAffordOneMore = () => {
    if (stakePerCard <= 0) return true
    // Already-selected cards have been deducted from the balance — check only for 1 more
    return totalBalanceNum >= stakePerCard
  }

  // ── Card selection — emit to server immediately ───────────────────────────
  const toggleSlot = (n: number) => {
    // Block only if taken by another player; own selected cards must remain deselectable
    if (takenCards.has(n) && !selectedSlots.includes(n)) return
    setSelectedSlots(prev => {
      if (prev.includes(n)) {
        socketRef.current?.emit('deselect_card', n)
        return prev.filter(x => x !== n)
      }
      if (prev.length >= 2) return prev
      if (!canAffordOneMore()) { setShowNoBalance(true); return prev }
      socketRef.current?.emit('select_card', n)
      return [...prev, n]
    })
  }

  const formatTime = (s: number) => `00:${String(Math.max(0, s)).padStart(2, '0')}`

  const numbers = Array.from({ length: 500 }, (_, i) => i + 1)

  const totalBalance = (player || livePlayBalance !== null) ? totalBalanceNum.toFixed(2) : '—'

  // Show a dimmed overlay when game is in progress and this player has no cards
  const waitingForNextRound = gamePhase === 'playing' && selectedSlots.length === 0

  return (
    <div className="selection-page" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative' }}>

      {/* Insufficient Balance Modal */}
      {showNoBalance && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px',
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1a170f, #2d160d)',
            border: '1.5px solid #b8860b',
            borderRadius: 20,
            padding: '32px 24px 24px',
            width: '100%',
            maxWidth: 340,
            textAlign: 'center',
            boxShadow: '0 0 32px rgba(212,160,23,0.2)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #ffb800, #f04400)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28,
            }}>👛</div>
            <div className="font-condensed" style={{
              fontSize: 20, fontWeight: 900, color: '#fff',
              letterSpacing: '0.08em', marginBottom: 10,
            }}>INSUFFICIENT BALANCE</div>
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5, marginBottom: 6 }}>
              ካርቴላ ለመምረጥ ETB ያስፈልጋል። ዲፖዚት ያድርጉ።
            </div>
            {stakePerCard > 0 && (
              <div style={{ fontSize: 12, color: '#D4A017', fontWeight: 700, marginBottom: 20 }}>
                ለ 1 ካርቴላ: {stakePerCard} ETB ያስፈልጋል
              </div>
            )}
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
              ETB: <span style={{ color: '#fff', fontWeight: 700 }}>💰 {totalBalance}</span>
            </div>
            <button
              onClick={() => setShowNoBalance(false)}
              style={{
                width: '100%', padding: '13px 0',
                borderRadius: 50, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(to right, #ffb800, #ff8300)',
                fontSize: 15, fontWeight: 800, color: '#fff',
                letterSpacing: '0.08em',
              }}
            >CLOSE</button>
          </div>
        </div>
      )}

      {/* "Game in progress — wait for next round" overlay */}
      {waitingForNextRound && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 90,
          background: 'rgba(0,0,0,0.72)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <div className="font-condensed" style={{
            fontSize: 22, fontWeight: 900, color: '#D4A017',
            letterSpacing: '0.06em', textAlign: 'center',
          }}>GAME IN PROGRESS</div>
          <div style={{ fontSize: 14, color: '#aaa', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
            ካርቴላ አልመረጡም። ጨዋታው ሲጠናቀቅ ቀጣዩ ዙር ይጀምራል።
          </div>
        </div>
      )}

      <header className="selection-header">
        <div className="selection-titlebar">
          <button className="selection-back" onClick={() => navigate('/')} aria-label="Back to lobby">←</button>
          <h1>Gladiators Bingo</h1>
          <span className={`connection-dot${connected ? ' connected' : ''}`} />
          <button className="selection-menu" aria-label="More options">⋮</button>
        </div>
        <div className="selection-stats">
          <StatChip label="Players" value={String(playerCount)} />
          <StatChip label="Stake" value={`${stakePerCard} ETB`} />
          <StatChip label="Wallet" value={`${totalBalance} ETB`} />
          <StatChip label="Timer" value={gamePhase === 'playing' ? '—' : formatTime(serverCountdown)} accent={serverCountdown <= 5 && gamePhase === 'waiting'} />
        </div>
      </header>

      <div className="selection-win-rule">THE GAME IS WON WITH TWO LINES!</div>

      {/* Scrollable grid only */}
      <div className="selection-grid-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px' }}>

        {/* Grand Slots label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="#D4A017" strokeWidth="1.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1" stroke="#D4A017" strokeWidth="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1" stroke="#D4A017" strokeWidth="1.5"/>
            <rect x="9" y="9" width="6" height="6" rx="1" stroke="#D4A017" strokeWidth="1.5"/>
          </svg>
          <span className="font-condensed" style={{ fontSize: 14, fontWeight: 700, color: '#D4A017', letterSpacing: '0.06em' }}>
            GRAND SLOTS (1 - 500)
          </span>
        </div>

        {/* Number Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5 }}>
          {numbers.map(n => {
            const isTaken = takenCards.has(n) && !selectedSlots.includes(n)
            const isSelected = selectedSlots.includes(n)
            return (
              <button
                type="button"
                key={n}
                className={`slot-cell${isSelected ? ' selected' : ''}${isTaken ? ' taken' : ''}`}
                disabled={isTaken}
                aria-pressed={isSelected}
                onClick={() => toggleSlot(n)}
                style={{
                  ...(isTaken ? { cursor: 'not-allowed', opacity: 0.35 } : {}),
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected cartelas */}
      {selectedSlots.length > 0 && (
        <div style={{
          flexShrink: 0,
          background: '#090a08',
          borderTop: '1px solid #3a2410',
          padding: '10px 12px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 15 }}>🎴</span>
            <span className="font-condensed" style={{ fontSize: 14, fontWeight: 700, color: '#D4A017', letterSpacing: '0.06em' }}>
              MY CARTELAS ({selectedSlots.length}/2)
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: selectedSlots.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            justifyItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}>
            {selectedSlots.map((cardNum, i) => {
              const card = CARTELAS[cardNum - 1]
              const COLS = ['B','I','N','G','O']
              return (
                <div key={cardNum} className="cartela-placeholder" style={{ width: '100%', maxWidth: 75, padding: '6px 5px', minHeight: 0 }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#888', letterSpacing: '0.05em' }}>SLOT #{i + 1}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#D4A017' }}>#{cardNum}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, marginBottom: 2 }}>
                      {COLS.map(c => (
                        <div key={c} style={{
                          textAlign: 'center', fontSize: 9, fontWeight: 800,
                          color: '#D4A017', letterSpacing: '0.04em', lineHeight: 1,
                        }}>{c}</div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
                      {card.map((row, r) =>
                        row.map((num, c) => (
                          <div key={`${r}-${c}`} style={{
                            aspectRatio: '1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 3,
                            background: num === 0 ? 'linear-gradient(135deg,#ffd43b,#ff9f00)' : '#15140f',
                            border: num === 0 ? 'none' : '1px solid #4b2b12',
                            fontSize: num === 0 ? 10 : 8,
                            fontWeight: 700,
                            color: num === 0 ? '#fff' : '#ccc',
                            lineHeight: 1,
                          }}>
                            {num === 0 ? '★' : num}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ paddingBottom: 20 }} />
        </div>
      )}
    </div>
  )
}

function StatChip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="game-stat-chip"><span>{label}</span><strong className={accent ? 'accent' : ''}>{value}</strong></div>
}
