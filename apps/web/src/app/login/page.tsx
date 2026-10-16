'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { loginUser } from '@/features/auth/api/login-user-api';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await loginUser({
        email: email.trim(),
        password,
      });

      setSuccess(result.message || 'Login successful!');

      // If needed, redirect after login:
      // router.push('/dashboard');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message;

        setError(
          typeof message === 'string'
            ? message
            : 'Unable to log in. Please check your credentials.',
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.loginCard} aria-labelledby="login-title">
        <div className={styles.ghostLogo} aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8 24C8 14.6 14.5 7 24 7S40 14.6 40 24V38L34 34L29 38L24 34L19 38L14 34L8 38V24Z"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <circle cx="19" cy="22" r="2.5" fill="currentColor" />
            <circle cx="29" cy="22" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <h1 id="login-title" className={styles.title}>
          Welcome Back
        </h1>

        <p className={styles.subtitle}>Sign in to your account to continue</p>

        <form className={styles.form} onSubmit={handleLogin}>
          <label className={styles.inputWrapper}>
            <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M4 7L12 13L20 7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>

            <input
              className={styles.input}
              type="email"
              name="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className={styles.inputWrapper}>
            <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="5"
                y="10"
                width="14"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M8 10V7a4 4 0 018 0v3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <circle cx="12" cy="15" r="1.3" fill="currentColor" />
            </svg>

            <input
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <button
              className={styles.passwordToggle}
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 3L21 21M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.3-2.3 3.3M6.2 6.2C3.9 7.7 2.7 10 2.5 12c1 2.8 4.5 7 9.5 7 1.3 0 2.5-.3 3.6-.8"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              )}
            </button>
          </label>

          {error && (
            <p className={styles.errorMessage} role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className={styles.successMessage} role="status">
              {success}
            </p>
          )}

          <button className={styles.loginButton} type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

        <Link href="/forgot-password" className={styles.forgotPassword}>
          Forgot your password?
        </Link>

        <p className={styles.registerText}>
          Need an account?{' '}
          <Link href="/register" className={styles.registerLink}>
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
