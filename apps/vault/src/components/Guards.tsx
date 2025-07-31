import { Component, createEffect } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useAuth } from '../providers';

// Auth guard component - requires authentication
export const AuthGuard: Component<{ children: any }> = (props) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  createEffect(() => {
    if (!isAuthenticated()) {
      navigate(`/${params.app}`);
    }
  });

  return <>{props.children}</>;
};

// Vault guard component - requires vault to be unlocked
export const VaultGuard: Component<{ children: any }> = (props) => {
  const { isAuthenticated, isVaultUnlocked } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  createEffect(() => {
    if (!isAuthenticated()) {
      navigate(`/${params.app}`);
    } else if (!isVaultUnlocked()) {
      navigate(`/${params.app}/unlock`);
    }
  });

  return <>{props.children}</>;
};

// Login guard component - redirect if already authenticated
export const LoginGuard: Component<{ children: any }> = (props) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  createEffect(() => {
    if (isAuthenticated()) {
      navigate(`/${params.app}/dashboard`);
    }
  });

  return <>{props.children}</>;
};