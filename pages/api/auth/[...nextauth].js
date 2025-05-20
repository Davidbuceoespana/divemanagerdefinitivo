import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "Login fijo",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(creds) {
        if (
          creds.email    === process.env.ADMIN_EMAIL &&
          creds.password === process.env.ADMIN_PASSWORD
        ) {
          return { id: 1, email: creds.email }
        }
        throw new Error("Email o contraseña incorrectos")
      }
    })
  ],
  pages:   { signIn: "/login" },
  session: { strategy: "jwt"    },
  secret:  process.env.NEXTAUTH_SECRET
})
