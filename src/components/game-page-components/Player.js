import React from "react";
import { FaFlag } from "react-icons/fa";  // Use react-icons for flag icon (if needed)
import "../component-styles/Player.css";

const Player = ({ username, rating, country, time }) => {
  return (
    <div className="player">
      {/* Player Name and Rating */}
      <div className="player-info">
        <div className="player-name">
          <span className="piece-icon">♟</span> {username} ({rating})
        </div>
        <div className="player-country">
          <FaFlag size={20} /> {country} {/* Displaying flag icon and country */}
        </div>
      </div>

      {/* Timer */}
      <div className="player-timer">
        <span>{time}</span> {/* Display the timer */}
      </div>
    </div>
  );
};

export default Player;
