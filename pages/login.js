// pages/login.js
import { useState } from "react";
import { signIn }    from "next-auth/react";
import { useRouter } from "next/router";

export default function Login() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password
    });
    if (res.error) {
      setError(res.error);
    } else {
      // guardo un centro por defecto y redirijo al dashboard
      localStorage.setItem("active_center", "la_herradura");
      router.push("/");
    }
  };

  return (
    <div style={{ padding:20, fontFamily:"sans-serif" }}>
      <h1>Iniciar Sesión</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth:360 }}>
        <label>Email:</label>
        <input
          type="email" required
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width:"100%", padding:8, marginBottom:12 }}
        />
        <label>Contraseña:</label>
        <input
          type="password" required
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width:"100%", padding:8, marginBottom:12 }}
        />
        {error && <p style={{ color:"red" }}>{error}</p>}
        <button
          type="submit"
          style={{
            width:"100%", padding:10,
            background:"#0070f3", color:"#fff", border:"none"
          }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
