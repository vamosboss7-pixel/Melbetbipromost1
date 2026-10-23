import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'

interface WinnerData {
  roundId: string
  winners: { telegramId: number; firstName: string; cardId: number; card: number[][]; winPattern: number[] }[]
  prizePerWinner: number
}

const TOTAL_COUNTDOWN = 8
const BINGO_COLS = ['B', 'I', 'N', 'G', 'O']
const BINGO_COLORS = ['#1769ff', '#e90046', '#667085', '#07966e', '#8614e8']

export default function WinnerPage() {
  const [, navigate] = useLocation()
  const [countdown, setCountdown] = useState(TOTAL_COUNTDOWN)
  const isPreview = new URLSearchParams(window.location.search).has('preview')

  const [winnerData] = useState<WinnerData | null>(() => {
    if (isPreview) return {
      roundId: 'preview',
      winners: [{
        telegramId: 383356,
        firstName: 'Aster',
        cardId: 59,
        card: [[10,29,40,51,72],[15,18,33,59,74],[2,26,0,52,66],[3,22,37,54,69],[14,30,31,58,71]],
        winPattern: [10,29,40,51,72,18,54,71],
      }],
      prizePerWinner: 72,
    }
    try { return JSON.parse(sessionStorage.getItem('winnerData') ?? 'null') } catch { return null }
  })
  const [calledBalls] = useState<number[]>(() => {
    if (isPreview) return [10,63,70,53,31,33,38,45,13,29,40,51,72,18,54,71]
    try { return JSON.parse(sessionStorage.getItem('calledBalls') ?? '[]') } catch { return [] }
  })

  const winner = winnerData?.winners?.[0]
  const card = winner?.card ?? null
  const winPattern = new Set(winner?.winPattern ?? [])
  const calledSet = new Set(calledBalls)
  const lastWinBall = [...calledBalls].reverse().find(ball => winPattern.has(ball)) ?? -1

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(current => {
        if (current <= 1) {
          clearInterval(timer)
          navigate('/slots')
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [navigate])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 18px',
      overflowY: 'auto',
      color: '#f5f4f0',
      background: '#070705',
      fontFamily: 'Oswald, sans-serif',
    }}>
      <main style={{
        width: '100%',
        maxWidth: 490,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: '28px clamp(18px, 5vw, 50px) 30px',
        border: '1.5px solid #645018',
        borderRadius: 30,
        background: 'linear-gradient(155deg, #171307, #100e08 72%)',
        boxShadow: '0 0 22px rgba(212,160,23,0.12), inset 0 0 18px rgba(212,160,23,0.025)',
      }}>
        <h1 style={{
          margin: 0,
          color: '#ffc21c',
          fontSize: 'clamp(21px, 5vw, 28px)',
          lineHeight: 1.2,
          fontWeight: 900,
          textAlign: 'center',
          textShadow: '0 0 12px rgba(255,194,28,0.18)',
        }}>
          {winner?.firstName ?? 'Winner'} won · Card #{winner?.cardId ?? '—'}
        </h1>

        {card ? (
          <section style={{
            width: '100%',
            maxWidth: 390,
            padding: '14px 12px 12px',
            border: '1px solid #4f401b',
            borderRadius: 18,
            background: '#100e08',
            boxShadow: '0 0 15px rgba(212,160,23,0.06)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5, marginBottom: 7 }}>
              {BINGO_COLS.map((letter, index) => (
                <div key={letter} style={{
                  display: 'grid',
                  placeItems: 'center',
                  minHeight: 31,
                  borderRadius: 14,
                  color: '#fff',
                  background: BINGO_COLORS[index],
                  fontSize: 15,
                  fontWeight: 900,
                }}>{letter}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 }}>
              {card.flatMap((row, rowIndex) => row.map((number, columnIndex) => {
                const isFree = number === 0
                const isLastWin = number === lastWinBall
                const isWinningCell = !isFree && winPattern.has(number)
                const isCalled = !isFree && calledSet.has(number)

                return (
                  <div key={`${rowIndex}-${columnIndex}`} style={{
                    display: 'grid',
                    placeItems: 'center',
                    aspectRatio: '1',
                    minWidth: 0,
                    borderRadius: 9,
                    border: isLastWin ? '2px solid #fff' : isWinningCell ? '1px solid #ffd24a' : '1px solid #4a3b20',
                    color: isLastWin ? '#fff' : isWinningCell ? '#201707' : '#f5f2e9',
                    background: isLastWin ? '#ed4140' : isWinningCell ? '#ffbd17' : isFree ? '#4a3b20' : isCalled ? '#49312a' : '#3a321f',
                    boxShadow: isLastWin ? '0 0 12px rgba(255,255,255,0.45)' : isWinningCell ? '0 0 8px rgba(255,193,28,0.25)' : 'none',
                    fontSize: 'clamp(14px, 4.2vw, 20px)',
                    fontWeight: 800,
                    lineHeight: 1,
                  }}>{isFree ? '★' : number}</div>
                )
              }))}
            </div>
          </section>
        ) : (
          <div style={{ width: '100%', padding: 20, border: '1px solid #4f401b', borderRadius: 18, color: '#aaa', textAlign: 'center' }}>
            ካርቴላ ዳታ አልተገኘም
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'grid',
            placeItems: 'center',
            width: 72,
            height: 72,
            border: '3px solid #f2bd19',
            borderRadius: '50%',
            color: '#fff',
            fontSize: 28,
            fontWeight: 800,
            boxShadow: '0 0 12px rgba(242,189,25,0.12)',
          }}>{countdown}</div>
          <div style={{ color: '#a6a6aa', fontSize: 13, textAlign: 'center' }}>
            Next round in {countdown} seconds...
          </div>
        </div>
      </main>
    </div>
  )
}
