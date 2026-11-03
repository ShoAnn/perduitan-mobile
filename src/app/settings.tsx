import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SelectField } from '@/components/form/select-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';

const LANGUAGE_LABEL_KEYS: Record<AppLanguage, string> = {
  en: 'settings.english',
  id: 'settings.indonesian',
};

export default function SettingsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const current: AppLanguage = (i18n.language ?? 'en').startsWith('id') ? 'id' : 'en';
  const [isOpen, setIsOpen] = useState(false);

  const options = SUPPORTED_LANGUAGES.map((language) => ({
    value: language,
    label: t(LANGUAGE_LABEL_KEYS[language]),
  }));

  const handleSelect = (value: AppLanguage) => {
    setAppLanguage(value);
    setIsOpen(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
        <View style={styles.content}>
          <View style={styles.fieldWrapper}>
            <SelectField
              label={t('settings.language')}
              value={t(LANGUAGE_LABEL_KEYS[current])}
              onPress={() => setIsOpen((open) => !open)}
              open={isOpen}
            />

            {isOpen ? (
              <View
                style={[
                  styles.menu,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                ]}>
                {options.map((option) => {
                  const selected = option.value === current;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => handleSelect(option.value)}
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
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  fieldWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
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
