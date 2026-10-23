import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { CARTELAS } from '../data/cartelas'
import { useGame } from '../hooks/useGame'
import { usePlayer } from '../context/PlayerContext'
import { useSoundSettings } from '../context/SoundContext'

const BINGO_COLS = ['B', 'I', 'N', 'G', 'O'] as const
const COL_RANGES: Record<string, [number, number]> = {
  B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75],
}
const COL_BADGE_COLORS: Record<string, string> = {
  B: '#1769ff', I: '#ed0044', N: '#64748b', G: '#07996d', O: '#9810ee',
}

function getBallCol(n: number): string {
  for (const [col, [start, end]] of Object.entries(COL_RANGES)) {
    if (n >= start && n <= end) return col
  }
  return 'B'
}

export default function GamePage() {
  const [, navigate] = useLocation()
  const { bgMusicEnabled, ballSoundEnabled, setBgMusic, setBallSound } = useSoundSettings()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ballAudioRef = useRef<HTMLAudioElement | null>(null)
  const [stakePerCard, setStakePerCard] = useState(0)
  const [autoMark, setAutoMark] = useState(true)
  const [manualMarks, setManualMarks] = useState<Set<string>>(new Set())
  const [selectedSlots] = useState<number[]>(() => {
    try {
      const stored = sessionStorage.getItem('selectedSlots')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const bingoAudioRef = useRef<HTMLAudioElement | null>(null)
  const { player } = usePlayer()
  const identity = player ? { telegramId: player.telegramId, firstName: player.firstName } : null
  const { connected, gameState, winner } = useGame(selectedSlots, identity)
  const calledSet = new Set(gameState.calledBalls)
  const latestBall = gameState.currentBall
  useEffect(() => {
    fetch('/api/game/rooms')
      .then(r => r.json())
      .then((data: { room10?: { stakePerCard: number } | null }) => setStakePerCard(data?.room10?.stakePerCard ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!winner) return
    if (audioRef.current) audioRef.current.muted = true
    const audio = new Audio('/audio/bingo-claim.mp3')
    audio.volume = 1
    bingoAudioRef.current = audio
    audio.play().catch(() => {})
    const timeout = window.setTimeout(() => navigate('/winner'), 1500)
    return () => window.clearTimeout(timeout)
  }, [winner, navigate])

  useEffect(() => {
    const audio = new Audio('/audio/bg-music.mp3')
    audio.loop = true
    audio.volume = 0.35
    audio.muted = !bgMusicEnabled
    audioRef.current = audio
    audio.play().catch(() => {})
    return () => { audio.pause(); audio.src = '' }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !bgMusicEnabled
  }, [bgMusicEnabled])

  useEffect(() => {
    if (!gameState.currentBall) return
    if (ballAudioRef.current) {
      ballAudioRef.current.pause()
      ballAudioRef.current.src = ''
    }
    if (!ballSoundEnabled) return
    const col = getBallCol(gameState.currentBall)
    const audio = new Audio(`/audio/balls/${col}${gameState.currentBall}.mp3`)
    audio.volume = 1
    ballAudioRef.current = audio
    audio.play().catch(() => {})
  }, [gameState.currentBall, ballSoundEnabled])

  const toggleManualMark = (key: string) => {
    setManualMarks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <main className="game-page">
      <header className="game-topbar">
        <button className="game-back" onClick={() => navigate('/slots')} aria-label="Back to cards">←</button>
        <h1>Gladiators Bingo</h1>
        <span className={`connection-dot${connected ? ' connected' : ''}`} title={connected ? 'Live' : 'Connecting'} />
        <button className="game-menu" onClick={() => navigate('/slots')} aria-label="More options">⋮</button>
      </header>

      <section className="game-stats" aria-label="Game statistics">
        <StatChip label="Players" value={String(gameState.playerCount || gameState.playersWithCards)} />
        <StatChip label="Stake" value={`${stakePerCard} ETB`} />
        <StatChip label="Called numbers" value={`${gameState.calledBalls.length} / 75`} />
        <StatChip label="Prize" value={`${gameState.netPrizePool.toFixed(0)} ETB`} accent />
      </section>

      <div className="game-win-rule">THE GAME IS WON WITH TWO LINES!</div>

      <section className="game-draw-controls">
        <div className="latest-ball-card">
          <div className={`latest-ball${latestBall ? ' has-ball' : ''}`}>
            {latestBall ? <><span>{getBallCol(latestBall)}</span><strong>{latestBall}</strong></> : <span>—</span>}
          </div>
          <div className="recent-balls">
            {(gameState.calledBalls.slice(-4).reverse().slice(1)).length
              ? gameState.calledBalls.slice(-4).reverse().slice(1).map(n => <span key={n}>{n}</span>)
              : <><span>—</span><span>—</span><span>—</span></>}
          </div>
        </div>
        <div className="draw-options">
          <button className={`auto-toggle${autoMark ? ' active' : ''}`} onClick={() => setAutoMark(value => !value)} aria-pressed={autoMark}>
            <span>AUTO</span><i />
          </button>
          <button className="sound-toggle" onClick={() => { const enabled = bgMusicEnabled || ballSoundEnabled; setBgMusic(!enabled); setBallSound(!enabled) }} aria-label={bgMusicEnabled || ballSoundEnabled ? 'Mute sound' : 'Enable sound'}>
            {bgMusicEnabled || ballSoundEnabled ? '◖)' : '◖×'}
          </button>
          <div className="bingo-legend">
            {BINGO_COLS.map(col => <span key={col} style={{ background: COL_BADGE_COLORS[col] }}>{col}</span>)}
          </div>
        </div>
      </section>

      <section className="game-content">
        <div className="called-board">
          <div className="bingo-letters">
            {BINGO_COLS.map(col => <span key={col} style={{ background: COL_BADGE_COLORS[col] }}>{col}</span>)}
          </div>
          <div className="called-grid">
            {Array.from({ length: 15 }, (_, row) => BINGO_COLS.map(col => {
              const [start] = COL_RANGES[col]
              const number = start + row
              const isCalled = calledSet.has(number)
              const isLatest = number === latestBall
              return <div key={number} className={`called-ball${isCalled ? ' called' : ''}${isLatest ? ' latest' : ''}`}>{number}</div>
            }))}
          </div>
        </div>

        <div className="player-cards">
          {selectedSlots.length === 0 ? (
            <div className="empty-cards">
              <strong>No cards selected</strong>
              <button onClick={() => navigate('/slots')}>Choose cards</button>
            </div>
          ) : selectedSlots.map(slotNum => {
            const card = CARTELAS[slotNum - 1]
            if (!card) return null
            return (
              <article className="player-card" key={slotNum}>
                <div className="player-card-title">Card <strong>#{slotNum}</strong></div>
                <div className="player-card-letters">
                  {BINGO_COLS.map(col => <span key={col} style={{ background: COL_BADGE_COLORS[col] }}>{col}</span>)}
                </div>
                <div className="player-card-grid">
                  {card.map((row, rowIndex) => row.map((number, colIndex) => {
                    const isFree = number === 0
                    const key = `${slotNum}:${rowIndex}:${colIndex}`
                    const isMarked = !isFree && ((autoMark && calledSet.has(number)) || manualMarks.has(key))
                    return (
                      <button
                        key={key}
                        className={`player-card-cell${isFree ? ' free' : ''}${isMarked ? ' marked' : ''}`}
                        onClick={() => !isFree && toggleManualMark(key)}
                        aria-label={isFree ? 'Free space' : `Mark ${number}`}
                      >
                        {isFree ? <><span>✦</span>FREE</> : number}
                      </button>
                    )
                  }))}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {winner && (
        <div className="winner-overlay">
          <div className="winner-trophy">🏆</div>
          <strong>BINGO!</strong>
          <span>{winner.winners[0]?.firstName ?? 'Winner'} wins {winner.prizePerWinner} ETB</span>
          <small>Returning to the winner screen…</small>
        </div>
      )}
    </main>
  )
}

function StatChip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="game-stat-chip"><span>{label}</span><strong className={accent ? 'accent' : ''}>{value}</strong></div>
}
