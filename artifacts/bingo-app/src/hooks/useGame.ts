import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { CARTELAS } from '../data/cartelas'

export type GamePhase = 'waiting' | 'playing' | 'finished'

export interface GameState {
  roundId: string
  phase: GamePhase
  countdown: number
  playerCount: number
  playersWithCards: number
  prizePool: number
  netPrizePool: number
  calledBalls: number[]
  currentBall: number | null
}

export interface Winner {
  telegramId: number
  firstName: string
  cardId: number
  card: number[][]
  winPattern: number[]
}

export interface WinnerEvent {
  roundId: string
  winners: Winner[]
  prizePerWinner: number
}

const DEFAULT_STATE: GameState = {
  roundId: '',
  phase: 'waiting',
  countdown: 0,
  playerCount: 0,
  playersWithCards: 0,
  prizePool: 0,
  netPrizePool: 0,
  calledBalls: [],
  currentBall: null,
}

/** Mirrors the server's two-line or line-plus-four-corners win rule. */
function checkWin(card: number[][], calledSet: Set<number>): boolean {
  const isMarked = (r: number, c: number) =>
    card[r]![c] === 0 || calledSet.has(card[r]![c]!)
  let completedLines = 0

  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every(c => isMarked(r, c))) completedLines++
  }
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every(r => isMarked(r, c))) completedLines++
  }
  if ([0, 1, 2, 3, 4].every(i => isMarked(i, i))) completedLines++
  if ([0, 1, 2, 3, 4].every(i => isMarked(i, 4 - i))) completedLines++

  const hasFourCorners = isMarked(0, 0) && isMarked(0, 4) && isMarked(4, 0) && isMarked(4, 4)
  return completedLines >= 2 || (completedLines >= 1 && hasFourCorners)
}

export function useGame(
  selectedCardIds: number[],
  identity: { telegramId: number; firstName: string } | null,
) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameState>(DEFAULT_STATE)
  const [winner, setWinner] = useState<WinnerEvent | null>(null)
  const [myCardIds, setMyCardIds] = useState<number[]>([])
  const [takenCardIds, setTakenCardIds] = useState<number[]>([])
  const playerRegisteredRef = useRef(false)
  const confirmedCardIdsRef = useRef<number[]>([])
  const submittedCardIdsRef = useRef(new Set<number>())
  const pendingClaimRoundRef = useRef<string | null>(null)

  // Refs so the socket event closures always see current values
  const selectedCardIdsRef = useRef(selectedCardIds)
  const identityRef = useRef(identity)
  const gameStateRef = useRef<GameState>(DEFAULT_STATE)
  const claimedRoundRef = useRef<string | null>(null)

  useEffect(() => {
    selectedCardIdsRef.current = selectedCardIds
    const socket = socketRef.current
    if (socket?.connected && gameStateRef.current.phase === 'waiting') selectPendingCards(socket)
  }, [selectedCardIds])
  useEffect(() => {
    identityRef.current = identity
    const socket = socketRef.current
    if (identity && socket?.connected) joinRoom(socket, identity)
  }, [identity])

  function selectPendingCards(socket: Socket) {
    if (!playerRegisteredRef.current || !identityRef.current) return
    for (const cardId of selectedCardIdsRef.current) {
      if (!confirmedCardIdsRef.current.includes(cardId) && !submittedCardIdsRef.current.has(cardId)) {
        submittedCardIdsRef.current.add(cardId)
        socket.emit('select_card', cardId)
      }
    }
  }

  function joinRoom(socket: Socket, id: { telegramId: number; firstName: string }) {
    socket.emit('join_room', id, (joined: boolean) => {
      playerRegisteredRef.current = joined
      if (joined) selectPendingCards(socket)
    })
  }

  /** Checks server-confirmed cards against called numbers and retries rejected claims. */
  function tryClaimWin(socket: Socket, calledBalls: number[], roundId: string) {
    if (!roundId || claimedRoundRef.current === roundId || pendingClaimRoundRef.current === roundId) return
    const calledSet = new Set(calledBalls)
    for (const cardId of confirmedCardIdsRef.current) {
      const card = CARTELAS[cardId - 1]
      if (card && checkWin(card, calledSet)) {
        pendingClaimRoundRef.current = roundId
        socket.timeout(3000).emit('claim_bingo', { roundId, cardId }, (error: Error | null, accepted: boolean) => {
          if (pendingClaimRoundRef.current !== roundId) return
          pendingClaimRoundRef.current = null
          if (error || !accepted) return
          claimedRoundRef.current = roundId
          sessionStorage.setItem('acceptedClaimedRound', roundId)
        })
        break
      }
    }
  }

  useEffect(() => {
    sessionStorage.removeItem('claimedRound')
    const storedClaimed = sessionStorage.getItem('acceptedClaimedRound')
    if (storedClaimed) claimedRoundRef.current = storedClaimed

    const socket = io({
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      playerRegisteredRef.current = false
      submittedCardIdsRef.current.clear()
      const id = identityRef.current
      if (id) joinRoom(socket, id)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      playerRegisteredRef.current = false
      pendingClaimRoundRef.current = null
    })

    socket.on('game_state', (state: GameState) => {
      gameStateRef.current = state
      setGameState(state)
      // If we haven't sent our cards yet and it's waiting phase, send them now
      if (state.phase === 'waiting' && selectedCardIdsRef.current.length > 0) selectPendingCards(socket)
      // Check for a win on reconnect/state sync during a live round
      if (state.phase === 'playing') {
        tryClaimWin(socket, state.calledBalls, state.roundId)
      }
    })

    socket.on('ball_called', (data: { ball: number; col: string; calledBalls: number[] }) => {
      if (data.ball != null) {
        const currentRoundId = gameStateRef.current.roundId
        const newState: GameState = {
          ...gameStateRef.current,
          calledBalls: data.calledBalls,
          currentBall: data.ball,
        }
        gameStateRef.current = newState
        setGameState(newState)

        // Win detection — check every card after every ball
        if (gameStateRef.current.phase === 'playing') {
          tryClaimWin(socket, data.calledBalls, currentRoundId)
        }
      }
    })

    socket.on('winner_declared', (data: WinnerEvent) => {
      // Persist both the winner event and the final called balls so WinnerPage can
      // correctly highlight all called cells (not just the win pattern)
      sessionStorage.setItem('winnerData', JSON.stringify(data))
      sessionStorage.setItem('calledBalls', JSON.stringify(gameStateRef.current.calledBalls))
      setWinner(data)
    })

    socket.on('round_reset', () => {
      setWinner(null)
      setMyCardIds([])
      playerRegisteredRef.current = false
      confirmedCardIdsRef.current = []
      submittedCardIdsRef.current.clear()
      pendingClaimRoundRef.current = null
      claimedRoundRef.current = null
      sessionStorage.removeItem('acceptedClaimedRound')
      gameStateRef.current = DEFAULT_STATE
      setGameState(DEFAULT_STATE)
    })

    socket.on('my_cards', (data: { cardIds: number[] }) => {
      confirmedCardIdsRef.current = data.cardIds
      setMyCardIds(data.cardIds)
      if (gameStateRef.current.phase === 'playing') {
        tryClaimWin(socket, gameStateRef.current.calledBalls, gameStateRef.current.roundId)
      }
    })

    socket.on('cards_taken', (data: { cardIds: number[] }) => {
      setTakenCardIds(data.cardIds)
    })

    socket.on('player_count', (data: { count: number }) => {
      setGameState(prev => {
        const next = { ...prev, playerCount: data.count }
        gameStateRef.current = next
        return next
      })
    })

    return () => { socket.disconnect() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { connected, gameState, winner, myCardIds, takenCardIds }
}
