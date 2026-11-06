import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SelectField } from '@/components/form/select-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { THEME_MODES, useThemeMode, type ThemeMode } from '@/hooks/use-theme-mode';
import { setAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';

const LANGUAGE_LABEL_KEYS: Record<AppLanguage, string> = {
  en: 'settings.english',
  id: 'settings.indonesian',
};

const THEME_LABEL_KEYS: Record<ThemeMode, string> = {
  system: 'settings.system',
  light: 'settings.light',
  dark: 'settings.dark',
};

type OpenPicker = 'language' | 'theme' | null;

export default function SettingsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const current: AppLanguage = (i18n.language ?? 'en').startsWith('id') ? 'id' : 'en';
  const [themeMode, setThemeMode] = useThemeMode();
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);

  const languageOptions = SUPPORTED_LANGUAGES.map((language) => ({
    value: language,
    label: t(LANGUAGE_LABEL_KEYS[language]),
  }));

  const themeOptions = THEME_MODES.map((mode) => ({
    value: mode,
    label: t(THEME_LABEL_KEYS[mode]),
  }));

  const handleLanguageSelect = (value: AppLanguage) => {
    setAppLanguage(value);
    setOpenPicker(null);
  };

  const handleThemeSelect = (value: ThemeMode) => {
    setThemeMode(value);
    setOpenPicker(null);
  };

  const togglePicker = (picker: Exclude<OpenPicker, null>) => {
    setOpenPicker((open) => (open === picker ? null : picker));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.fieldWrapper}>
            <SelectField
              label={t('settings.language')}
              value={t(LANGUAGE_LABEL_KEYS[current])}
              onPress={() => togglePicker('language')}
              open={openPicker === 'language'}
            />

            {openPicker === 'language' ? (
              <View
                style={[
                  styles.menu,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}>
                {languageOptions.map((option) => {
                  const selected = option.value === current;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => handleLanguageSelect(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option.label}
                      style={({ pressed }) => [
                        styles.menuItem,
                        selected && { backgroundColor: theme.backgroundSelected },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type={selected ? 'smallBold' : 'default'}>
                        {option.label}
                      </ThemedText>
                      {selected ? (
                        <ThemedText type="smallBold" style={{ color: theme.accent }}>
                          ✓
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.fieldWrapper}>
            <SelectField
              label={t('settings.theme')}
              value={t(THEME_LABEL_KEYS[themeMode])}
              onPress={() => togglePicker('theme')}
              open={openPicker === 'theme'}
            />

            {openPicker === 'theme' ? (
              <View
                style={[
                  styles.menu,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}>
                {themeOptions.map((option) => {
                  const selected = option.value === themeMode;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => handleThemeSelect(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option.label}
                      style={({ pressed }) => [
                        styles.menuItem,
                        selected && { backgroundColor: theme.backgroundSelected },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type={selected ? 'smallBold' : 'default'}>
                        {option.label}
                      </ThemedText>
                      {selected ? (
                        <ThemedText type="smallBold" style={{ color: theme.accent }}>
                          ✓
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  fieldWrapper: {
    position: 'relative',
  },
  menu: {
    marginTop: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
