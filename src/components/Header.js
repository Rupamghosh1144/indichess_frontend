import React from "react";
import { FaUser, FaRegEnvelope, FaCog } from "react-icons/fa";  // Import icons
import "./component-styles/Header.css";

const Header = ({ username, onLogout }) => {
  return (
    <div className="header">
      {/* Left side: Hello User */}
      <div className="left">
        <p>Hello, User {username || ""}</p>
      </div>

      {/* Right side: Icons */}
      <div className="right">
        {onLogout && (
          <button
            onClick={onLogout}
            className="logout-button"
            style={{
              marginRight: '15px',
              padding: '5px 10px',
              cursor: 'pointer',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            Logout
          </button>
        )}
        <FaUser size={20} />
        <FaRegEnvelope size={20} />
        <FaCog size={20} />
      </div>
    </div>
  );
};

export default Header;
