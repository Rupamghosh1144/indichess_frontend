import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaFire,
  FaRegHandshake,
  FaRobot,
  FaChessPawn,
  FaTimes
} from "react-icons/fa";
import "../component-styles/GameInfo.css";

const GameInfo = ({ streak }) => {
  const navigate = useNavigate();
  // using string for 'blitz' or 'standard' or null
  const [searchingGameType, setSearchingGameType] = useState(null);
  const [searchTime, setSearchTime] = useState(0);

  const pollingIntervalRef = useRef(null);
  const searchTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const cancelSearch = async () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    try {
      await fetch("http://localhost:8080/game/cancel-waiting", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error cancelling search:", error);
    }

    setSearchingGameType(null);
    setSearchTime(0);
  };

  const pollForMatch = () => {
    let attempts = 0;
    const maxAttempts = 90;

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      setSearchTime(attempts);

      if (attempts >= maxAttempts) {
        cancelSearch();
        alert("Could not find an opponent within 90 seconds.");
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:8080/game/check-match",
          { credentials: "include" }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.matchId > 0) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            clearTimeout(searchTimerRef.current);

            setSearchingGameType(null);
            setSearchTime(0);
            navigate(`/game/${result.matchId}`);
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 1000);
  };

  const createNewGame = async (gameType = "standard") => {
    // If already searching, clicking the SAME button cancels it
    if (searchingGameType === gameType) {
      cancelSearch();
      return;
    }
    // If searching OTHER type, cancel first then start new search (optional, or block)
    if (searchingGameType && searchingGameType !== gameType) {
      // For now, let's just ignore clicks on the other button while searching
      // (The button is disabled in UI, but good to have logic check)
      return;
    }

    setSearchingGameType(gameType);
    setSearchTime(0);

    try {
      const response = await fetch("http://localhost:8080/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gameType }),
      });

      const result = await response.json();

      if (result.matchId === -1) {
        pollForMatch();
        searchTimerRef.current = setTimeout(cancelSearch, 90000);
      } else if (result.matchId > 0) {
        setSearchingGameType(null);
        navigate(`/game/${result.matchId}`);
      } else {
        setSearchingGameType(null);
        alert("Failed to create match.");
      }
    } catch (error) {
      console.error("Create game error:", error);
      setSearchingGameType(null);
    }
  };

  return (
    <div className="game-info">
      {/* Streak */}
      <div className="streak">
        <FaFire size={30} />
        <div>
          <p>Streak</p>
          <h3>{streak} Days</h3>
        </div>
      </div>

      {/* Buttons */}
      <div className="buttons">
        <button
          className={`button ${searchingGameType === 'blitz' ? 'searching' : ''}`}
          onClick={() => createNewGame('blitz')}
          disabled={searchingGameType === 'standard'}
        >
          {searchingGameType === 'blitz' ? (
            <>
              <FaTimes size={20} />
              Cancel ({searchTime}s)
            </>
          ) : (
            <>
              <FaChessPawn size={20} />
              Blitz 10.00 min
            </>
          )}
        </button>

        <button
          className={`button ${searchingGameType === 'standard' ? 'searching' : ''}`}
          onClick={() => createNewGame('standard')}
          disabled={searchingGameType === 'blitz'}
        >
          {searchingGameType === 'standard' ? (
            <>
              <FaTimes size={20} />
              Cancel ({searchTime}s)
            </>
          ) : (
            <>
              <FaChessPawn size={20} />
              New Game
            </>
          )}
        </button>
      </div>

      <button className="button">
        <FaRobot size={20} />
        Play Bots
      </button>

      <button className="button">
        <FaRegHandshake size={20} />
        Play a Friend
      </button>
    </div>
  );
};

export default GameInfo;
