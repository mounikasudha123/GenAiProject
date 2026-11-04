import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import SignOutButton from "./SignOutButton";

export default function Navbar({ title, user, onMenuToggle }) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu-button"
        aria-label="Open navigation"
        onClick={onMenuToggle}
      >
        <Menu size={20} />
      </button>
      <div className="breadcrumb">
        <Link to="/">MindMate</Link>
        <span className="crumb-slash">/</span>
        <strong>{title}</strong>
      </div>
      <div className="top-actions">
        <span className="mode-pill connected">
          <span className="status-dot" />
          Private account
        </span>
        <SignOutButton title={`Sign out ${user.email}`} />
      </div>
    </header>
  );
}