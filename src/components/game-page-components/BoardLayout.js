import React from "react";
import Player from "./Player";
import Board from "./Board";
import "../component-styles/BoardLayout.css";

const BoardLayout = ({
  addMove,
  sendMove,
  opponentMove, // New prop
  playerColor,
  isMyTurn,
  matchId,
  isConnected,
  initialBoard
}) => {

  return (
    <div className="board-layout-main">
      <Player
        isOpponent={true}
        playerColor={playerColor === 'white' ? 'black' : 'white'}
        matchId={matchId}
      />
      <Board
        addMove={addMove}
        sendMove={sendMove}
        opponentMove={opponentMove} // Pass to Board
        playerColor={playerColor}
        isMyTurn={isMyTurn}
        isConnected={isConnected}
        initialBoard={initialBoard}
      // eslint-disable-next-line
      />
      <Player
        isOpponent={false}
        playerColor={playerColor}
        matchId={matchId}
      />
    </div>
  );
};

export default BoardLayout;