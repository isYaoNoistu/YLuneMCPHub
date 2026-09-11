import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const ThemeSwitch: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className={`icon-btn theme-bulb${isLight ? ' is-on' : ''}`}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      title={isLight ? t('theme.toggleDark') : t('theme.toggleLight')}
      aria-label={isLight ? t('theme.toggleDark') : t('theme.toggleLight')}
    >
      <Lightbulb size={16} fill={isLight ? 'currentColor' : 'none'} />
    </button>
  );
};

export default ThemeSwitch;
