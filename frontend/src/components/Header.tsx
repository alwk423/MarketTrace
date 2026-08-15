import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { to: "/simulate", label: "Simulate" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/strategies", label: "Build Strategy" },
  { to: "/history", label: "History" },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on an outside click, same pattern as any menu/popover.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate("/login", { replace: true });
  }

  const initial = user?.email.charAt(0).toUpperCase() ?? "?";

  return (
    <header className="app-header">
      <div className="app-header-left">
        <NavLink to="/simulate" className="brand">
          MarketTrace
        </NavLink>
        <nav className="app-nav">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="profile-menu" ref={menuRef}>
        <button
          type="button"
          className="profile-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <span className="profile-avatar">{initial}</span>
          {user?.email}
        </button>

        {menuOpen && (
          <div className="profile-dropdown">
            <div className="profile-email">{user?.email}</div>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
