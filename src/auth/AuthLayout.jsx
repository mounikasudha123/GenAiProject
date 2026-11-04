import { Leaf, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import "./auth.css";

export default function AuthLayout({ title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Welcome to MindMate">
        <Link to="/sign-in" className="auth-brand">
          <span className="auth-brand-mark"><Leaf size={19} /></span>
          <span>mindmate<span className="brand-period">.</span></span>
        </Link>
        <div className="auth-story-copy">
          <span className="auth-kicker">A GENTLER PLACE TO BEGIN</span>
          <h1>Your space to reflect, grow, and feel better.</h1>
          <p>Small thoughts deserve a place to land. Take a breath, and begin where you are.</p>
        </div>
        <figure className="auth-landscape">
          <img
            src="https://images.pexels.com/photos/147411/italy-mountains-dawn-daybreak-147411.jpeg?auto=compress&cs=tinysrgb&w=1400"
            alt="Soft morning light over a quiet green landscape"
          />
          <figcaption><Leaf size={15} /> A little room for yourself</figcaption>
        </figure>
        <div className="auth-story-foot"><LockKeyhole size={14} /> Your journal belongs to you.</div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-panel-heading">
            <span className="auth-kicker">MINDMATE ACCOUNT</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </div>
        <footer className="auth-footer">A reflective companion, not a substitute for professional care.</footer>
      </section>
    </main>
  );
}