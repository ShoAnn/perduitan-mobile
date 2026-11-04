import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { listTransactions, type TransactionWithNames } from '@/db/transactions';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/utils/category-names';
import { formatCurrency, formatNumber } from '@/utils/format';

type Tab = 'expense' | 'income';

const CHART_SIZE = 240;
const STROKE_WIDTH = 34;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CENTER = CHART_SIZE / 2;
const GAP_DEGREES = 2;
const UNCATEGORIZED_KEY = '__uncategorized__';

/** Distinct slice colors, reused cyclically when there are more categories. */
const SLICE_COLORS = [
  '#3C87F7',
  '#F2994A',
  '#27AE60',
  '#EB5757',
  '#9B51E0',
  '#2D9CDB',
  '#F2C94C',
  '#56CCF2',
  '#BB6BD9',
  '#6FCF97',
  '#7B61FF',
  '#A0A4AB',
];

type Slice = {
  key: string;
  categoryName: string | null;
  amount: number;
  percent: number;
  color: string;
  start: number;
  end: number;
};

/** Point on a circle, with 0° at the top and angles increasing clockwise. */
function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

/** Arc along a circle, drawn clockwise from `start` to `end` degrees. */
function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y}`;
}

function formatPercent(value: number): string {
  return `${formatNumber(Math.round(value))}%`;
}

type LegendRowProps = {
  slice: Slice;
  label: string;
  percentLabel: string;
  amountLabel: string;
  selected: boolean;
  dimmed: boolean;
  highlightColor: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function LegendRow({
  slice,
  label,
  percentLabel,
  amountLabel,
  selected,
  dimmed,
  highlightColor,
  accessibilityLabel,
  onPress,
}: LegendRowProps) {
  const [progress] = useState(() => new Animated.Value(selected ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [progress, selected]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.legendRow, pressed && styles.pressed]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.legendHighlight,
          { opacity: progress, backgroundColor: highlightColor },
        ]}
      />
      <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
      <ThemedText type="small" numberOfLines={1} style={[styles.legendName, dimmed && styles.dimmed]}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.legendPercent}>
        {percentLabel}
      </ThemedText>
      <ThemedText type="smallBold" style={dimmed ? styles.dimmed : undefined}>
        {amountLabel}
      </ThemedText>
    </Pressable>
  );
}

export default function AnalyticsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const db = useSQLiteContext();

  const [tab, setTab] = useState<Tab>('expense');
  const [transactions, setTransactions] = useState<TransactionWithNames[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      listTransactions(db)
        .then((all) => {
          if (isActive) {
            setTransactions(all);
          }
        })
        .catch((error: unknown) => {
          console.error('Failed to load transactions for analytics', error);
        });

      return () => {
        isActive = false;
      };
    }, [db])
  );

  const slices = useMemo<Slice[]>(() => {
    const totals = new Map<string, { categoryName: string | null; amount: number }>();

    for (const transaction of transactions) {
      if (transaction.amount_cents === 0) {
        continue;
      }
      const isExpense = transaction.amount_cents < 0;
      if (isExpense !== (tab === 'expense')) {
        continue;
      }

      const key = transaction.category_name ?? UNCATEGORIZED_KEY;
      const existing = totals.get(key);
      if (existing) {
        existing.amount += Math.abs(transaction.amount_cents);
      } else {
        totals.set(key, {
          categoryName: transaction.category_name,
          amount: Math.abs(transaction.amount_cents),
        });
      }
    }

    const grandTotal = [...totals.values()].reduce((sum, entry) => sum + entry.amount, 0);
    if (grandTotal === 0) {
      return [];
    }

    let cursor = 0;
    return [...totals.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([key, entry], index) => {
        const sweep = (entry.amount / grandTotal) * 360;
        const start = cursor;
        cursor += sweep;
        return {
          key,
          categoryName: entry.categoryName,
          amount: entry.amount,
          percent: (entry.amount / grandTotal) * 100,
          color: SLICE_COLORS[index % SLICE_COLORS.length],
          start,
          end: cursor,
        };
      });
  }, [transactions, tab]);

  const total = useMemo(() => slices.reduce((sum, slice) => sum + slice.amount, 0), [slices]);
  const selectedSlice = useMemo(
    () => slices.find((slice) => slice.key === selectedKey) ?? null,
    [slices, selectedKey]
  );

  // Brief fade so the centre readout never snaps between states.
  const [centerFade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    centerFade.setValue(0);
    Animated.timing(centerFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [centerFade, selectedKey, tab]);

  const labelFor = (categoryName: string | null) =>
    categoryName ? categoryLabel(categoryName, t) : t('common.uncategorized');

  const kindLabel = String(t(`kinds.${tab}`)).toLowerCase();
  const gap = slices.length > 1 ? GAP_DEGREES : 0;

  const selectTab = (next: Tab) => {
    setTab(next);
    setSelectedKey(null);
  };

  const toggleSelection = (key: string) => {
    setSelectedKey((current) => (current === key ? null : key));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
        <View style={[styles.tabBar, { borderBottomColor: theme.backgroundSelected }]}>
          <Pressable
            onPress={() => selectTab('expense')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'expense' }}
            style={[styles.tabButton, tab === 'expense' && styles.tabButtonActive]}>
            <ThemedText
              type="smallBold"
              style={{ color: tab === 'expense' ? '#000000' : theme.text }}>
              {t('kinds.expense')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => selectTab('income')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'income' }}
            style={[styles.tabButton, tab === 'income' && styles.tabButtonActive]}>
            <ThemedText
              type="smallBold"
              style={{ color: tab === 'income' ? '#000000' : theme.text }}>
              {t('kinds.income')}
            </ThemedText>
          </Pressable>
        </View>

        <FlatList
          data={slices}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={
            slices.length > 0 ? (
              <View style={styles.chartWrap}>
                <Svg width={CHART_SIZE} height={CHART_SIZE}>
                  <Circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    stroke={theme.backgroundSelected}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                  />
                  {slices.length === 1 ? (
                    <Circle
                      cx={CENTER}
                      cy={CENTER}
                      r={RADIUS}
                      stroke={slices[0].color}
                      strokeWidth={STROKE_WIDTH}
                      fill="none"
                      onPress={() => toggleSelection(slices[0].key)}
                    />
                  ) : (
                    slices.map((slice) => {
                      const isSelected = slice.key === selectedKey;
                      const dimmed = selectedKey !== null && !isSelected;
                      const drawStart = slice.start + gap / 2;
                      const drawEnd = Math.max(slice.end - gap / 2, drawStart + 0.001);
                      return (
                        <Path
                          key={slice.key}
                          d={arcPath(CENTER, CENTER, RADIUS, drawStart, drawEnd)}
                          stroke={slice.color}
                          strokeWidth={isSelected ? STROKE_WIDTH + 8 : STROKE_WIDTH}
                          strokeLinecap="butt"
                          fill="none"
                          opacity={dimmed ? 0.35 : 1}
                          onPress={() => toggleSelection(slice.key)}
                          accessibilityLabel={t('analytics.sliceAccessibility', {
                            category: labelFor(slice.categoryName),
                            amount: formatCurrency(slice.amount),
                            percent: formatPercent(slice.percent),
                          })}
                        />
                      );
                    })
                  )}
                </Svg>

                <View style={styles.centerOverlay} pointerEvents="none">
                  <Animated.View style={[styles.centerContent, { opacity: centerFade }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {selectedSlice ? labelFor(selectedSlice.categoryName) : t('analytics.total')}
                    </ThemedText>
                    <ThemedText style={styles.centerAmount}>
                      {formatCurrency(selectedSlice ? selectedSlice.amount : total)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {selectedSlice
                        ? t('analytics.percentOfTotal', {
                            percent: formatPercent(selectedSlice.percent),
                          })
                        : t('analytics.categoryCount', { count: slices.length })}
                    </ThemedText>
                  </Animated.View>
                </View>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <ThemedText style={styles.empty}>{t('analytics.noData', { kind: kindLabel })}</ThemedText>
          }
          renderItem={({ item }) => {
            const isSelected = item.key === selectedKey;
            const dimmed = selectedKey !== null && !isSelected;
            return (
              <LegendRow
                slice={item}
                label={labelFor(item.categoryName)}
                percentLabel={formatPercent(item.percent)}
                amountLabel={formatCurrency(item.amount)}
                selected={isSelected}
                dimmed={dimmed}
                highlightColor={theme.backgroundSelected}
                accessibilityLabel={t('analytics.sliceAccessibility', {
                  category: labelFor(item.categoryName),
                  amount: formatCurrency(item.amount),
                  percent: formatPercent(item.percent),
                })}
                onPress={() => toggleSelection(item.key)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
  },
  listContent: {
    gap: Spacing.two,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  chartWrap: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignSelf: 'center',
    marginBottom: Spacing.four,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    maxWidth: RADIUS * 1.7,
    paddingHorizontal: Spacing.two,
  },
  centerAmount: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
    marginVertical: Spacing.half,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  legendHighlight: {
    borderRadius: Spacing.three,
    pointerEvents: 'none',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendName: {
    flex: 1,
  },
  legendPercent: {
    minWidth: 44,
    textAlign: 'right',
  },
  dimmed: {
    opacity: 0.5,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  pressed: {
    opacity: 0.7,
  },
});
