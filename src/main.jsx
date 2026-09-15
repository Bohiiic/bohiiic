import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.scss";

const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "Request failed.");
  return data;
};

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await api("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    }
  };
  return <main className="auth-shell"><section className="auth-card"><div className="brand"><span className="brand-mark">✣</span> Bohiiic</div><p className="eyebrow">PRIVATE MEDIA LIBRARY</p><h1>Welcome back.</h1><p className="muted">Sign in to continue to your personal cinema.</p><form onSubmit={submit}><label>Username<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>Password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>{error && <p className="error">{error}</p>}<button className="primary wide">Sign in <span>→</span></button></form></section></main>;
}

function App() {
  const [user, setUser] = useState(null);
  const [movies, setMovies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    api("/api/auth/me")
      .then((data) => { setUser(data.user); return api("/api/movies"); })
      .then((data) => setMovies(data.movies))
      .catch((err) => { if (!err.message.includes("Authentication required")) setError(err.message); })
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <main className="auth-shell"><p className="muted">Loading your library…</p></main>;
  if (!user) return <><Login onLogin={(next) => { setUser(next); setError(""); api("/api/movies").then((data) => setMovies(data.movies)).catch((err) => { setUser(null); setError(err.message); }); }} />{error && <p className="error auth-error">{error}</p>}</>;
  const logout = () => api("/api/auth/logout").finally(() => setUser(null));
  const upload = async (event) => {
    event.preventDefault();
    setUploading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/movies", { method: "POST", body: form });
      setMovies((current) => [{ ...data, url: data.url }, ...current]);
      event.currentTarget.reset();
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  };
  const remove = async (id) => {
    if (!window.confirm("Remove this movie?")) return;
    try {
      await api(`/api/movies/${id}`, { method: "DELETE" });
      setMovies((current) => current.filter((movie) => movie.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };
  return <div className="app-shell"><nav><div className="brand"><span className="brand-mark">✣</span> Bohiiic</div><div className="nav-links"><a className="active">Library</a><a>Recently added</a><a>Collections</a></div><div className="account"><span>{user.username}</span><button onClick={logout}>Log out</button></div></nav><main className="content"><header className="hero"><div><p className="eyebrow">YOUR PRIVATE CINEMA</p><h1>Good evening, <span>{user.username}.</span></h1><p className="muted">Your movies, beautifully organized.</p></div><div className="hero-orb"><b>75%</b><small>WATCHED</small></div></header><div className="section-head"><div><h2>My library</h2><span className="count">{movies.length} titles</span></div>{user.role === "admin" && <button className="primary" onClick={() => document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" })}>＋ Add movie</button>}</div>{movies.length ? <div className="movie-grid">{movies.map((movie) => <article className="movie-card" key={movie.id} onClick={() => setSelected(movie)}><div className="poster"><video src={movie.url} preload="metadata" /><span className="play">▶</span></div><div className="movie-info"><h3>{movie.title}</h3><p>{movie.description || "No description yet."}</p>{user.role === "admin" && <button className="delete" onClick={(event) => { event.stopPropagation(); remove(movie.id); }}>Remove</button>}</div></article>)}</div> : <div className="empty"><span>✣</span><h2>Your library is ready</h2><p>Add your first movie to start building your private cinema.</p></div>}{user.role === "admin" && <form id="upload" className="upload-card" onSubmit={upload}><div><p className="eyebrow">ADMIN TOOLS</p><h2>Add a movie</h2><p className="muted">Files stay on this server and are only visible after sign-in.</p></div><div className="upload-fields"><input name="title" required maxLength="160" placeholder="Movie title" /><input name="description" maxLength="2000" placeholder="Short description (optional)" /><input name="video" required type="file" accept="video/mp4,video/webm,video/quicktime" /><button className="primary" disabled={uploading}>{uploading ? "Uploading…" : "Upload movie"}</button></div>{error && <p className="error">{error}</p>}</form>}</main>{selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="player-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><video controls autoPlay src={selected.url} /><h2>{selected.title}</h2><p>{selected.description}</p></div></div>}</div>;
}

createRoot(document.getElementById("root")).render(<App />);
