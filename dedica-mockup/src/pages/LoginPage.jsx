import { useEffect, useState } from "react";
import { Button, Field, Input } from "../components/index.js";
import { consumeLoginRedirect, getCurrentUser, isAdminUser, registerUser, resetUserPassword, signInUser } from "../services/auth.js";
import { isFirebaseLocal } from "../services/firebase.js";

export function LoginPage({ onNavigate }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) routeUser(user);
    });
  }, []);

  function routeUser(user) {
    const redirect = consumeLoginRedirect(isAdminUser(user) ? "/admin" : "/account");
    onNavigate(isAdminUser(user) ? "admin" : pathToView(redirect));
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage(null);
  }

  async function submit(event) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const user = mode === "register"
        ? await registerUser(email.trim(), password)
        : await signInUser(email.trim(), password);
      if (mode === "register") sessionStorage.setItem("dedica_account_notice", "Account creato. Ti abbiamo inviato un’email per verificare il tuo indirizzo: controlla anche Spam e Promozioni.");
      routeUser(user);
    } catch (error) {
      setMessage({ tone: "error", text: getFriendlyAuthError(error, mode) });
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage({ tone: "error", text: "Inserisci prima il tuo indirizzo email." });
      return;
    }
    setMessage(null);
    setLoading(true);
    try {
      await resetUserPassword(email.trim());
      setMessage({ tone: "success", text: "Ti abbiamo inviato il link per scegliere una nuova password. Controlla anche la cartella Spam." });
    } catch (error) {
      setMessage({ tone: "error", text: getFriendlyAuthError(error, "reset") });
    } finally {
      setLoading(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <main className="login-react">
      <section className="login-react-intro" aria-label="Vantaggi dell'area personale">
        <span className="eyebrow">La tua area personale</span>
        <h1>Tutto il tuo ordine,<br />in un unico posto.</h1>
        <p>Segui ogni passaggio della tua candela, dalla dedica alla consegna.</p>
        <ul>
          <li><span>01</span><div><strong>Controlla l’ordine</strong><small>Pagamento, lavorazione e spedizione sempre visibili.</small></div></li>
          <li><span>02</span><div><strong>Approva la bozza</strong><small>Verifica il risultato prima che inizi la produzione.</small></div></li>
          <li><span>03</span><div><strong>Parla con noi</strong><small>Messaggi e richieste restano collegati all’ordine.</small></div></li>
        </ul>
      </section>

      <section className="login-react-panel">
        <div className="login-react-tabs" role="tablist" aria-label="Tipo di accesso">
          <button type="button" className={!isRegister ? "active" : ""} onClick={() => changeMode("login")}>Accedi</button>
          <button type="button" className={isRegister ? "active" : ""} onClick={() => changeMode("register")}>Crea account</button>
        </div>
        <div>
          <span className="eyebrow">{isRegister ? "Nuovo account" : "Bentornato"}</span>
          <h2>{isRegister ? "Crea la tua area DÈDICA." : "Accedi alla tua area DÈDICA."}</h2>
          <p>{isRegister ? "Registrati per effettuare ordini e approvare le tue bozze." : "Inserisci le credenziali usate durante la registrazione."}</p>
        </div>

        {message ? <div className={`login-react-message is-${message.tone}`} role="alert">{message.text}</div> : null}
        {isFirebaseLocal ? <div className="login-react-message is-error">Accesso cliente non disponibile nell’anteprima locale.</div> : null}

        <form className="login-react-form" onSubmit={submit}>
          <Field label="Email" hint="L’indirizzo utilizzato per il tuo account.">
            <Input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nome@email.it" />
          </Field>
          <Field label="Password" hint={isRegister ? "Usa almeno 6 caratteri." : "La password distingue maiuscole e minuscole."}>
            <Input type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength="6" value={password} onChange={event => setPassword(event.target.value)} placeholder="Inserisci la password" />
          </Field>
          <Button type="submit" disabled={loading || isFirebaseLocal}>{loading ? "Attendi..." : isRegister ? "Crea il mio account" : "Accedi"}</Button>
          {!isRegister ? <button className="login-react-reset" type="button" disabled={loading || isFirebaseLocal} onClick={resetPassword}>Hai dimenticato la password?</button> : null}
        </form>
        <p className="login-react-switch">{isRegister ? "Hai già un account?" : "Non hai ancora un account?"} <button type="button" onClick={() => changeMode(isRegister ? "login" : "register")}>{isRegister ? "Accedi" : "Registrati"}</button></p>
        <small className="login-react-security">Accesso protetto da Firebase Authentication. Non memorizziamo la tua password.</small>
      </section>
    </main>
  );
}

function getFriendlyAuthError(error, mode) {
  const code = String(error?.code || "").replace("auth/", "");
  const messages = {
    "invalid-credential": "Email o password non corrette. Controlla i dati e riprova.",
    "wrong-password": "Email o password non corrette. Controlla i dati e riprova.",
    "user-not-found": "Email o password non corrette. Controlla i dati e riprova.",
    "invalid-email": "L’indirizzo email non è valido.",
    "email-already-in-use": "Esiste già un account con questa email. Prova ad accedere oppure recupera la password.",
    "weak-password": "La password è troppo semplice: inserisci almeno 6 caratteri.",
    "too-many-requests": "Hai effettuato troppi tentativi. Attendi qualche minuto prima di riprovare.",
    "network-request-failed": "Connessione assente o instabile. Verifica Internet e riprova.",
    "user-disabled": "Questo account è stato disabilitato. Contatta l’assistenza DÈDICA.",
    "operation-not-allowed": "Questa modalità di accesso non è ancora disponibile.",
  };
  return messages[code] || (mode === "register" ? "Non è stato possibile creare l’account. Riprova tra poco." : mode === "reset" ? "Non è stato possibile inviare l’email di recupero. Riprova tra poco." : "Accesso non riuscito. Verifica i dati e riprova.");
}

function pathToView(path) {
  const cleanPath = String(path || "").replace(/^https?:\/\/[^/]+/i, "").split("?")[0].replace(/^\/+/, "");
  if (cleanPath.startsWith("admin")) return "admin";
  if (cleanPath.startsWith("cart")) return "cart";
  return "account";
}
