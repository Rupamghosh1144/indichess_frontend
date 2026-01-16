import React, { useState, useEffect, useRef } from "react";
import "../component-styles/Board.css";  // Importing CSS file
import PromotionModal from "../game-page-components/PromotionModal"

// MODIFICATION 1: Update props to include WebSocket functionality
const Board = ({
  addMove,
  // NEW PROPS:
  sendMove,           // Function to send move to server via WebSocket
  opponentMove,       // Move data received from opponent via WebSocket
  playerColor,        // 'white' or 'black' - which color this player is
  isMyTurn,           // Boolean - whether it's currently this player's turn
  isConnected,        // Boolean - WebSocket connection status
  matchId,            // Game match ID
  initialBoard        // Initial board state from server
}) => {
  const [boardSize, setBoardSize] = useState(500); // Initial size of the board
  // Use initialBoard if provided, otherwise default setup
  const [board, setBoard] = useState(initialBoard || [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"]
  ]);  // Initial position of pieces
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [isSquareSelected, setIsSquareSelected] = useState(false);
  const [validMoves, setValidMoves] = useState([]);

  // MODIFICATION 2: Initialize turn based on player color and isMyTurn
  const [isWhiteTurn, setIsWhiteTurn] = useState(
    playerColor === 'white' ? isMyTurn : !isMyTurn
  );

  // piece, prow, pcol, arow, acol
  const [allMoves, setAllMoves] = useState([]);
  const [prevAllMoves, setPrevAllMoves] = useState([]);

  const [blackKingCoordinates, setBlackKingCoordinates] = useState([0, 4]);
  const [whiteKingCoordinates, setWhiteKingCoordinates] = useState([7, 4]);
  const boardRef = useRef(null);
  const [prevMove, setPrevMove] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [promotingPawn, setPromotingPawn] = useState(null);
  // isKingInCheckHook[0] --> white king's check state
  // isKingInCheckHook[1] --> black king's check state
  const [isKingInCheckHook, setIsKingInCheckHook] = useState([false, false]);
  // castling hooks
  // kingsMoved[0] --> signifies white's king movement
  // kingsMoved[1] --> signifies black's king movement
  const [kingsMoved, setKingsMoved] = useState([false, false]);

  // rooksMoved[0] --> signifies white's king side rook's movement
  // rooksMoved[1] --> signifies white's Queen side rook's movement
  // rooksMoved[2] --> signifies black's king side rook's movement
  // rooksMoved[3] --> signifies black's queen side rook's movement
  const [rooksMoved, setRooksMoved] = useState([false, false, false, false]);

  // MODIFICATION 3: Add state for opponent's move
  const [lastOpponentMove, setLastOpponentMove] = useState(null);

  // Handle window resize
  const updateBoardSize = () => {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.6;  // 60% of the viewport size
    setBoardSize(size);
  };

  useEffect(() => {
    updateBoardSize();  // Set initial size
    window.addEventListener("resize", updateBoardSize);

    return () => {
      window.removeEventListener("resize", updateBoardSize);
    };
  }, []);

  useEffect(() => {
    const testElement = document.createElement('div');
    testElement.draggable = true;

    testElement.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('test', 'hello');
      console.log("Data set:", e.dataTransfer.getData('test'));
    });

    testElement.addEventListener('dragend', (e) => {
      console.log("Can get data after drag?", e.dataTransfer.getData('test'));
    });
  }, []);

  // MODIFICATION 4: Update turn when isMyTurn changes
  useEffect(() => {
    if (playerColor === 'white') {
      setIsWhiteTurn(isMyTurn);
    } else {
      setIsWhiteTurn(!isMyTurn);
    }
  }, [isMyTurn, playerColor]);

  useEffect(() => {
    getMovesOfPlayer();
  }, [isWhiteTurn, board]);

  // MODIFICATION 5: Handle opponent's move from WebSocket
  // Update the validation in useEffect or applyOpponentMove:
  useEffect(() => {
    if (opponentMove && opponentMove !== lastOpponentMove) {
      console.log("📥 New opponent move received:", opponentMove);

      // Accept BOTH structures:
      // 1. Nested: opponentMove.from && opponentMove.to
      // 2. Flat: opponentMove.fromRow !== undefined && opponentMove.fromCol !== undefined

      const hasNestedStructure = opponentMove.from && opponentMove.to;
      const hasFlatStructure = opponentMove.fromRow !== undefined && opponentMove.fromCol !== undefined &&
        opponentMove.toRow !== undefined && opponentMove.toCol !== undefined;

      if (!hasNestedStructure && !hasFlatStructure) {
        console.error("❌ Invalid opponent move structure:", opponentMove);
        return;
      }

      // Check if this is actually opponent's move (not our own echo)
      if (opponentMove.playerColor === playerColor) {
        console.log("👤 Ignoring own move (echo)");
        return;
      }

      console.log(`👤 Processing opponent's (${opponentMove.playerColor}) move`);
      applyOpponentMove(opponentMove);
      setLastOpponentMove(opponentMove);
    }
  }, [opponentMove]);

  const applyOpponentMove = (moveData) => {
    console.log("📬 Applying opponent move:", moveData);

    // Check if moveData is valid
    if (!moveData) {
      console.error("❌ moveData is undefined");
      return;
    }

    // Check for BOTH possible structures:
    // 1. Flat fields: fromRow, fromCol, toRow, toCol (what backend sends)
    // 2. Nested objects: from: {row, col}, to: {row, col} (what you expect)

    let from, to;

    if (moveData.from && moveData.to) {
      // Structure 2: Nested objects
      from = moveData.from;
      to = moveData.to;
      console.log("📋 Using nested object structure");
    } else if (moveData.fromRow !== undefined && moveData.fromRow !== null &&
      moveData.fromCol !== undefined && moveData.fromCol !== null &&
      moveData.toRow !== undefined && moveData.toRow !== null &&
      moveData.toCol !== undefined && moveData.toCol !== null) {
      // Structure 1: Flat fields
      from = { row: moveData.fromRow, col: moveData.fromCol };
      to = { row: moveData.toRow, col: moveData.toCol };
      console.log("📋 Using flat field structure");
    } else {
      console.error("❌ Invalid move data structure - missing coordinates:", moveData);
      return;
    }

    const { piece, promotedTo, capturedPiece, castled, isPromotion, isEnPassant, board: newBoardFromData } = moveData;

    // Validate coordinates
    if (from.row === undefined || from.col === undefined ||
      to.row === undefined || to.col === undefined) {
      console.error("❌ Invalid coordinates:", { from, to });
      return;
    }

    console.log(`🎯 Opponent move: ${piece} from [${from.row},${from.col}] to [${to.row},${to.col}]`);

    // OPTION 1: If board is provided in moveData, use it directly (simpler and more reliable)
    if (newBoardFromData && Array.isArray(newBoardFromData) && newBoardFromData.length === 8) {
      console.log("✅ Using board from move data");
      setBoard(newBoardFromData);

      // Update king coordinates based on new board
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (newBoardFromData[row][col] === 'K') {
            setWhiteKingCoordinates([row, col]);
          } else if (newBoardFromData[row][col] === 'k') {
            setBlackKingCoordinates([row, col]);
          }
        }
      }

    } else {
      // OPTION 2: Apply move manually to current board
      console.log("⚠️ No board in move data, applying move manually");
      // DEEP COPY to avoid state mutation issues
      const newBoard = board.map(row => [...row]);
      const fenBefore = convertBoardToFEN(board);

      // Handle promotion
      if (isPromotion && promotedTo) {
        console.log(`♟️ Promotion to: ${promotedTo}`);
        newBoard[to.row][to.col] = promotedTo;
      } else {
        newBoard[to.row][to.col] = piece;
      }

      newBoard[from.row][from.col] = "";

      // Handle en passant capture
      if (isEnPassant) {
        console.log("⚡ En passant capture");
        if (piece === 'p') {
          newBoard[to.row - 1][to.col] = "";
        } else if (piece === 'P') {
          newBoard[to.row + 1][to.col] = "";
        }
      }

      // Handle castling
      if (castled) {
        console.log("🏰 Castling move");
        if (piece === 'K') {
          if (to.col === 6) { // Short castle
            newBoard[7][5] = 'R';
            newBoard[7][7] = "";
          } else if (to.col === 2) { // Long castle
            newBoard[7][3] = 'R';
            newBoard[7][0] = "";
          }
        } else if (piece === 'k') {
          if (to.col === 6) { // Short castle
            newBoard[0][5] = 'r';
            newBoard[0][7] = "";
          } else if (to.col === 2) { // Long castle
            newBoard[0][3] = 'r';
            newBoard[0][0] = "";
          }
        }
      }

      // Update board
      setBoard(newBoard);

      // Update king coordinates
      if (piece === 'K') {
        setWhiteKingCoordinates([to.row, to.col]);
      } else if (piece === 'k') {
        setBlackKingCoordinates([to.row, to.col]);
      }

      // Update castling rights
      if (piece === 'K') {
        setKingsMoved([true, kingsMoved[1]]);
      } else if (piece === 'k') {
        setKingsMoved([kingsMoved[0], true]);
      }

      // Update rooks moved
      if (piece === 'R') {
        if (from.row === 7) {
          if (from.col === 0) setRooksMoved([rooksMoved[0], true, rooksMoved[2], rooksMoved[3]]);
          else if (from.col === 7) setRooksMoved([true, rooksMoved[1], rooksMoved[2], rooksMoved[3]]);
        }
      } else if (piece === 'r') {
        if (from.row === 0) {
          if (from.col === 0) setRooksMoved([rooksMoved[0], rooksMoved[1], rooksMoved[2], true]);
          else if (from.col === 7) setRooksMoved([rooksMoved[0], rooksMoved[1], true, rooksMoved[3]]);
        }
      }
    }

    // Update move history locally
    const moveNotation = moveData.moveNotation || createMoveNotation(from, to, piece, capturedPiece, castled, board);
    const fenAfter = moveData.fenAfter || convertBoardToFEN(board);
    const fenBefore = moveData.fenBefore || convertBoardToFEN(board);

    // Add to move history
    const moveToAdd = {
      piece,
      moveFrom: `${String.fromCharCode('a'.charCodeAt(0) + from.col)}${8 - from.row}`,
      moveTo: `${String.fromCharCode('a'.charCodeAt(0) + to.col)}${8 - to.row}`,
      sqnumfrom: 8 - from.row,
      sqnumto: 8 - to.row,
      tc: to.col,
      tr: to.row,
      fenBefore,
      fenAfter,
      createdAt: new Date().toISOString(),
      isOpponentMove: true,
      playerColor: moveData.playerColor || 'unknown'
    };

    addMove(moveToAdd);

    // Update turn locally
    setIsWhiteTurn(!isWhiteTurn);

    console.log("✅ Opponent move applied successfully");
  };

  // Helper function to create move notation (if not provided)
  const createMoveNotation = (from, to, piece, capturedPiece, castled, board) => {
    if (castled) {
      return to.col === 6 ? "O-O" : "O-O-O";
    }

    const fromSquare = `${String.fromCharCode('a'.charCodeAt(0) + from.col)}${8 - from.row}`;
    const toSquare = `${String.fromCharCode('a'.charCodeAt(0) + to.col)}${8 - to.row}`;

    const pieceSymbol = piece.toUpperCase();
    if (piece === 'p' || piece === 'P') {
      if (capturedPiece) {
        return `${fromSquare[0]}x${toSquare}`;
      }
      return toSquare;
    }

    return `${pieceSymbol}${capturedPiece ? 'x' : ''}${toSquare}`;
  };

  // MODIFICATION 7: Helper function to create move notation
  // const createMoveNotation = (from, to, piece, capturedPiece, castled, newBoard) => {
  //   const fromNotation = `${String.fromCharCode('a'.charCodeAt(0) + from.col)}${8-from.row}`;
  //   const toNotation = `${String.fromCharCode('a'.charCodeAt(0) + to.col)}${8-to.row}`;

  //   if (castled) {
  //     return to.col === 6 ? "O-O" : "O-O-O";
  //   }

  //   if (capturedPiece) {
  //     return `${piece.toLowerCase() === 'p' ? fromNotation[0] : piece}x${toNotation}`;
  //   }

  //   return `${piece.toLowerCase() === 'p' ? '' : piece}${toNotation}`;
  // };

  // ALL YOUR EXISTING FUNCTIONS - KEPT EXACTLY AS IS
  const getPieceIcon = (piece) => {
    switch (piece) {
      case 'r': return '♜';
      case 'n': return '♞';
      case 'b': return '♝';
      case 'q': return '♛';
      case 'k': return '♚';
      case 'p': return '♟';
      case 'R': return '♖';
      case 'N': return '♘';
      case 'B': return '♗';
      case 'Q': return '♕';
      case 'K': return '♔';
      case 'P': return '♙';
      default: return '';
    }
  };

  function isUpperCase(str) {
    return str === str.toUpperCase();
  }

  const canCastleGeneral = () => {
    if ((isWhiteTurn && isKingInCheckHook[0]) || (!isWhiteTurn && isKingInCheckHook[1])
      ||
      (isWhiteTurn && kingsMoved[0]) || (!isWhiteTurn && kingsMoved[1])) return false;
    return true;
  };

  const canCastleLong = () => {
    let ind = -1;
    if (isWhiteTurn) ind = 1;
    else if (!isWhiteTurn) ind = 3;

    if (isWhiteTurn) {
      if (rooksMoved[ind]) return false;
    } else {
      if (rooksMoved[ind]) return false;
    }
    return true;
  }

  const canCastleShort = () => {
    let ind = -1;
    if (isWhiteTurn) ind = 0;
    else if (!isWhiteTurn) ind = 2;

    if (isWhiteTurn) {
      if (rooksMoved[ind]) return false;
    } else {
      if (rooksMoved[ind]) return false;
    }
    return true;
  }

  const isSquareUnderAttack = (row, col) => {
    for (let i = 0; i < allMoves.length; i++) {
      const [piece, prow, pcol, arow, acol] = allMoves[i];
      if (arow === row && acol === col) {
        return true;
      }
    }
    return false;
  };

  const getValidMoves = (piece, row, col) => {
    // ... (YOUR EXISTING getValidMoves FUNCTION - KEEP EXACTLY AS IS)
    const moves = [];
    // if king is in check only king moves or capture is available
    switch (piece.toLowerCase()) {
      case "p":
        // ... (your existing pawn logic)
        const direction = piece === "p" ? 1 : -1;
        if (board[row + direction]) {
          if (board[row + direction][col] == "")
            moves.push([piece, row, col, row + direction, col]);
          if (col - 1 >= 0) {
            if (piece === "p" && board[row + direction][col - 1] != "" && isUpperCase(board[row + direction][col - 1])) {
              moves.push([piece, row, col, row + direction, col - 1]);
            }
            else if (piece === "P" && board[row + direction][col - 1] != "" && !isUpperCase(board[row + direction][col - 1])) {
              moves.push([piece, row, col, row + direction, col - 1]);
            }
          }
          if (col + 1 < 8) {
            if (piece === "p" && board[row + direction][col + 1] != "" && isUpperCase(board[row + direction][col + 1])) {
              moves.push([piece, row, col, row + direction, col + 1]);
            }
            else if (piece === "P" && board[row + direction][col + 1] != "" && !isUpperCase(board[row + direction][col + 1])) {
              moves.push([piece, row, col, row + direction, col + 1]);
            }
          }
        }
        if ((row == 1 && piece === "p" && board[row + 2 * direction][col] == "" && board[row + direction][col] == "")
          || (row == 6 && piece === "P" && board[row + 2 * direction][col] == "" && board[row + direction][col] == ""))
          moves.push([piece, row, col, row + 2 * direction, col]);

        if ((row === 3 && piece === "P" && prevMove.piece === "p" &&
          Math.abs(prevMove.sqnumfrom - prevMove.sqnumto) === 2 && Math.abs(col - prevMove.tc) === 1)
          ||
          (row === 4 && piece === "p" && prevMove.piece === "P" &&
            Math.abs(prevMove.sqnumfrom - prevMove.sqnumto) === 2 && Math.abs(col - prevMove.tc) === 1)
        )
          moves.push([piece, row, col, row + direction, prevMove.tc]);

        break;

      case "r":
        // ... (your existing rook logic)
        let forwardMotion = true, backwardMotion = true, leftMotion = true, rightMotion = true;
        for (let i = 1; i < 8; i++) {
          if (forwardMotion && row + i < 8 && board[row + i][col] == "") moves.push([piece, row, col, row + i, col]);
          else if (forwardMotion && row + i < 8 && board[row + i][col] != "") {
            let rook = board[row][col];
            let attackPoint = board[row + i][col];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row + i, col]);
            forwardMotion = false;
          }
          if (backwardMotion && row - i >= 0 && board[row - i][col] == "") moves.push([piece, row, col, row - i, col]);
          else if (backwardMotion && row - i >= 0 && board[row - i][col] != "") {
            let rook = board[row][col];
            let attackPoint = board[row - i][col];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row - i, col]);
            backwardMotion = false;
          }
          if (rightMotion && col + i < 8 && !board[row][col + i]) moves.push([piece, row, col, row, col + i]);
          else if (rightMotion && col + i < 8 && board[row][col + i] != "") {
            let rook = board[row][col];
            let attackPoint = board[row][col + i];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row, col + i]);
            rightMotion = false;
          }
          if (leftMotion && col - i >= 0 && !board[row][col - i]) moves.push([piece, row, col, row, col - i]);
          else if (leftMotion && col - i >= 0 && board[row][col - i] != "") {
            let rook = board[row][col];
            let attackPoint = board[row][col - i];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row, col - i]);
            leftMotion = false;
          }
          if (!forwardMotion && !backwardMotion && !leftMotion && !rightMotion) break;
        }
        break;

      case "n":
        // ... (your existing knight logic)
        const knightMoves = [
          [-2, -1], [-2, 1], [2, -1], [2, 1],
          [-1, -2], [1, -2], [-1, 2], [1, 2]
        ];
        knightMoves.forEach(([r, c]) => {
          if (row + r >= 0 && row + r < 8 && col + c >= 0 && col + c < 8) {
            let knight = board[row][col];
            let attackPoint = board[row + r][col + c];
            if (attackPoint == "" ||
              (isUpperCase(knight) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(knight) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row + r, col + c]);
          }
        });
        break;

      case "k":
        // ... (your existing king logic)
        const kingMoves = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1], [0, 1],
          [1, -1], [1, 0], [1, 1]
        ];
        kingMoves.forEach(([r, c]) => {
          if (row + r >= 0 && row + r < 8 && col + c >= 0 && col + c < 8) {
            let king = board[row][col];
            let attackPoint = board[row + r][col + c];
            if (attackPoint === "" ||
              (isUpperCase(king) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(king) && isUpperCase(attackPoint)))
              if (!isSquareUnderAttack(row + r, col + c))
                moves.push([piece, row, col, row + r, col + c]);
          }
        });
        if (canCastleGeneral()) {
          if (canCastleShort() && board[row][5] === "" && board[row][6] === ""
            && !isSquareUnderAttack(row, 5) && !isSquareUnderAttack(row, 6)
          )
            moves.push([piece, row, col, row, 6]);
          if (canCastleLong() && board[row][3] === "" && board[row][2] === "" && board[row][1] === ""
            && !isSquareUnderAttack(row, 3) && !isSquareUnderAttack(row, 2)
          ) {
            moves.push([piece, row, col, row, 2]);
          }
        }
        break;

      case "b":
        // ... (your existing bishop logic)
        let tleftdiag = true, trightdiag = true,
          bleftdiag = true, brightdiag = true;

        for (let i = 1; i < 8; i++) {
          if (tleftdiag && row - i >= 0 && col - i >= 0 && !board[row - i][col - i]) moves.push([piece, row, col, row - i, col - i]);
          else if (tleftdiag && row - i >= 0 && col - i >= 0 && board[row - i][col - i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row - i][col - i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row - i, col - i]);
            tleftdiag = false;
          }
          if (trightdiag && row - i >= 0 && col + i < 8 && !board[row - i][col + i]) moves.push([piece, row, col, row - i, col + i]);
          else if (trightdiag && row - i >= 0 && col + i < 8 && board[row - i][col + i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row - i][col + i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row - i, col + i]);
            trightdiag = false;
          }
          if (bleftdiag && row + i < 8 && col - i >= 0 && !board[row + i][col - i]) moves.push([piece, row, col, row + i, col - i]);
          else if (bleftdiag && row + i < 8 && col - i >= 0 && board[row + i][col - i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row + i][col - i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row + i, col - i]);
            bleftdiag = false;
          }
          if (brightdiag && row + i < 8 && col + i < 8 && !board[row + i][col + i]) moves.push([piece, row, col, row + i, col + i]);
          else if (brightdiag && row + i < 8 && col + i < 8 && board[row + i][col + i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row + i][col + i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row + i, col + i]);
            brightdiag = false;
          }
        }
        break;

      case "q":
        // ... (your existing queen logic)
        let qforwardMotion = true, qbackwardMotion = true, qleftMotion = true, qrightMotion = true;
        for (let i = 1; i < 8; i++) {
          if (qforwardMotion && row + i < 8 && board[row + i][col] == "") moves.push([piece, row, col, row + i, col]);
          else if (qforwardMotion && row + i < 8 && board[row + i][col] != "") {
            let rook = board[row][col];
            let attackPoint = board[row + i][col];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row + i, col]);
            qforwardMotion = false;
          }
          if (qbackwardMotion && row - i >= 0 && board[row - i][col] == "") moves.push([piece, row, col, row - i, col]);
          else if (qbackwardMotion && row - i >= 0 && board[row - i][col] != "") {
            let rook = board[row][col];
            let attackPoint = board[row - i][col];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row - i, col]);
            qbackwardMotion = false;
          }
          if (qrightMotion && col + i < 8 && !board[row][col + i]) moves.push([piece, row, col, row, col + i]);
          else if (qrightMotion && col + i < 8 && board[row][col + i] != "") {
            let rook = board[row][col];
            let attackPoint = board[row][col + i];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row, col + i]);
            qrightMotion = false;
          }
          if (qleftMotion && col - i >= 0 && !board[row][col - i]) moves.push([piece, row, col, row, col - i]);
          else if (qleftMotion && col - i >= 0 && board[row][col - i] != "") {
            let rook = board[row][col];
            let attackPoint = board[row][col - i];
            if ((isUpperCase(rook) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(rook) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row, col - i]);
            qleftMotion = false;
          }
          if (!qforwardMotion && !qbackwardMotion && !qleftMotion && !qrightMotion) break;
        }
        let qtleftdiag = true, qtrightdiag = true,
          qbleftdiag = true, qbrightdiag = true;

        for (let i = 1; i < 8; i++) {
          if (qtleftdiag && row - i >= 0 && col - i >= 0 && !board[row - i][col - i]) moves.push([piece, row, col, row - i, col - i]);
          else if (qtleftdiag && row - i >= 0 && col - i >= 0 && board[row - i][col - i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row - i][col - i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row - i, col - i]);
            qtleftdiag = false;
          }
          if (qtrightdiag && row - i >= 0 && col + i < 8 && !board[row - i][col + i]) moves.push([piece, row, col, row - i, col + i]);
          else if (qtrightdiag && row - i >= 0 && col + i < 8 && board[row - i][col + i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row - i][col + i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row - i, col + i]);
            qtrightdiag = false;
          }
          if (qbleftdiag && row + i < 8 && col - i >= 0 && !board[row + i][col - i]) moves.push([piece, row, col, row + i, col - i]);
          else if (qbleftdiag && row + i < 8 && col - i >= 0 && board[row + i][col - i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row + i][col - i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row + i, col - i]);
            qbleftdiag = false;
          }
          if (qbrightdiag && row + i < 8 && col + i < 8 && !board[row + i][col + i]) moves.push([piece, row, col, row + i, col + i]);
          else if (qbrightdiag && row + i < 8 && col + i < 8 && board[row + i][col + i] != "") {
            let bishop = board[row][col];
            let attackPoint = board[row + i][col + i];
            if ((isUpperCase(bishop) && !isUpperCase(attackPoint)) ||
              (!isUpperCase(bishop) && isUpperCase(attackPoint)))
              moves.push([piece, row, col, row + i, col + i]);
            qbrightdiag = false;
          }
        }
        break;

      default:
        break;
    }

    return moves;
  };

  const filterFromAllMoves = (piece, row, col) => {
    const filteredMovesOfPiece = [];
    for (let i = 0; i < allMoves.length; i++) {
      const [movePiece, movePieceRow, movePieceCol,
        movePieceAttackRow, movePieceAttackCol] = allMoves[i];

      if (movePiece === piece && movePieceRow === row && movePieceCol === col) {
        filteredMovesOfPiece.push([movePieceAttackRow, movePieceAttackCol]);
      }
    }

    return filteredMovesOfPiece;
  }

  // MODIFICATION 8: Update handleSquareClick with connection check
  const handleSquareClick = (row, col) => {
    // Check if connected and it's our turn
    if (!isConnected) {
      alert("Not connected to server!");
      return;
    }

    if (!isMyTurn) {
      alert("It's not your turn!");
      return;
    }

    const piece = board[row][col];
    if (isSquareSelected && selectedSquare[0] === row && selectedSquare[1] === col) {
      setSelectedSquare([]);
      setIsSquareSelected(false);
      setValidMoves([]);
      return;
    }
    if (!piece || (isWhiteTurn && !isUpperCase(piece)) || (!isWhiteTurn && isUpperCase(piece))) return;
    setIsSquareSelected(true);
    setSelectedSquare([row, col]);
    setValidMoves(filterFromAllMoves(piece, row, col));
  };

  // MODIFICATION 9: Update handleDragStart with connection check
  const handleDragStart = (e, row, col) => {
    // Check if connected and it's our turn
    if (!isConnected || !isMyTurn) {
      e.preventDefault();
      return;
    }

    const piece = board[row][col];
    if (!piece || (isWhiteTurn && !isUpperCase(piece)) || (!isWhiteTurn && isUpperCase(piece))) {
      e.preventDefault();
      return;
    }

    setIsSquareSelected(true);
    setSelectedSquare([row, col]);
    setValidMoves(filterFromAllMoves(piece, row, col));
    e.dataTransfer.setData("piece", piece);
    e.dataTransfer.setData("fromRow", row);
    e.dataTransfer.setData("fromCol", col);
  };

  const isKingInCheck = () => {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if ((isWhiteTurn && isUpperCase(piece)) || (!isWhiteTurn && !isUpperCase(piece))) {
          const kingRow = isWhiteTurn ? blackKingCoordinates[0] : whiteKingCoordinates[0];
          const kingCol = isWhiteTurn ? blackKingCoordinates[1] : whiteKingCoordinates[1];
          const moves = getValidMoves(piece, i, j);
          if (moves.some(([alpha, beta, gamma, r, c]) => r === kingRow && c === kingCol)) {
            if (isWhiteTurn) {
              setIsKingInCheckHook(prevState => [prevState[0], true]);
            } else {
              setIsKingInCheckHook(prevState => [true, prevState[1]]);
            }
            console.log(isKingInCheckHook[0]);
            return true;
          }
        }
      }
    }
    return false;
  }

  const convertBoardToFEN = (board, activeColor) => {
    const rows = [];
    for (let row of board) {
      let rowStr = '';
      let emptyCount = 0;

      for (let square of row) {
        if (square === '') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount;
            emptyCount = 0;
          }
          rowStr += square;
        }
      }

      if (emptyCount > 0) {
        rowStr += emptyCount;
      }

      rows.push(rowStr);
    }

    const boardFEN = rows.join('/');
    // activeColor is now passed as parameter - caller decides if it's current or next turn
    const castlingRights = 'KQkq';
    const enPassant = '-';
    const halfMoveClock = 0;
    const fullMoveNumber = 1;

    const fen = `${boardFEN} ${activeColor} ${castlingRights} ${enPassant} ${halfMoveClock} ${fullMoveNumber}`;

    return fen;
  };

  const updatePrevMove = (fr, fc, tr, tc, piece, capturedPiece, castled, fenBefore) => {
    const sqnumfrom = 8 - fr;
    const sqnumto = 8 - tr;
    let moveFrom = String.fromCharCode('a'.charCodeAt(0) + fc);
    let moveTo = String.fromCharCode('a'.charCodeAt(0) + tc);

    if (castled) {
      if (tc === 2) {
        moveTo = "O-O-O";
        if (fr === 0) {
          setRooksMoved([rooksMoved[0], rooksMoved[1], rooksMoved[2], true]);
          setKingsMoved([kingsMoved[0], true]);
        }
        else if (fr === 7) {
          setRooksMoved([rooksMoved[0], true, rooksMoved[2], rooksMoved[3]]);
          setKingsMoved([true, kingsMoved[1]]);
        }
      }
      else {
        moveTo = "O-O";
        if (fr === 0) {
          setRooksMoved([rooksMoved[0], rooksMoved[1], rooksMoved[2], true]);
          setKingsMoved([kingsMoved[0], true]);
        }
        else if (fr === 7) {
          setRooksMoved([rooksMoved[0], rooksMoved[1], true, rooksMoved[3]]);
          setKingsMoved([true, kingsMoved[1]]);
        }
      }
    }
    else {
      if (capturedPiece === "") {
        moveFrom += sqnumfrom;
        moveTo = "" + (piece.toLowerCase() === "p" ? "" : piece) + moveTo + sqnumto;
      }
      else {
        moveTo = (piece.toLowerCase() === "p" ? moveFrom : piece) + "x" + moveTo + sqnumto;
        moveFrom += sqnumfrom;
      }
    }

    if (isKingInCheck()) {
      moveTo += "+";
    }
    else {
      setIsKingInCheckHook([false, false]);
    }

    const fenAfter = convertBoardToFEN(board);
    const createdAt = new Date().toISOString();
    setPrevMove({ piece, moveFrom, moveTo, sqnumfrom, sqnumto, tc, tr });

    // MODIFICATION 10: Add move to local history
    addMove({ piece, moveFrom, moveTo, sqnumfrom, sqnumto, tc, tr, fenBefore, fenAfter, createdAt });

    // after effects
    if (piece === "R" && fc === 0) {
      setRooksMoved([rooksMoved[0], true, rooksMoved[2], rooksMoved[3]]);
    }
    else if (piece === "R" && fc === 7) {
      setRooksMoved([true, rooksMoved[1], rooksMoved[2], rooksMoved[3]]);
    }
    else if (piece === "r" && fc === 0) {
      setRooksMoved([rooksMoved[0], rooksMoved[1], rooksMoved[2], true]);
    }
    else if (piece === "r" && fc === 7) {
      setRooksMoved([rooksMoved[0], rooksMoved[1], true, rooksMoved[3]]);
    }

    if (piece === "K") {
      setKingsMoved([true, kingsMoved[1]]);
      setWhiteKingCoordinates([tr, tc]);
    }
    else if (piece === "k") {
      setKingsMoved([kingsMoved[0], true]);
      setBlackKingCoordinates([tr, tc]);
    }
  }

  // MODIFICATION 11: Update handlePromotion to send move to server
  const handlePromotion = (promotionPiece) => {
    const [row, col, piece, fromRow, fromCol, capturedPiece, fenBefore, castled, isEnPassant] = promotingPawn;

    const promotedPiece = (row === 7) ? promotionPiece.toLowerCase() : promotionPiece.toUpperCase();

    // DEEP COPY
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = promotedPiece;
    newBoard[fromRow][fromCol] = "";

    setBoard(newBoard);

    // Update move locally
    updatePrevMove(fromRow, fromCol, row, col, piece, capturedPiece, castled, fenBefore);

    // MODIFICATION 12: Prepare and send move data to server
    const moveData = {
      from: { row: fromRow, col: fromCol },
      to: { row: row, col: col },
      piece: piece,
      promotedTo: promotedPiece,
      capturedPiece: capturedPiece,
      castled: castled,
      isEnPassant: isEnPassant,
      fenBefore: fenBefore,
      fenAfter: convertBoardToFEN(newBoard),
      board: newBoard,
      timestamp: new Date().toISOString(),
      isWhiteTurn: isWhiteTurn,
      isPromotion: true,
      matchId: matchId,
      playerColor: playerColor
    };

    // Send move to server via WebSocket
    if (sendMove) {
      const success = sendMove(moveData);
      if (!success) {
        console.error("Failed to send promotion move to server");
      }
    }

    setIsWhiteTurn(!isWhiteTurn);
    setShowModal(false);
  };

  const getMovesOfPlayer = () => {
    setPrevAllMoves(allMoves);
    setAllMoves([]);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && ((isUpperCase(piece) && isWhiteTurn) || (!isUpperCase(piece) && !isWhiteTurn))) {
          const newMoves = getValidMoves(piece, i, j);
          setAllMoves((moves) => [...moves, ...newMoves]);
        }
      }
    }
  }

  // MODIFICATION 13: Update handleDrop to send move to server
  const handleDrop = (e, row, col) => {
    // Check connection and turn
    if (!isConnected) {
      alert("Not connected to server!");
      return;
    }

    if (!isMyTurn) {
      alert("It's not your turn!");
      return;
    }

    let piece = e.dataTransfer.getData("piece");
    const fromRow = parseInt(e.dataTransfer.getData("fromRow"));
    const fromCol = parseInt(e.dataTransfer.getData("fromCol"));
    const fenBefore = convertBoardToFEN(board, isWhiteTurn ? 'w' : 'b');
    // DEEP COPY to prevent state mutation
    const newBoard = board.map(r => [...r]);
    let capturedPiece = newBoard[row][col];
    let castled = false;
    let isEnPassant = false;

    if (validMoves.some(([r, c]) => r === row && c === col)) {
      // enpassant capture
      if (piece.toLowerCase() === "p" && capturedPiece === "" && Math.abs(col - fromCol) === 1) {
        isEnPassant = true;
        if (piece === "p") {
          capturedPiece = newBoard[row - 1][col];
          newBoard[row - 1][col] = "";
        }
        else {
          capturedPiece = newBoard[row + 1][col];
          newBoard[row + 1][col] = "";
        }
      }

      // promotion
      if (piece === "p" && row === 7) {
        setPromotingPawn([row, col, piece, fromRow, fromCol, capturedPiece, fenBefore, castled, isEnPassant]);
        setShowModal(true);
        setIsSquareSelected(false);
        setSelectedSquare([]);
        setValidMoves([]);
        return;
      } else if (piece === "P" && row === 0) {
        setPromotingPawn([row, col, piece, fromRow, fromCol, capturedPiece, fenBefore, castled, isEnPassant]);
        setShowModal(true);
        setIsSquareSelected(false);
        setSelectedSquare([]);
        setValidMoves([]);
        return;
      }

      // castling logic
      if (piece.toLowerCase() === "k" && Math.abs(col - fromCol) === 2) {
        castled = true;
        // white short castle
        if (piece === "K" && col === 6) {
          const rook = newBoard[row][7];
          newBoard[row][7] = "";
          newBoard[row][5] = rook;
        }
        // white long castle
        if (piece === "K" && col === 2) {
          const rook = newBoard[row][0];
          newBoard[row][0] = "";
          newBoard[row][3] = rook;
        }
        // black short castle
        if (piece === "k" && col === 6) {
          const rook = newBoard[row][7];
          newBoard[row][7] = "";
          newBoard[row][5] = rook;
        }
        // black long castle
        if (piece === "k" && col === 2) {
          const rook = newBoard[row][0];
          newBoard[row][0] = "";
          newBoard[row][3] = rook;
        }
      }

      newBoard[row][col] = piece;
      newBoard[fromRow][fromCol] = "";
      setBoard(newBoard);

      // Update move locally
      updatePrevMove(fromRow, fromCol, row, col, piece, capturedPiece, castled, fenBefore);

      // MODIFICATION 14: Prepare and send move data to server
      // In handleDrop or wherever you prepare moveData:
      const moveData = {
        // Change from nested objects to flat fields:
        fromRow: fromRow,     // was: from: {row: 6, col: 4}
        fromCol: fromCol,
        toRow: row,         // was: to: {row: 4, col: 4}
        toCol: col,

        piece: piece,
        capturedPiece: capturedPiece || "",
        castled: castled || false,
        isEnPassant: isEnPassant || false,
        isPromotion: false,
        fenBefore: fenBefore,
        fenAfter: convertBoardToFEN(newBoard, isWhiteTurn ? 'b' : 'w'),
        board: newBoard,
        isWhiteTurn: isWhiteTurn,
        playerColor: playerColor,
        matchId: matchId,  // This was undefined in your log! Fix this too!
        timestamp: new Date().toISOString()
      };

      // Make sure matchId is defined
      console.log("matchId in moveData:", moveData.matchId);

      // Send move to server via WebSocket
      if (sendMove) {
        const success = sendMove(moveData);
        if (!success) {
          console.error("Failed to send move to server");
        }
      }

      setIsWhiteTurn(!isWhiteTurn);
    }
    setIsSquareSelected(false);
    setSelectedSquare([]);
    setValidMoves([]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="chessboard-container">
      {/* MODIFICATION 15: Add connection status indicator */}
      <div className="connection-indicator">
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢' : '🔴'}
        </span>
        <span className="status-text">
          {isConnected ? 'Connected' : 'Disconnected'} |
          {isMyTurn ? ' Your turn' : ' Opponent\'s turn'} |
          Playing as: <strong>{playerColor}</strong>
        </span>
      </div>

      <div
        ref={boardRef}
        className="chessboard"
        style={{ width: boardSize, height: boardSize }}
      >
        {/* Render the board */}
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((piece, colIndex) => (
              <div
                key={colIndex}
                className={`square ${((rowIndex + colIndex) % 2 === 0) ? 'light' : 'dark'}`}
                style={{ width: `${100 / 8}%` }}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
                onDragStart={(e) => handleDragStart(e, rowIndex, colIndex)}
                onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                onDragOver={handleDragOver}
                draggable={piece !== "" && isConnected && isMyTurn}  // MODIFICATION 16: Update draggable condition
              >
                {getPieceIcon(piece)}
                {validMoves.some(([r, c]) => r === rowIndex && c === colIndex) && (
                  <div className="valid-move-overlay"></div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <PromotionModal
        showModal={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handlePromotion}
      />
    </div>
  );
};

export default Board;