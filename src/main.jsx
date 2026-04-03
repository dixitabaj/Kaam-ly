import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {GoogleOAuthProvider} from '@react-oauth/google'
import { ToastProvider } from "./components/Toast/ToastContext";
import GlobalTaskListener from "./components/Toast/GlobalToast";
const CLIENT_ID = "982291267319-3r75l64uqv29e1pkh3qi9ekc8690bla3.apps.googleusercontent.com"
createRoot(document.getElementById('root')).render(
    <ToastProvider>
    <GlobalTaskListener />
    <GoogleOAuthProvider clientId={CLIENT_ID}>
    <App />
    </GoogleOAuthProvider>
    </ToastProvider>
,
)


