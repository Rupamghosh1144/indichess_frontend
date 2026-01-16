import React from "react";
import SideNav from "../components/SideNav";
import Header from "../components/Header";
import GameInfo from "../components/game-page-components/GameInfo";

const HomePage = () => {
  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/logout", {
        method: "POST",
        credentials: "include", // Important for Cookies
      });

      if (response.ok) {
        // Redirect to login/landing page
        window.location.href = "/";
      } else {
        console.error("Logout failed with status:", response.status);
        // Fallback: force redirect anyway if functionality is key
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error logging out:", error);
      // Fallback
      window.location.href = "/";
    }
  };

  return (
    <div className="app-container">
      <SideNav />
      <div className="main-container">
        {/* Pass handleLogout to Header to render the button there */}
        <Header onLogout={handleLogout} />

        <div className="game-info-container">
          <GameInfo />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
