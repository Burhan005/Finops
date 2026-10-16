import React from 'react';
import AuthPortal from './AuthPortal';

export default function LoginView({ onLoginSuccess, darkMode, onToggleDarkMode }) {
  return (
    <AuthPortal 
      initialMode="login" 
      onAuthSuccess={onLoginSuccess} 
      darkMode={darkMode} 
      onToggleDarkMode={onToggleDarkMode} 
    />
  );
}
