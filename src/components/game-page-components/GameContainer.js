import React, { useState, useEffect, useRef } from "react";
import BoardLayout from "./BoardLayout";
import GamePlayControlContainer from "./GamePlayControlContainer";

const GameContainer = ({ matchId, stompClient, isConnected, playerColor, initialGameData, gameType = 'standard' }) => {
  const [moves, setMoves] = useState([]);

  // Local state for the CURRENT board FEN to track turns instantly
  const [currentFen, setCurrentFen] = useState(initialGameData?.fen);

  // Sync local FEN with server data when it changes
  useEffect(() => {
    if (initialGameData?.fen) {
      setCurrentFen(initialGameData.fen);
    }
  }, [initialGameData?.fen]);

  // Robust turn initialization from FEN
  const getTurnFromFen = (fen) => {
    if (!fen) return null;
    const parts = fen.split(' ');
    // Standard FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
    // Active color is the 2nd part: 'w' or 'b'
    return parts[1];
  };

  const currentFenTurn = getTurnFromFen(currentFen);

  // STATELESS calculation of isMyTurn
  // This re-runs every render, so it's never stale
  const calculateIsMyTurn = (fenTurn, gameData, color) => {
    if (fenTurn) {
      return (color === 'white' && fenTurn === 'w') || (color === 'black' && fenTurn === 'b');
    }
    // Fallback only if FEN is missing
    return gameData?.isMyTurn ?? gameData?.myTurn ?? (color === 'white');
  };

  const isMyTurn = calculateIsMyTurn(currentFenTurn, initialGameData, playerColor);

  // Debugging logs
  useEffect(() => {
    console.log("DEBUGGER: Render State", {
      playerColor,
      currentFen,
      currentFenTurn,
      isMyTurn,
      gameType
    });
  }, [playerColor, currentFen, currentFenTurn, isMyTurn, gameType]);
  const [gameStatus, setGameStatus] = useState(initialGameData?.status || "Game started");
  const [opponentMove, setOpponentMove] = useState(null); // To trigger board updates
  const [gameResult, setGameResult] = useState(null); // { winner: 'white'|'black'|'draw', reason: 'checkmate'|'resignation'|'draw offer' }
  const [drawOffer, setDrawOffer] = useState(null); // { from: username }

  // BLITZ TIMER: 10 minutes = 600 seconds
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const timerRef = useRef(null);

  const moveSubscriptionRef = useRef(null);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!stompClient || !isConnected) return;

    // Subscribe to move updates
    moveSubscriptionRef.current = stompClient.subscribe(`/topic/moves/${matchId}`, (message) => {
      try {
        const moveData = JSON.parse(message.body);
        console.log("Received opponent move:", moveData);

        // Check for error header or content
        if (moveData.moveNotation && moveData.moveNotation.startsWith("ERROR:")) {
          console.error("Move error:", moveData.moveNotation);
          alert(moveData.moveNotation); // Notify user of the error
          return;
        }

        // Set opponent move to trigger board update
        setOpponentMove(moveData);

        // UPDATE LOCAL FEN to switch turns immediately
        // Prioritize 'fen' from move object, or 'fenAfter' if available
        const nextFen = moveData.fen || moveData.fenAfter || moveData.move?.fen;
        if (nextFen) {
          console.log("DEBUG: Updating FEN from move:", nextFen);
          setCurrentFen(nextFen);
        } else {
          console.warn("DEBUG: No FEN in move data, turn might not update!", moveData);
        }

        // Update status only
        if (moveData.playerColor === playerColor) {
          setGameStatus("Waiting for opponent...");
        } else {
          setGameStatus("Your turn!");
        }

        // Add move to history if provided
        if (moveData.move) {
          addMove(moveData.move);
        }
      } catch (error) {
        console.error("Error parsing move data:", error);
      }
    });

    // Subscribe to resignation events
    stompClient.subscribe(`/topic/game-state/${matchId}/resignation`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log("Resignation event:", data);
        const winner = data.winner || (data.playerColor === 'white' ? 'black' : 'white');
        setGameResult({ winner, reason: 'resignation', resignedPlayer: data.playerColor });
        setGameStatus(`Game Over - ${winner.toUpperCase()} wins by resignation`);
        alert(`${winner.toUpperCase()} wins! Opponent resigned.`);
      } catch (error) {
        console.error("Error parsing resignation data:", error);
      }
    });

    // Subscribe to draw offers
    stompClient.subscribe(`/topic/game-state/${matchId}/draw-offer`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log("Draw offer received:", data);
        // Only show to opponent
        if (data.fromColor !== playerColor) {
          setDrawOffer({ from: data.fromColor });
        }
      } catch (error) {
        console.error("Error parsing draw offer:", error);
      }
    });

    // Subscribe to draw responses  
    stompClient.subscribe(`/topic/game-state/${matchId}/draw-response`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log("Draw response:", data);
        if (data.accepted) {
          setGameResult({ winner: 'draw', reason: 'agreement' });
          setGameStatus("Game Over - Draw by agreement");
          alert("Game ended in a draw by mutual agreement!");
        } else {
          alert("Draw offer declined.");
        }
        setDrawOffer(null);
      } catch (error) {
        console.error("Error parsing draw response:", error);
      }
    });

    // Subscribe to checkmate events
    stompClient.subscribe(`/topic/game-state/${matchId}/checkmate`, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log("Checkmate event:", data);
        setGameResult({ winner: data.winner, reason: 'checkmate' });
        setGameStatus(`Game Over - ${data.winner.toUpperCase()} wins by checkmate!`);
        alert(`${data.winner.toUpperCase()} wins by checkmate!`);
      } catch (error) {
        console.error("Error parsing checkmate data:", error);
      }
    });

    // Subscribe to game state updates
    stompClient.subscribe(`/topic/game-state/${matchId}`, (message) => {
      try {
        const state = JSON.parse(message.body);
        console.log("Game state update:", state);

        if (state.fen) {
          setCurrentFen(state.fen);
        }

        if (state.status) {
          setGameStatus(state.status);
        }

        // REMOVED: setIsMyTurn manual update

        if (state.result) {
          // Game ended
          setGameStatus(`Game Over: ${state.result}`);
          alert(`Game Over: ${state.result}`);
        }
      } catch (error) {
        console.error("Error parsing game state:", error);
      }
    });

    return () => {
      if (moveSubscriptionRef.current) {
        moveSubscriptionRef.current.unsubscribe();
      }
    };
  }, [stompClient, isConnected, matchId]);

  // BLITZ TIMER COUNTDOWN (only for blitz games)
  useEffect(() => {
    if (!isConnected || gameResult || gameType !== 'blitz') return; // Stop timer if not blitz mode

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up! Send timeout to server
          clearInterval(timerRef.current);
          if (stompClient) {
            stompClient.publish({
              destination: `/app/game/${matchId}/timeout`,
              body: JSON.stringify({ matchId })
            });
          }
          setGameStatus("Time's up - Draw!");
          setGameResult({ winner: 'draw', reason: 'timeout' });
          alert("Time expired! Game ends in a draw.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000); // Countdown every second

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isConnected, matchId, stompClient, gameResult, gameType]);

  const addMove = (move) => {
    // Your existing move adding logic
    if (move.piece !== move.piece.toLowerCase()) {
      // White's move
      const newMove = {
        move: move,
        moveToWhite: move.moveTo,
        fen: move.fen,
        tc: `White's Turn: ${move.tc || ''}`,
        tr: move.tr || ''
      };
      setMoves((moves) => [...moves, newMove]);
    } else {
      // Black's move - update last move
      setMoves((prevMoves) => {
        if (prevMoves.length === 0) return prevMoves;

        const newMoves = [...prevMoves];
        const lastMove = {
          ...newMoves[newMoves.length - 1],
          moveToBlack: move.moveTo,
          tc: `Black's Turn: ${move.tc || ''}`,
          tr: move.tr || '',
          fen: move.fen
        };
        newMoves[newMoves.length - 1] = lastMove;
        return newMoves;
      });
    }
  };

  // Function to send move to server
  const sendMove = (moveData) => {
    if (!stompClient || !isConnected) {
      alert("Not connected to server!");
      return false;
    }

    if (!isMyTurn) {
      alert("It's not your turn!");
      return false;
    }

    console.log("Sending move to server:", moveData);

    // Send move via WebSocket
    stompClient.publish({
      destination: `/app/game/${matchId}/move`,
      body: JSON.stringify({
        ...moveData,
        playerColor: playerColor,
        timestamp: new Date().toISOString(),
        matchId: matchId
      })
    });

    // setIsMyTurn(false); // REMOVED: Derived from state
    setGameStatus("Waiting for opponent...");
    return true;
  };

  // Function to handle game actions
  const handleGameAction = (action, data = {}) => {
    if (!stompClient || !isConnected) {
      alert("Not connected to server!");
      return;
    }

    console.log(`Sending ${action} action:`, data);

    stompClient.publish({
      destination: `/app/game/${matchId}/${action}`,
      body: JSON.stringify({
        ...data,
        playerColor: playerColor,
        timestamp: new Date().toISOString(),
        matchId: matchId
      })
    });
  };

  return (
    <div className="game-container">
      {/* Game status bar */}
      <div className="game-status-bar">
        {/* DEBUG BANNER */}
        <div style={{ backgroundColor: '#333', color: '#fff', padding: '5px', fontSize: '10px', textAlign: 'center', lineHeight: '1.2' }}>
          DEBUG: You are <strong>{playerColor}</strong> |
          FEN Turn: <strong>{currentFenTurn}</strong> |
          Can Move: <strong>{isMyTurn ? 'YES' : 'NO'}</strong> |
          Synced: {isConnected ? 'YES' : 'NO'} <br />
          Current FEN: {currentFen ? currentFen.substring(0, 30) + "..." : "NULL"}
        </div>

        <div className="status-info">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span className="player-info">Playing as: <strong>{playerColor}</strong></span>
          <span className="turn-info">{gameStatus}</span>
          <span className="turn-indicator">{isMyTurn ? '✓ Your turn' : '⏳ Opponent\'s turn'}</span>
        </div>

        {/* BLITZ TIMER DISPLAY - Only show for blitz games */}
        {gameType === 'blitz' && (
          <div style={{
            backgroundColor: timeRemaining <= 60 ? '#ff4444' : '#4CAF50',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            minWidth: '120px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            animation: timeRemaining <= 10 ? 'pulse 1s infinite' : 'none'
          }}>
            ⏱️ {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </div>
        )}

        <div className="game-actions">
          <button
            className="btn-action btn-resign"
            onClick={() => {
              if (window.confirm("Are you sure you want to resign?")) {
                handleGameAction('resign');
              }
            }}
          >
            Resign
          </button>
          <button
            className="btn-action btn-draw"
            onClick={() => handleGameAction('draw')}
          >
            Offer Draw
          </button>
        </div>
      </div>

      <BoardLayout
        addMove={addMove}
        sendMove={sendMove}
        opponentMove={opponentMove} // Pass opponent's move down
        playerColor={playerColor}
        isMyTurn={isMyTurn}
        matchId={matchId}
        isConnected={isConnected}
        initialBoard={initialGameData?.board}
      />
      <GamePlayControlContainer
        moves={moves}
        matchId={matchId}
        stompClient={stompClient}
        isConnected={isConnected}
        playerColor={playerColor}
      />
    </div>
  );
};

export default GameContainer;