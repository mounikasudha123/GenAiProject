import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function SignOutButton({ className = "button button-quiet" }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    if (!window.confirm("Are you sure you want to sign out?")) return;
    try {
      await signOut();
      navigate("/sign-in", {
        replace: true,
        state: { signedOut: true },
      });
    } catch {
      window.alert("We couldn't sign you out. Please try again.");
    }
  }

  return (
    <button className={className} onClick={handleSignOut}>
      <LogOut size={15} /> Sign out
    </button>
  );
}