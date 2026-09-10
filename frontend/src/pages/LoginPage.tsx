import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { getToken } from '../services/authService';
import { getPublicConfig } from '../services/configService';
import { createBetterAuthClient, startOidcLogin } from '../services/betterAuthClient';
import { getBasePath } from '../utils/runtime';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import DefaultPasswordWarningModal from '@/components/ui/DefaultPasswordWarningModal';
import logoUrl from '../assets/ylune/logo-mark.png';
import logoMarkUrl from '../assets/ylune/logo-mark-dark.png';
import './login-ylune.css';

type SocialProvider = 'google' | 'github' | 'oidc';

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

const sanitizeReturnUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(value, origin);
    if (url.origin !== origin) return null;
    const relativePath = `${url.pathname}${url.search}${url.hash}`;
    return relativePath || '/';
  } catch {
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    return null;
  }
};

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [betterAuthBasePath, setBetterAuthBasePath] = useState<string | undefined>(undefined);
  const [socialProviders, setSocialProviders] = useState({
    google: false,
    github: false,
    oidc: false,
  });
  const [oidcProviderId, setOidcProviderId] = useState<string>('oidc');
  const [showDefaultPasswordWarning, setShowDefaultPasswordWarning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [shake, setShake] = useState(false);
  const [clock, setClock] = useState('--:--:--');
  const { login, auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return sanitizeReturnUrl(params.get('returnUrl'));
  }, [location.search]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setLoaded(true));
    const fallback = window.setTimeout(() => setLoaded(true), 800);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isServerUnavailableError = useCallback((message?: string) => {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return (
      normalized.includes('failed to fetch') ||
      normalized.includes('networkerror') ||
      normalized.includes('network error') ||
      normalized.includes('connection refused') ||
      normalized.includes('unable to connect') ||
      normalized.includes('fetch error') ||
      normalized.includes('econnrefused') ||
      normalized.includes('http 500') ||
      normalized.includes('internal server error') ||
      normalized.includes('proxy error')
    );
  }, []);

  const buildRedirectTarget = useCallback(() => {
    if (!returnUrl) return '/';
    if (!returnUrl.startsWith('/oauth/authorize')) return returnUrl;
    const token = getToken();
    if (!token) return returnUrl;
    try {
      const origin = window.location.origin;
      const url = new URL(returnUrl, origin);
      url.searchParams.set('token', token);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      const separator = returnUrl.includes('?') ? '&' : '?';
      return `${returnUrl}${separator}token=${encodeURIComponent(token)}`;
    }
  }, [returnUrl]);

  const redirectAfterLogin = useCallback(() => {
    if (returnUrl) {
      window.location.assign(buildRedirectTarget());
    } else {
      navigate('/');
    }
  }, [buildRedirectTarget, navigate, returnUrl]);

  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated) redirectAfterLogin();
  }, [auth.isAuthenticated, auth.loading, redirectAfterLogin]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorCode = params.get('error');
    if (errorCode) {
      const i18nKey = `auth.error.${errorCode}`;
      const translated = t(i18nKey);
      setSocialError(translated !== i18nKey ? translated : t('auth.socialLoginFailed'));
    }
  }, [location.search, t]);

  useEffect(() => {
    const loadAuthProviders = async () => {
      const publicConfig = await getPublicConfig();
      const betterAuth = publicConfig.betterAuth;
      if (!betterAuth?.enabled) {
        setSocialProviders({ google: false, github: false, oidc: false });
        return;
      }
      setBetterAuthBasePath(betterAuth.basePath);
      setOidcProviderId(betterAuth.providers?.oidc?.providerId || 'oidc');
      setSocialProviders({
        google: betterAuth.providers?.google?.enabled === true,
        github: betterAuth.providers?.github?.enabled === true,
        oidc: betterAuth.providers?.oidc?.enabled === true,
      });
    };
    loadAuthProviders();
  }, []);

  const shakeForm = () => {
    setShake(false);
    window.requestAnimationFrame(() => setShake(true));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSocialError(null);
    if (!username || !password) {
      setError(t('auth.emptyFields'));
      shakeForm();
      return;
    }
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        setInfo(t('auth.loggingIn'));
        if (result.isUsingDefaultPassword) setShowDefaultPasswordWarning(true);
        else redirectAfterLogin();
      } else {
        const message = result.message;
        setError(isServerUnavailableError(message) ? t('auth.serverUnavailable') : t('auth.loginFailed'));
        shakeForm();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      setError(isServerUnavailableError(message) ? t('auth.serverUnavailable') : t('auth.loginError'));
      shakeForm();
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialError(null);
    setSocialLoading(provider);
    try {
      if (provider === 'oidc') {
        await startOidcLogin({
          providerId: oidcProviderId,
          callbackURL: returnUrl || '/',
          errorCallbackURL: `${getBasePath()}/login`,
          basePathOverride: betterAuthBasePath,
        });
        return;
      }

      const client = createBetterAuthClient(betterAuthBasePath);
      await client.signIn.social({
        provider,
        callbackURL: returnUrl || '/',
        errorCallbackURL: `${getBasePath()}/login`,
      });
    } catch (err) {
      console.error('Social login error:', err);
      setSocialError(t('auth.socialLoginFailed'));
      setSocialLoading(null);
    }
  };

  const handleCloseWarning = () => {
    setShowDefaultPasswordWarning(false);
    redirectAfterLogin();
  };

  const formMessage = error || socialError || info;
  const messageIsInfo = !error && !socialError && !!info;
  const hasSocial = socialProviders.google || socialProviders.github || socialProviders.oidc;

  return (
    <div className={`ylune-login${loaded ? ' is-loaded' : ''}`}>
      <a className="skip-link" href="#loginForm">
        跳到登录表单
      </a>
      <div className="fx-scanlines" aria-hidden="true" />
      <div className="fx-noise" aria-hidden="true" />

      <header className="nav boot-in">
        <a className="nav-brand" href="#loginForm" aria-label="YLune MCP Hub">
          <img className="nav-logo" src={logoUrl} alt="" width={30} height={30} />
          <span className="nav-name">
            Y<b>LUNE</b>
          </span>
          <span className="nav-badge mono">MCP&nbsp;HUB</span>
        </a>
        <div className="nav-status">
          <span className="dot" />
          <span className="mono">{clock}</span>
          <div className="nav-tools">
            <LanguageSwitch />
          </div>
        </div>
      </header>

      <main className="stage" aria-label="登录">
        <div className="stage-panel boot-in" aria-hidden="true">
          <div className="stage-panel-mark">
            <img src={logoMarkUrl} alt="" />
          </div>
          <div className="stage-panel-tag">
            <b>MCP HUB · INTERNAL</b>
            <span className="mono">YLUNE — GATEWAY v1.0</span>
          </div>
        </div>

        <div className="stage-inner">
          <section className="login" aria-labelledby="loginTitle">
            <p className="login-eyebrow boot-in mono">§ YLUNE — MCP HUB / GATEWAY</p>
            <h1 className="login-title boot-in" id="loginTitle">
              YLUNE<span className="tick">.</span>
            </h1>
            <div className="login-deck boot-in">
              <p className="login-deck-lead">{t('auth.loginLead')}</p>
              <ul className="login-deck-rail">
                <li>{t('auth.loginFactGateway')}</li>
                <li>{t('auth.loginFactInternal')}</li>
                <li>{t('auth.loginFactIssued')}</li>
              </ul>
            </div>

            <form
              className={`login-form boot-in${shake ? ' shake' : ''}`}
              id="loginForm"
              noValidate
              onSubmit={handleSubmit}
              onAnimationEnd={() => setShake(false)}
            >
              <div className="field">
                <label className="mono" htmlFor="username">
                  用户名 / USERNAME
                </label>
                <input
                  className="mono"
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  placeholder={t('auth.username')}
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                />
                <span className="field-line" aria-hidden="true" />
              </div>

              <div className="field">
                <label className="mono" htmlFor="password">
                  密码 / PASSWORD
                </label>
                <div className="field-pw">
                  <input
                    className="mono"
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('auth.password')}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                  />
                  <button
                    className="pw-toggle mono"
                    type="button"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
                <span className="field-line" aria-hidden="true" />
              </div>

              <p className={`form-msg mono${messageIsInfo ? ' is-info' : ''}`} role="alert" aria-live="polite">
                {formMessage ? `// ${formMessage}` : ''}
              </p>

              <button className={`btn-login${loading ? ' is-busy' : ''}`} type="submit" disabled={loading}>
                <span className="btn-label">{t('auth.login')}</span>
                <span className="btn-auth mono" aria-hidden="true">
                  AUTHENTICATING<i>.</i>
                  <i>.</i>
                  <i>.</i>
                </span>
              </button>

              {hasSocial && (
                <div className="social-wrap">
                  <p className="login-hint mono">{t('auth.orContinue')}</p>
                  {socialProviders.google && (
                    <button
                      type="button"
                      className="btn-social mono"
                      disabled={socialLoading !== null}
                      onClick={() => handleSocialLogin('google')}
                    >
                      {socialLoading === 'google' ? t('auth.loggingIn') : t('auth.loginWithGoogle')}
                    </button>
                  )}
                  {socialProviders.github && (
                    <button
                      type="button"
                      className="btn-social mono"
                      disabled={socialLoading !== null}
                      onClick={() => handleSocialLogin('github')}
                    >
                      {socialLoading === 'github' ? t('auth.loggingIn') : t('auth.loginWithGithub')}
                    </button>
                  )}
                  {socialProviders.oidc && (
                    <button
                      type="button"
                      className="btn-social mono"
                      disabled={socialLoading !== null}
                      onClick={() => handleSocialLogin('oidc')}
                    >
                      {socialLoading === 'oidc' ? t('auth.loggingIn') : t('auth.loginWithOIDC')}
                    </button>
                  )}
                </div>
              )}

              <p className="login-access boot-in">
                <i className="login-access-dot" aria-hidden="true" />
                <span>{t('auth.loginAccessClosed')}</span>
                <span className="login-access-sep" aria-hidden="true">
                  /
                </span>
                <span>{t('auth.loginAccessIssued')}</span>
              </p>
            </form>
          </section>
        </div>

        <div className="meta-bar mono boot-in" aria-hidden="true">
          <span>EST. 2026 · 黑夜将至，你我不独行</span>
          <span>SECURE CHANNEL · TLS</span>
          <span>YLUNE · MCP HUB</span>
        </div>
      </main>

      <DefaultPasswordWarningModal isOpen={showDefaultPasswordWarning} onClose={handleCloseWarning} />
    </div>
  );
};

export default LoginPage;
