import React from 'react';
import AuthPortal from './AuthPortal';

export default function RegisterView({ onRegisterSuccess, darkMode, onToggleDarkMode }) {
  return (
    <AuthPortal 
      initialMode="register" 
      onAuthSuccess={onRegisterSuccess} 
      darkMode={darkMode} 
      onToggleDarkMode={onToggleDarkMode} 
    />
  );
}
