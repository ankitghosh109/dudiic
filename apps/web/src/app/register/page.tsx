'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Ghost, Mail, UserRound, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { registerUser } from '@/features/auth/api/register-user-api';
import styles from './page.module.css';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerUser({
        email: email.trim(),
        ...(username.trim() && {
          username: username.trim(),
        }),
        password,
      });

      setSuccess(result.message || 'Account created successfully.');

      // Clear the form after successful registration.
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message;

        setError(typeof message === 'string' ? message : 'Registration failed. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="register-title">
        <div className={styles.logo} aria-hidden="true">
          <Ghost size={44} strokeWidth={1.9} />
        </div>

        <header className={styles.header}>
          <h1 id="register-title">Create an account</h1>
          <p>Join us and start your journey</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <Mail className={styles.fieldIcon} size={19} aria-hidden="true" />
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Email address"
              aria-label="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <UserRound className={styles.fieldIcon} size={19} aria-hidden="true" />
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Username (optional)"
              aria-label="Username (optional)"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <LockKeyhole className={styles.fieldIcon} size={19} aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              placeholder="Password"
              aria-label="Password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <button
              className={styles.visibilityButton}
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>

          <label className={styles.field}>
            <LockKeyhole className={styles.fieldIcon} size={19} aria-hidden="true" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm password"
              aria-label="Confirm password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />

            <button
              className={styles.visibilityButton}
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className={styles.success} role="status">
              {success}
            </p>
          )}

          <button className={styles.submitButton} type="submit" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className={styles.divider} aria-hidden="true">
          <span />
          <span className={styles.orText}>or</span>
          <span />
        </div>

        <p className={styles.loginPrompt}>
          Already have an account? <a href="/login">Log In</a>
        </p>
      </section>
    </main>
  );
}
